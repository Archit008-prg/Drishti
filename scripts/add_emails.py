import re

def main():
    path = r'f:\Drishti\Drishti\backend\dashboard\api.py'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Fix api_login role check
    login_old = r'''def api_login\(request\):
    username = request\.data\.get\('username'\)
    password = request\.data\.get\('password'\)
    user = authenticate\(username=username, password=password\)
    if user is not None:'''
    
    login_new = '''def api_login(request):
    username = request.data.get('username')
    password = request.data.get('password')
    requested_is_staff = request.data.get('is_staff')
    user = authenticate(username=username, password=password)
    
    if user is not None:
        if requested_is_staff is not None and user.is_staff != requested_is_staff:
            return Response({'error': 'Unauthorized role. Please login with correct account type.'}, status=403)'''
    
    content = re.sub(login_old, login_new, content)

    # 2. Add email to api_update_project
    update_old = r'''        elif '@' in str\(assignee_input\):
            user_match = User\.objects\.filter\(email__iexact=assignee_input\)\.first\(\)
            if user_match:
                project\.assigned_investigator = user_match
                project\.assigned_email = user_match\.email
            else:
                project\.assigned_investigator = None
                project\.assigned_email = None
        else:
            user_match = User\.objects\.filter\(username__iexact=assignee_input\)\.first\(\)
            if user_match:
                project\.assigned_investigator = user_match
                project\.assigned_email = user_match\.email
            else:
                project\.assigned_investigator = None
                project\.assigned_email = None
        
    project\.save\(\)
    return Response\(\{'success': True\}\)'''
    
    update_new = '''        elif '@' in str(assignee_input):
            user_match = User.objects.filter(email__iexact=assignee_input).first()
            if user_match:
                project.assigned_investigator = user_match
                project.assigned_email = user_match.email
            else:
                project.assigned_investigator = None
                project.assigned_email = None
        else:
            user_match = User.objects.filter(username__iexact=assignee_input).first()
            if user_match:
                project.assigned_investigator = user_match
                project.assigned_email = user_match.email
            else:
                project.assigned_investigator = None
                project.assigned_email = None
        
    project.save()
    
    if project.assigned_email:
        def send_update_email():
            try:
                from django.core.mail import send_mail
                from django.conf import settings
                send_mail(
                    f"Project Updated: {project.title}",
                    f"Hello,\\n\\nThe project '{project.title}' ({project.project_code}) has been updated by the manager.\\nPlease check the portal for new details.",
                    settings.DEFAULT_FROM_EMAIL,
                    [project.assigned_email],
                    fail_silently=True,
                )
            except:
                pass
        import threading
        threading.Thread(target=send_update_email).start()
        
    return Response({'success': True})'''
    
    content = re.sub(update_old, update_new, content)

    # 3. Add email to api_delete_project
    delete_old = r'''def api_delete_project\(request, project_id\):
    if not request\.user\.is_staff:
        return Response\(\{'error': 'Unauthorized'\}, status=403\)
    project = get_object_or_404\(Project, id=project_id\)
    project\.delete\(\)
    return Response\(\{'success': True\}\)'''
    
    delete_new = '''def api_delete_project(request, project_id):
    if not request.user.is_staff:
        return Response({'error': 'Unauthorized'}, status=403)
    project = get_object_or_404(Project, id=project_id)
    assigned_email = project.assigned_email
    title = project.title
    project.delete()
    
    if assigned_email:
        def send_delete_email():
            try:
                from django.core.mail import send_mail
                from django.conf import settings
                send_mail(
                    f"Project Cancelled: {title}",
                    f"Hello,\\n\\nThe project '{title}' you were assigned to has been deleted or cancelled by the manager.",
                    settings.DEFAULT_FROM_EMAIL,
                    [assigned_email],
                    fail_silently=True,
                )
            except:
                pass
        import threading
        threading.Thread(target=send_delete_email).start()
        
    return Response({'success': True})'''
    
    content = re.sub(delete_old, delete_new, content)

    # 4. Add email to api_submit_report
    report_old = r'''    project\.report_submitted = True
    project\.report_resubmit_requested = False
    project\.save\(\)
    
    return Response\(\{'success': True\}\)'''
    
    report_new = '''    project.report_submitted = True
    project.report_resubmit_requested = False
    project.save()
    
    manager_email = project.created_by.email if project.created_by and project.created_by.email else None
    if manager_email:
        def send_report_email():
            try:
                from django.core.mail import send_mail
                from django.conf import settings
                send_mail(
                    f"Report Submitted: {project.title}",
                    f"Hello,\\n\\nA new report has been submitted by the investigator for project '{project.title}'.\\nPlease review it on the dashboard.",
                    settings.DEFAULT_FROM_EMAIL,
                    [manager_email],
                    fail_silently=True,
                )
            except:
                pass
        import threading
        threading.Thread(target=send_report_email).start()
        
    return Response({'success': True})'''
    
    content = re.sub(report_old, report_new, content)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
