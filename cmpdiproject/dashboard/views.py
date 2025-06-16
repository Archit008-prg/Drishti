from django.shortcuts import render, get_object_or_404, redirect
from .models import Project
from django.db.models import Count
from .forms import ProjectForm

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