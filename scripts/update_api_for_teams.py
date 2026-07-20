import re

def main():
    path = r'f:\Drishti\Drishti\backend\dashboard\api.py'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    old_api = r'''@api_view\(\['POST'\]\)
@permission_classes\(\[IsAuthenticated\]\)
def api_create_team\(request\):
    if not request\.user\.is_staff:
        return Response\(\{'error': 'Only managers can create teams'\}, status=403\)
    name = request\.data\.get\('name'\)
    if not name:
        return Response\(\{'error': 'Name is required'\}, status=400\)
    team = Team\.objects\.create\(name=name, manager=request\.user\)
    team\.members\.add\(request\.user\)
    return Response\(\{'id': team\.id, 'name': team\.name\}\)'''

    new_api = '''@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_create_team(request):
    if not request.user.is_staff:
        return Response({'error': 'Only managers can create teams'}, status=403)
    name = request.data.get('name')
    if not name:
        return Response({'error': 'Name is required'}, status=400)
        
    team = Team.objects.create(name=name, manager=request.user)
    team.members.add(request.user)
    
    # Process optional initial members
    member_ids = request.data.get('member_ids', [])
    if member_ids and isinstance(member_ids, list):
        members = User.objects.filter(id__in=member_ids)
        for member in members:
            team.members.add(member)
            
    return Response({'id': team.id, 'name': team.name})'''

    content = re.sub(old_api, new_api, content)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
