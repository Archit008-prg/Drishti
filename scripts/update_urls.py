import re

def main():
    path = r'f:\Drishti\Drishti\backend\dashboard\urls.py'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the imports and add the new ones
    if 'api_get_teams' not in content:
        old_import = r'(api_get_chat_conversations,)'
        new_import = r'\1 api_get_teams, api_create_team, api_add_team_member,'
        content = re.sub(old_import, new_import, content)

        urls = '''
    path('api/teams/', api_get_teams, name='api_get_teams'),
    path('api/teams/create/', api_create_team, name='api_create_team'),
    path('api/teams/<int:team_id>/add_member/', api_add_team_member, name='api_add_team_member'),
'''
        # Insert into urlpatterns
        content = content.replace("path('api/chat/conversations/', api_get_chat_conversations, name='api_chat_conversations'),", 
                                  "path('api/chat/conversations/', api_get_chat_conversations, name='api_chat_conversations')," + urls)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
