from django.urls import path
from . import views
from .views import add_project, submit_report, view_notifications
from .views import (add_project, submit_report, view_notifications)

urlpatterns = [
    path('', views.admin_dashboard, name='admin_dashboard'),
    path('project/<int:project_id>/detail/', views.project_detail, name='project_detail'),
    path('add/', add_project, name='add_project'),
    path('notifications/', views.view_notifications, name='view_notifications'),


    path('report/<int:report_id>/view/', views.view_report, name='view_report'),
    path('report/<int:report_id>/resubmit/', views.resubmit_report, name='resubmit_report'),
    path('investigator/notifications/', views.investigator_notifications, name='investigator_notifications'),
    path('submit-report/<int:project_id>/', views.submit_report, name='submit_report'),

    
        # You can add more paths here as you develop more views
]




