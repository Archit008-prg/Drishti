from django.urls import path
from . import views
from .views import add_project

urlpatterns = [
    path('', views.admin_dashboard, name='admin_dashboard'),
    path('project/<int:project_id>/detail/', views.project_detail, name='project_detail'),
    
    path('add/', add_project, name='add_project'),

    # You can add more paths here as you develop more views
]

