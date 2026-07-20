import re

def main():
    path = r'f:\Drishti\Drishti\backend\dashboard\api.py'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update imports
    if 'from .models import Project, ChatMessage, AuditLog, Team' not in content:
        content = content.replace('from .models import Project, ChatMessage, AuditLog', 'from .models import Project, ChatMessage, AuditLog, Team')

    # 2. Add Team API Endpoints
    team_api = '''
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_get_teams(request):
    """List all teams the user is a member of"""
    teams = request.user.teams.all() | Team.objects.filter(manager=request.user)
    teams = teams.distinct()
    data = []
    for t in teams:
        data.append({
            'id': t.id,
            'name': t.name,
            'manager_username': t.manager.username,
            'members': [m.username for m in t.members.all()]
        })
    return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_create_team(request):
    if not request.user.is_staff:
        return Response({'error': 'Only managers can create teams'}, status=403)
    name = request.data.get('name')
    if not name:
        return Response({'error': 'Name is required'}, status=400)
    team = Team.objects.create(name=name, manager=request.user)
    team.members.add(request.user)
    return Response({'id': team.id, 'name': team.name})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_add_team_member(request, team_id):
    team = get_object_or_404(Team, id=team_id)
    if team.manager != request.user:
        return Response({'error': 'Only the team manager can add members'}, status=403)
    
    email = request.data.get('email')
    username = request.data.get('username')
    
    if username:
        user = User.objects.filter(username=username).first()
        if user:
            team.members.add(user)
            return Response({'success': True, 'message': 'User added'})
            
    if email:
        user = User.objects.filter(email=email).first()
        if user:
            team.members.add(user)
            return Response({'success': True, 'message': 'User added via email'})
        else:
            # Send email invitation
            from django.core.mail import send_mail
            from django.conf import settings
            try:
                send_mail(
                    subject="Invitation to join Drishti Team",
                    message=f"You have been invited to join the team '{team.name}' on Drishti. Please create an account using this email address to access the team.",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[email],
                    fail_silently=True,
                )
                return Response({'success': True, 'message': 'Invitation email sent'})
            except:
                return Response({'success': False, 'error': 'Failed to send email'}, status=500)
    
    return Response({'error': 'Username or valid email required'}, status=400)

'''
    if 'def api_create_team' not in content:
        # insert before get_chat_messages
        content = content.replace('@permission_classes([IsAuthenticated])\ndef api_get_chat_messages(request):', team_api + '@permission_classes([IsAuthenticated])\ndef api_get_chat_messages(request):')

    # 3. Update api_get_chat_messages
    old_get_msg = r'''@permission_classes\(\[IsAuthenticated\]\)
def api_get_chat_messages\(request\):
    """
    Fetch message history between current user and target user
    """
    from django\.db\.models import Q
    with_user_id = request\.query_params\.get\('with_user_id'\)
    if not with_user_id:
        return Response\(\{'error': 'with_user_id is required'\}, status=400\)
    
    target_user = get_object_or_404\(User, id=with_user_id\)
    
    messages = ChatMessage\.objects\.filter\(
        \(Q\(sender=request\.user\) & Q\(receiver=target_user\)\) \|
        \(Q\(sender=target_user\) & Q\(receiver=request\.user\)\)
    \)\.order_by\('timestamp'\)
    
    # Mark messages received by current user from target as read
    ChatMessage\.objects\.filter\(sender=target_user, receiver=request\.user, is_read=False\)\.update\(is_read=True\)
    
    data = \[\]
    for msg in messages:
        data\.append\(\{
            'id': msg\.id,
            'sender_id': msg\.sender\.id,
            'sender_username': msg\.sender\.username,
            'receiver_id': msg\.receiver\.id,
            'receiver_username': msg\.receiver\.username,
            'message': msg\.message,
            'timestamp': msg\.timestamp\.isoformat\(\),
            'is_read': msg\.is_read
        \}\)
        
    return Response\(data\)'''

    new_get_msg = '''@permission_classes([IsAuthenticated])
def api_get_chat_messages(request):
    """
    Fetch message history between current user and target user or for a team
    """
    from django.db.models import Q
    with_user_id = request.query_params.get('with_user_id')
    team_id = request.query_params.get('team_id')
    
    if not with_user_id and not team_id:
        return Response({'error': 'with_user_id or team_id is required'}, status=400)
    
    if team_id:
        team = get_object_or_404(Team, id=team_id)
        if request.user not in team.members.all() and team.manager != request.user:
            return Response({'error': 'Not a member of this team'}, status=403)
        messages = ChatMessage.objects.filter(team=team).order_by('timestamp')
        
        data = []
        for msg in messages:
            data.append({
                'id': msg.id,
                'sender_id': msg.sender.id,
                'sender_username': msg.sender.username,
                'team_id': msg.team.id,
                'message': msg.message,
                'timestamp': msg.timestamp.isoformat(),
                'is_read': msg.is_read
            })
        return Response(data)
    else:
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
            
        return Response(data)'''

    content = re.sub(old_get_msg, new_get_msg, content)

    # 4. Update api_send_chat_message
    old_send_msg = r'''@api_view\(\['POST'\]\)
@permission_classes\(\[IsAuthenticated\]\)
def api_send_chat_message\(request\):
    """
    Send a new chat message
    """
    receiver_id = request\.data\.get\('receiver_id'\)
    message_text = request\.data\.get\('message'\)
    
    if not receiver_id or not message_text:
        return Response\(\{'error': 'receiver_id and message are required'\}, status=400\)
        
    receiver = get_object_or_404\(User, id=receiver_id\)
    
    msg = ChatMessage\.objects\.create\(
        sender=request\.user,
        receiver=receiver,
        message=message_text
    \)
    
    Notification\.objects\.create\(
        user=receiver,
        title="New Chat Message",
        message=f"You have a new message from \{request\.user\.username\}",
        notification_type="alert"
    \)
    
    return Response\(\{'success': True, 'message_id': msg\.id\}\)'''

    new_send_msg = '''@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_send_chat_message(request):
    """
    Send a new chat message
    """
    receiver_id = request.data.get('receiver_id')
    team_id = request.data.get('team_id')
    message_text = request.data.get('message')
    
    if not message_text or (not receiver_id and not team_id):
        return Response({'error': 'receiver_id/team_id and message are required'}, status=400)
        
    if team_id:
        team = get_object_or_404(Team, id=team_id)
        if request.user not in team.members.all() and team.manager != request.user:
            return Response({'error': 'Not a member of this team'}, status=403)
        msg = ChatMessage.objects.create(
            sender=request.user,
            team=team,
            message=message_text
        )
        return Response({'success': True, 'message_id': msg.id})
    else:
        receiver = get_object_or_404(User, id=receiver_id)
        msg = ChatMessage.objects.create(
            sender=request.user,
            receiver=receiver,
            message=message_text
        )
        
        Notification.objects.create(
            user=receiver,
            title="New Chat Message",
            message=f"You have a new message from {request.user.username}",
            notification_type="alert"
        )
        
        return Response({'success': True, 'message_id': msg.id})'''

    content = re.sub(old_send_msg, new_send_msg, content)


    # 5. Update api_get_chat_conversations
    old_get_conv = r'''def api_get_chat_conversations\(request\):
    """
    Return a list of all users with whom the current user can chat
    """
    from django\.db\.models import Q
    users = User\.objects\.exclude\(id=request\.user\.id\)

    data = \[\]
    for u in users:
        unread_count = ChatMessage\.objects\.filter\(sender=u, receiver=request\.user, is_read=False\)\.count\(\)
        latest_msg = ChatMessage\.objects\.filter\(
            \(Q\(sender=request\.user\) & Q\(receiver=u\)\) \| \(Q\(sender=u\) & Q\(receiver=request\.user\)\)
        \)\.order_by\('-timestamp'\)\.first\(\)

        data\.append\(\{
            'user_id': u\.id,
            'username': u\.username,
            'is_staff': u\.is_staff,
            'unread_count': unread_count,
            'latest_message': latest_msg\.message if latest_msg else '',
            'latest_timestamp': latest_msg\.timestamp\.isoformat\(\) if latest_msg else None
        \}\)

    data\.sort\(key=lambda x: x\['latest_timestamp'\] or '', reverse=True\)
    return Response\(data\)'''

    new_get_conv = '''def api_get_chat_conversations(request):
    """
    Return a list of users with whom the current user can chat, adhering to privacy rules.
    Privacy rules:
    - You must have a Manager-Investigator relationship on a project OR
    - You must be in the same Team.
    """
    from django.db.models import Q
    all_users = User.objects.exclude(id=request.user.id)
    
    # 1. Gather all teammates
    my_teams = request.user.teams.all() | Team.objects.filter(manager=request.user)
    my_teams = my_teams.distinct()
    teammate_ids = set()
    for t in my_teams:
        teammate_ids.add(t.manager.id)
        for m in t.members.all():
            teammate_ids.add(m.id)
            
    allowed_users = set(teammate_ids)
    
    # 2. Gather manager-investigator relationships
    if request.user.is_staff:
        # I am a manager, I can talk to investigators assigned to my projects
        projs = Project.objects.filter(created_by=request.user).exclude(assigned_investigator__isnull=True)
        for p in projs:
            allowed_users.add(p.assigned_investigator.id)
    else:
        # I am an investigator, I can talk to managers of projects assigned to me
        projs = Project.objects.filter(assigned_investigator=request.user).exclude(created_by__isnull=True)
        for p in projs:
            allowed_users.add(p.created_by.id)
            
    users = all_users.filter(id__in=allowed_users)

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
    return Response(data)'''
    
    content = re.sub(old_get_conv, new_get_conv, content)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
