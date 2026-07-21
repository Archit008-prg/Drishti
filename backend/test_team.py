
from django.test import Client
from django.contrib.auth import get_user_model
import json
from dashboard.models import Team
User = get_user_model()
archit = User.objects.get(username='archit')
from rest_framework_simplejwt.tokens import RefreshToken
token = str(RefreshToken.for_user(archit).access_token)

import urllib.request
req = urllib.request.Request('http://127.0.0.1:8000/api/teams/create/', 
    data=json.dumps({'name': 'Test Team From Shell', 'member_ids': []}).encode('utf-8'),
    headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'})
try:
    with urllib.request.urlopen(req) as response:
        print('Status:', response.status)
        print('Response:', response.read().decode())
except urllib.error.HTTPError as e:
    print('HTTP Error:', e.code)
    print('Response:', e.read().decode())
except Exception as e:
    print('Error:', e)

print('Teams for archit:', archit.managed_teams.count())
