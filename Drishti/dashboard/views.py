from django.shortcuts import render, get_object_or_404, redirect
from .models import Project
from django.db.models import Count
from .forms import ProjectForm
from django.contrib.auth import authenticate, login
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.decorators import login_required 

from django.http import JsonResponse
from django.views.decorators.http import require_POST
from .models import Project, Report
from .forms import ReportForm 
from django.contrib import messages
from .models import Notification
from django.db import transaction




def admin_dashboard(request):
    projects = Project.objects.all().order_by('-start_date')
    total_projects = projects.count()
    ongoing = projects.filter(status='ongoing').count()
    completed = projects.filter(status='completed').count()
    pending = projects.filter(status='pending').count()
    up_next = projects.filter(status='up_next').count()  
    
    agency_distribution = projects.values('principal_agency').annotate(count=Count('id')).order_by('-count')
    
    context = {
        'total_projects': total_projects,
        'ongoing': ongoing,
        'completed': completed,
        'pending': pending,
        'up_next': up_next,
        'projects': projects,
        'agency_distribution': agency_distribution,
    }
    
    return render(request, 'dashboard/admin_dashboard.html', context)

def project_detail(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    return render(request, 'dashboard/project_detail.html', {'project': project})


    

def add_project(request):
    if request.method == 'POST':
        form = ProjectForm(request.POST)
        if form.is_valid():
            project = form.save()
            return redirect('project_detail', project.id)
    else:
        form = ProjectForm()
    
    return render(request, 'projects/add_project.html', {'form': form})


def investigator_login(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            return redirect('investigator_dashboard')
        else:
            return render(request, 'dashboard/investigator_login.html', {
                'error': 'Invalid username or password'
            })
    return render(request, 'dashboard/investigator_login.html')

def investigator_signup(request):
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('investigator_dashboard')
    else:
        form = UserCreationForm()
    return render(request, 'dashboard/investigator_signup.html', {'form': form})

@login_required
def investigator_dashboard(request):
    # Get projects assigned to the current investigator
    projects = Project.objects.filter(assigned_investigator=request.user)
    
    context = {
        'projects': projects
    }
    return render(request, 'dashboard/investigator_dashboard.html', context)

@login_required
def view_notifications(request):
    # Only show notifications for the current user
    notifications = Notification.objects.filter(user=request.user).order_by('-created_at')
    return render(request, 'dashboard/notifications.html', {
        'notifications': notifications
    })

    


from .models import Notification, Report, Project

def mark_notification_read(request, notification_id):
    notification = get_object_or_404(Notification, id=notification_id, user=request.user)
    notification.is_read = True
    notification.save()
    return redirect('view_notifications')


@login_required
def investigator_notifications(request):
    notifications = request.user.notifications.filter(
        notification_type__in=['report_approved', 'report_rejected', 'resubmit_request']
    ).order_by('-created_at')
    
    # Mark notifications as read when viewed
    notifications.update(is_read=True)
    
    return render(request, 'dashboard/investigator/notifications.html', {
        'notifications': notifications
    })



@login_required
@transaction.atomic
def submit_report(request, project_id):
    project = get_object_or_404(Project, id=project_id, assigned_investigator=request.user)
    
    if request.method == 'POST':
        form = ReportForm(request.POST, request.FILES)
        if form.is_valid():
            report = form.save(commit=False)
            report.project = project
            report.investigator = request.user
            report.status = 'submitted'
            report.save()
            
            # Update project status
            project.report_submitted = True
            project.report_resubmit_requested = False
            project.save()
            
            # Create notification for admin
            Notification.objects.create(
                user=project.assigned_investigator,
                message=f"New report submitted for project {project.title}",
                report=report,
                notification_type='report_submitted'
            )
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'success': True,
                    'message': 'Report submitted successfully!'
                })
            else:
                messages.success(request, "Report submitted successfully!")
                return redirect('investigator_dashboard')
        else:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'success': False,
                    'errors': form.errors.get_json_data()
                }, status=400)
    
    # Handle non-AJAX GET requests
    if request.headers.get('X-Requested-With') != 'XMLHttpRequest':
        form = ReportForm()
        return render(request, 'dashboard/submit_report.html', {
            'form': form,
            'project': project
        })
    return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)
    


@login_required
def view_report(request, report_id):
    """View for investigators to see report details"""
    report = get_object_or_404(Report, id=report_id, investigator=request.user)
    return render(request, 'dashboard/view_report.html', {
        'report': report
    })


@login_required
def resubmit_report(request, report_id):
    report = get_object_or_404(Report, id=report_id, investigator=request.user)
    
    # Only allow resubmission if report was rejected or resubmission was requested
    if report.status not in ['rejected', 'resubmit_requested']:
        messages.error(request, "This report cannot be resubmitted")
        return redirect('investigator_notifications')

    if request.method == 'POST':
        form = ReportForm(request.POST, request.FILES, instance=report)
        if form.is_valid():
            # Save the form and update status
            updated_report = form.save(commit=False)
            updated_report.status = 'submitted'  # Change status to submitted
            updated_report.save()
            
            # Update project status
            if hasattr(report, 'project'):
                report.project.report_resubmit_requested = False
                report.project.report_submitted = True
                report.project.save()
            
            messages.success(request, "Report successfully resubmitted!")
            return redirect('investigator_notifications')
    else:
        form = ReportForm(instance=report)
    
    return render(request, 'dashboard/resubmit_report.html', {
        'form': form,
        'report': report
    })


@login_required
def investigator_dashboard(request):
    # Get unread notifications
    unread_notifications = request.user.notifications.filter(
        is_read=False,
        notification_type__in=['report_rejected', 'resubmit_request']
    ).order_by('-created_at')[:5]
    
    # Get investigator's projects
    projects = request.user.assigned_projects.all()
    
    return render(request, 'dashboard/investigator_dashboard.html', {
        'unread_notifications': unread_notifications,
        'projects': projects
    })


