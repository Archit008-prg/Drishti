import sys

with open('f:\\Drishti\\Drishti\\frontend\\src\\App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace WhatsApp specific colors and backgrounds with Drishti styles
content = content.replace("background: '#111b21'", "background: 'transparent'") 
content = content.replace("background: '#202c33'", "background: 'rgba(255, 255, 255, 0.03)'") 
content = content.replace("background: '#0b141a'", "background: 'rgba(0, 0, 0, 0.2)'")
content = content.replace('backgroundImage: \'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")\'', "backgroundImage: 'none'")
content = content.replace("background: isMe ? '#005c4b' : '#202c33'", "background: isMe ? 'rgba(139, 92, 246, 0.25)' : 'rgba(255, 255, 255, 0.05)'") 
content = content.replace("color: '#e9edef'", "color: '#fff'")
content = content.replace("color: '#53bdeb'", "color: '#a78bfa'")
content = content.replace("background: '#2a3942'", "background: 'rgba(255, 255, 255, 0.05)'")
content = content.replace("background: '#00a884'", "background: '#8b5cf6'")
content = content.replace("background: '#182229'", "background: 'rgba(255, 255, 255, 0.1)'")
content = content.replace("color: '#8696a0'", "color: '#adb5bd'")
content = content.replace("text-success", "text-info")
content = content.replace("bg-success", "bg-primary")

# Remove WhatsApp logo from placeholder
wa_logo = '<img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="wa" style={{ width: \'80px\', opacity: 0.2, filter: \'grayscale(100%)\', marginBottom: \'20px\' }} />'
content = content.replace(wa_logo, '<i className="bi bi-chat-dots" style={{ fontSize: \'4rem\', opacity: 0.2, marginBottom: \'15px\' }}></i>')

with open('f:\\Drishti\\Drishti\\frontend\\src\\App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

with open('f:\\Drishti\\Drishti\\backend\\dashboard\\api.py', 'r', encoding='utf-8') as f:
    api_content = f.read()

if 'Team' not in api_content.split('from .models import ')[1].split('\\n')[0]:
    api_content = api_content.replace('from .models import Project, Report, Notification, ChatMessage', 'from .models import Project, Report, Notification, ChatMessage, Team')
    with open('f:\\Drishti\\Drishti\\backend\\dashboard\\api.py', 'w', encoding='utf-8') as f:
        f.write(api_content)
        
print("Success")
