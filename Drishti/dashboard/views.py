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


# views.py


@require_POST
def submit_report(request):
    try:
        project_id = request.POST.get('project_id')
        report_file = request.FILES.get('report_file')
        notes = request.POST.get('notes', '')
        
        project = Project.objects.get(id=project_id, assigned_investigator=request.user)
        
        # Create report
        Report.objects.create(
            project=project,
            investigator=request.user,
            report_file=report_file,
            notes=notes
        )
        
        # Update project status if needed
        if project.status != 'completed':
            project.status = 'completed'
            project.save()
        
        return JsonResponse({'success': True})
    
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})
