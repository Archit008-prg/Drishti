import re

def main():
    path = r'f:\Drishti\Drishti\backend\dashboard\models.py'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add Team model
    team_model = '''
class Team(models.Model):
    name = models.CharField(max_length=255)
    manager = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='managed_teams')
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='teams')
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.name

'''
    if 'class Team(models.Model):' not in content:
        content = content.replace('class ChatMessage(models.Model):', team_model + 'class ChatMessage(models.Model):')

    # 2. Modify ChatMessage
    old_chat_message = r'''class ChatMessage\(models\.Model\):
    sender = models\.ForeignKey\(settings\.AUTH_USER_MODEL, on_delete=models\.CASCADE, related_name='sent_chats'\)
    receiver = models\.ForeignKey\(settings\.AUTH_USER_MODEL, on_delete=models\.CASCADE, related_name='received_chats'\)'''
    
    new_chat_message = '''class ChatMessage(models.Model):
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_chats')
    receiver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_chats', null=True, blank=True)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='messages', null=True, blank=True)'''

    if 'team = models.ForeignKey(Team' not in content:
        content = re.sub(old_chat_message, new_chat_message, content)
        # Update __str__ of ChatMessage
        old_str = r'''    def __str__\(self\):
        return f"\{self\.sender\.username\} -> \{self\.receiver\.username\}: \{self\.message\[:30\]\}"'''
        new_str = '''    def __str__(self):
        if self.team:
            return f"{self.sender.username} -> {self.team.name}: {self.message[:30]}"
        return f"{self.sender.username} -> {self.receiver.username if self.receiver else 'None'}: {self.message[:30]}"'''
        content = re.sub(old_str, new_str, content)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
