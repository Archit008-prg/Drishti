from django.urls import path
from . import views, api

urlpatterns = [
    # Template Views
    path('', views.admin_dashboard, name='admin_dashboard'),
    path('project/<int:project_id>/detail/', views.project_detail, name='project_detail'),
    path('add/', views.add_project, name='add_project'),
    path('manager/login/', views.manager_login, name='manager_login'),
    path('manager/signup/', views.manager_signup, name='manager_signup'),
    path('notifications/', views.view_notifications, name='view_notifications'),
    path('notification/<int:notification_id>/read/', views.mark_notification_read, name='mark_notification_read'),
    path('report/<int:report_id>/view/', views.view_report, name='view_report'),
    path('report/<int:report_id>/review/', views.manager_review_report, name='manager_review_report'),
    path('report/<int:report_id>/resubmit/', views.resubmit_report, name='resubmit_report'),
    path('investigator/notifications/', views.investigator_notifications, name='investigator_notifications'),
    path('submit-report/<int:project_id>/', views.submit_report, name='submit_report'),

    # API Endpoints
    path('api/login/', api.api_login, name='api_login'),
    path('api/signup/', api.api_signup, name='api_signup'),
    path('api/projects/', api.api_projects_list, name='api_projects_list'),
    path('api/projects/<int:project_id>/', api.api_project_detail, name='api_project_detail'),
    path('api/investigators/', api.api_investigators_list, name='api_investigators_list'),
    path('api/projects/add/', api.api_add_project, name='api_add_project'),
    path('api/projects/<int:project_id>/submit-report/', api.api_submit_report, name='api_submit_report'),
    path('api/reports/<int:report_id>/review/', api.api_review_report, name='api_review_report'),
    path('api/notifications/', api.api_notifications, name='api_notifications'),
    path('api/notifications/<int:notification_id>/read/', api.api_mark_notification_read, name='api_mark_notification_read'),
    path('api/chat/messages/', api.api_get_chat_messages, name='api_get_chat_messages'),
    path('api/chat/send/', api.api_send_chat_message, name='api_send_chat_message'),
    path('api/chat/conversations/', api.api_get_chat_conversations, name='api_get_chat_conversations'),
    path('api/chat/managers/', api.api_get_managers, name='api_get_managers'),
    path('api/projects/<int:project_id>/update/', api.api_update_project, name='api_update_project'),
    path('api/projects/<int:project_id>/delete/', api.api_delete_project, name='api_delete_project'),
]




