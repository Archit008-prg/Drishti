from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.contrib.auth import authenticate, get_user_model
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from django.conf import settings
from django.core.mail import send_mail
from .models import Project, Report, Notification, ChatMessage

User = get_user_model()

@api_view(['POST'])
@permission_classes([AllowAny])
def api_login(request):
    username = request.data.get('username')
    password = request.data.get('password')
    user = authenticate(username=username, password=password)
    if user is not None:
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'jwt_access': str(refresh.access_token),
            'jwt_refresh': str(refresh),
            'username': user.username,
            'is_staff': user.is_staff
        })
    return Response({'error': 'Invalid username or password'}, status=400)

@api_view(['POST'])
@permission_classes([AllowAny])
def api_signup(request):
    username = request.data.get('username')
    password = request.data.get('password')
    email = request.data.get('email', '')
    is_staff = request.data.get('is_staff', False)
    
    if not username or not password:
        return Response({'error': 'Username and password are required'}, status=400)
        
    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists'}, status=400)
        
    user = User.objects.create_user(username=username, password=password, email=email)
    if is_staff:
        user.is_staff = True
        user.save()
    else:
        # Check for projects assigned to this email address to claim them
        if email:
            projects_to_claim = Project.objects.filter(assigned_email__iexact=email, assigned_investigator__isnull=True)
            for p in projects_to_claim:
                p.assigned_investigator = user
                p.save()
        
    token, _ = Token.objects.get_or_create(user=user)
    from rest_framework_simplejwt.tokens import RefreshToken
    refresh = RefreshToken.for_user(user)
    return Response({
        'token': token.key,
        'jwt_access': str(refresh.access_token),
        'jwt_refresh': str(refresh),
        'username': user.username,
        'is_staff': user.is_staff
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_projects_list(request):
    if request.user.is_staff:
        projects = Project.objects.all().order_by('-start_date')
    else:
        projects = Project.objects.filter(assigned_investigator=request.user).order_by('-start_date')
        
    data = []
    for p in projects:
        # Get latest report status
        latest_report = p.project_reports.first()
        report_status = latest_report.status if latest_report else 'not_submitted'
        report_id = latest_report.id if latest_report else None
        
        data.append({
            'id': p.id,
            'project_code': p.project_code,
            'project_type': p.project_type,
            'title': p.title,
            'description': p.description,
            'principal_agency': p.principal_agency,
            'budget_amount': str(p.budget_amount) if p.budget_amount else None,
            'budget_unit': p.budget_unit,
            'start_date': p.start_date,
            'scheduled_completion': p.scheduled_completion,
            'status': p.status,
            'assigned_investigator': p.assigned_investigator.username if p.assigned_investigator else None,
            'assigned_email': p.assigned_email,
            'guideline_document_url': None,
            'report_status': report_status,
            'report_id': report_id
        })
    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_project_detail(request, project_id):
    if request.user.is_staff:
        project = get_object_or_404(Project, id=project_id)
    else:
        project = get_object_or_404(Project, id=project_id, assigned_investigator=request.user)
        
    # Get latest report if any
    latest_report = project.project_reports.first()
    report_data = None
    if latest_report:
        report_data = {
            'id': latest_report.id,
            'status': latest_report.status,
            'notes': latest_report.notes,
            'submitted_at': latest_report.submitted_at,
            'admin_comment': latest_report.admin_comment,
            'report_file_url': latest_report.report_file.url if latest_report.report_file else None,
            'filename': latest_report.filename
        }
        
    docs_data = []
    for d in project.supporting_documents.all():
        docs_data.append({
            'id': d.id,
            'filename': d.file.name.split('/')[-1],
            'url': d.file.url
        })
        
    data = {
        'id': project.id,
        'project_code': project.project_code,
        'project_type': project.project_type,
        'title': project.title,
        'description': project.description,
        'principal_agency': project.principal_agency,
        'budget_amount': str(project.budget_amount) if project.budget_amount else None,
        'budget_unit': project.budget_unit,
        'start_date': project.start_date,
        'scheduled_completion': project.scheduled_completion,
        'status': project.status,
        'project_investigator': project.project_investigator,
        'project_coordinator': project.project_coordinator,
        'implementing_agencies': project.implementing_agencies,
        'assigned_investigator': project.assigned_investigator.username if project.assigned_investigator else None,
        'assigned_email': project.assigned_email,
        'guideline_document_url': None,
        'report': report_data,
        'supporting_documents': docs_data
    }
    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_investigators_list(request):
    if not request.user.is_staff:
        return Response({'error': 'Unauthorized'}, status=403)
    investigators = User.objects.filter(is_staff=False)
    data = [{'id': u.id, 'username': u.username, 'email': u.email} for u in investigators]
    return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def api_add_project(request):
    if not request.user.is_staff:
        return Response({'error': 'Unauthorized'}, status=403)
        
    project_code = request.data.get('project_code')
    if not project_code:
        return Response({'error': 'Project code is required.'}, status=400)
    if Project.objects.filter(project_code=project_code).exists():
        return Response({'error': f'A project with code "{project_code}" already exists.'}, status=400)
    project_type = request.data.get('project_type')
    title = request.data.get('title')
    description = request.data.get('description', '')
    principal_agency = request.data.get('principal_agency')
    budget_amount = request.data.get('budget_amount')
    budget_unit = request.data.get('budget_unit', 'lakhs')
    start_date = request.data.get('start_date')
    scheduled_completion = request.data.get('scheduled_completion')
    status = request.data.get('status', 'ongoing')
    assignee_input = request.data.get('assigned_investigator')
    project_investigator = request.data.get('project_investigator', '')
    project_coordinator = request.data.get('project_coordinator', '')
    implementing_agencies = request.data.get('implementing_agencies', '')
    
    assigned_investigator = None
    assigned_email = None
    
    if assignee_input:
        if str(assignee_input).isdigit() and User.objects.filter(id=int(assignee_input)).exists():
            assigned_investigator = User.objects.get(id=int(assignee_input))
            assigned_email = assigned_investigator.email
        elif '@' in str(assignee_input):
            user_match = User.objects.filter(email__iexact=assignee_input).first()
            if user_match:
                assigned_investigator = user_match
                assigned_email = user_match.email
            else:
                assigned_email = assignee_input
                
    project = Project.objects.create(
        project_code=project_code,
        project_type=project_type,
        title=title,
        description=description,
        principal_agency=principal_agency,
        budget_amount=budget_amount if budget_amount else None,
        budget_unit=budget_unit,
        start_date=start_date,
        scheduled_completion=scheduled_completion,
        status=status,
        assigned_investigator=assigned_investigator,
        assigned_email=assigned_email,
        project_investigator=project_investigator,
        project_coordinator=project_coordinator,
        implementing_agencies=implementing_agencies,
        created_by=request.user
    )

    if assigned_email:
        subject = f"New Project Assignment: {project.title}"
        message = (
            f"Hello,\n\n"
            f"You have been assigned to the project '{project.title}' ({project.project_code}).\n"
            f"Please log in or sign up on the Drishti portal using this email to view the task details.\n\n"
            f"Project Link: http://localhost:5173/project/{project.id}\n\n"
            f"Regards,\nDrishti Team"
        )
        try:
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [assigned_email],
                fail_silently=False,
            )
        except Exception as e:
            print(f"Email failed: {e}")

    # Process uploaded documents
    docs = request.FILES.getlist('docs')
    if docs:
        from dashboard.ekta_models import SupportingDocument
        from dashboard import ekta_api, ekta_rag
        for doc in docs:
            saved_doc = SupportingDocument.objects.create(
                project=project,
                uploaded_by=request.user,
                file=doc
            )
            # Index into Ekta RAG immediately
            try:
                # Need to read the file again after saving, so we reset the pointer
                saved_doc.file.seek(0)
                text = ekta_api._extract_text_from_file(saved_doc.file, saved_doc.file.name)
                if text.strip():
                    ekta_rag.index_document(project.id, saved_doc.id, saved_doc.file.name, text)
            except Exception as e:
                print(f"Error indexing doc: {e}")

    return Response({'success': True, 'project_id': project.id})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
@transaction.atomic
def api_submit_report(request, project_id):
    project = get_object_or_404(Project, id=project_id, assigned_investigator=request.user)
    
    report_file = request.FILES.get('report_file')
    notes = request.data.get('notes', '')
    
    if not report_file:
        return Response({'error': 'No file uploaded'}, status=400)
        
    if not report_file.name.lower().endswith('.pdf'):
        return Response({'error': 'Only PDF files are allowed'}, status=400)
        
    # Check if report already exists
    report = project.project_reports.first()
    if report:
        report.report_file = report_file
        report.notes = notes
        report.status = 'submitted'
        report.save()
    else:
        report = Report.objects.create(
            project=project,
            investigator=request.user,
            report_file=report_file,
            notes=notes,
            status='submitted'
        )
        
    project.report_submitted = True
    project.report_resubmit_requested = False
    project.save()
    
    return Response({'success': True})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def api_review_report(request, report_id):
    if not request.user.is_staff:
        return Response({'error': 'Unauthorized'}, status=403)
        
    report = get_object_or_404(Report, id=report_id)
    action = request.data.get('action')
    admin_comment = request.data.get('admin_comment', '')
    
    if action == 'approve':
        report.status = 'approved'
        report.admin_comment = admin_comment
        report.save()

        # Auto-complete the project when report is approved
        report.project.report_approved = True
        report.project.report_resubmit_requested = False
        report.project.status = 'completed'
        report.project.actual_completion = timezone.now().date()
        report.project.save()
        
    elif action == 'reject':
        report.status = 'rejected'
        report.admin_comment = admin_comment
        report.save()
        
        report.project.report_approved = False
        report.project.save()
        
    elif action == 'resubmit':
        report.status = 'resubmit_requested'
        report.admin_comment = admin_comment
        report.save()
        
        report.project.report_resubmit_requested = True
        report.project.report_submitted = False
        report.project.report_approved = False
        report.project.save()
        
    else:
        return Response({'error': 'Invalid action'}, status=400)
        
    return Response({'success': True})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_notifications(request):
    notifications = Notification.objects.filter(user=request.user).order_by('-created_at')
    data = []
    for n in notifications:
        data.append({
            'id': n.id,
            'message': n.message,
            'is_read': n.is_read,
            'created_at': n.created_at,
            'notification_type': n.notification_type,
            'report_id': n.report.id if n.report else None
        })
    return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_mark_notification_read(request, notification_id):
    notification = get_object_or_404(Notification, id=notification_id, user=request.user)
    notification.is_read = True
    notification.save()
    return Response({'success': True})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_get_chat_messages(request):
    """
    Fetch message history between current user and target user
    """
    from django.db.models import Q
    with_user_id = request.query_params.get('with_user_id')
    if not with_user_id:
        return Response({'error': 'with_user_id is required'}, status=400)
    
    target_user = get_object_or_404(User, id=with_user_id)
    
    messages = ChatMessage.objects.filter(
        (Q(sender=request.user) & Q(receiver=target_user)) |
        (Q(sender=target_user) & Q(receiver=request.user))
    ).order_by('timestamp')
    
    # Mark messages received by current user from target as read
    ChatMessage.objects.filter(sender=target_user, receiver=request.user, is_read=False).update(is_read=True)
    
    data = []
    for msg in messages:
        data.append({
            'id': msg.id,
            'sender_id': msg.sender.id,
            'sender_username': msg.sender.username,
            'receiver_id': msg.receiver.id,
            'receiver_username': msg.receiver.username,
            'message': msg.message,
            'timestamp': msg.timestamp.isoformat(),
            'is_read': msg.is_read
        })
        
    return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_send_chat_message(request):
    """
    Send a new chat message
    """
    receiver_id = request.data.get('receiver_id')
    message_text = request.data.get('message')
    
    if not receiver_id or not message_text:
        return Response({'error': 'receiver_id and message are required'}, status=400)
        
    receiver = get_object_or_404(User, id=receiver_id)
    
    msg = ChatMessage.objects.create(
        sender=request.user,
        receiver=receiver,
        message=message_text
    )
    
    return Response({
        'id': msg.id,
        'sender_id': msg.sender.id,
        'sender_username': msg.sender.username,
        'receiver_id': msg.receiver.id,
        'receiver_username': msg.receiver.username,
        'message': msg.message,
        'timestamp': msg.timestamp.isoformat(),
        'is_read': msg.is_read
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_get_chat_conversations(request):
    """
    Return a list of users with whom the current user has chatted
    """
    from django.db.models import Q
    messages = ChatMessage.objects.filter(Q(sender=request.user) | Q(receiver=request.user))
    
    user_ids = set()
    for m in messages:
        if m.sender_id != request.user.id:
            user_ids.add(m.sender_id)
        if m.receiver_id != request.user.id:
            user_ids.add(m.receiver_id)
            
    users = User.objects.filter(id__in=user_ids)
    
    data = []
    for u in users:
        unread_count = ChatMessage.objects.filter(sender=u, receiver=request.user, is_read=False).count()
        latest_msg = ChatMessage.objects.filter(
            (Q(sender=request.user) & Q(receiver=u)) | (Q(sender=u) & Q(receiver=request.user))
        ).order_by('-timestamp').first()
        
        data.append({
            'user_id': u.id,
            'username': u.username,
            'is_staff': u.is_staff,
            'unread_count': unread_count,
            'latest_message': latest_msg.message if latest_msg else '',
            'latest_timestamp': latest_msg.timestamp.isoformat() if latest_msg else None
        })
        
    data.sort(key=lambda x: x['latest_timestamp'] or '', reverse=True)
    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_get_managers(request):
    """
    List all manager accounts (staff) for investigators to text
    """
    managers = User.objects.filter(is_staff=True)
    data = [{
        'user_id': m.id,
        'username': m.username,
        'email': m.email
    } for m in managers]
    return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_update_project(request, project_id):
    if not request.user.is_staff:
        return Response({'error': 'Unauthorized'}, status=403)
    project = get_object_or_404(Project, id=project_id)
    
    # Update status
    status = request.data.get('status')
    if status:
        if status not in [choice[0] for choice in Project.STATUS_CHOICES]:
            return Response({'error': 'Invalid status choice.'}, status=400)
        project.status = status
        
    # Update other fields
    title = request.data.get('title')
    if title:
        project.title = title
    description = request.data.get('description')
    if description is not None:
        project.description = description
    principal_agency = request.data.get('principal_agency')
    if principal_agency:
        project.principal_agency = principal_agency
    budget_amount = request.data.get('budget_amount')
    if budget_amount is not None:
        project.budget_amount = budget_amount if budget_amount else None
    budget_unit = request.data.get('budget_unit')
    if budget_unit:
        project.budget_unit = budget_unit
    start_date = request.data.get('start_date')
    if start_date:
        project.start_date = start_date
    scheduled_completion = request.data.get('scheduled_completion')
    if scheduled_completion:
        project.scheduled_completion = scheduled_completion
    project_investigator = request.data.get('project_investigator')
    if project_investigator is not None:
        project.project_investigator = project_investigator
    project_coordinator = request.data.get('project_coordinator')
    if project_coordinator is not None:
        project.project_coordinator = project_coordinator
    implementing_agencies = request.data.get('implementing_agencies')
    if implementing_agencies is not None:
        project.implementing_agencies = implementing_agencies
        
    project.save()
    return Response({'success': True})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_delete_project(request, project_id):
    if not request.user.is_staff:
        return Response({'error': 'Unauthorized'}, status=403)
    project = get_object_or_404(Project, id=project_id)
    project.delete()
    return Response({'success': True})
