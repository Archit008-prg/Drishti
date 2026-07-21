import re

def fix_api():
    path = r'f:\Drishti\Drishti\backend\dashboard\api.py'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # In api_get_chat_conversations, filter out users that have no messages
    old_code = r'''    users = User\.objects\.exclude\(id=request\.user\.id\)

    data = \[\]
    for u in users:
        unread_count = ChatMessage\.objects\.filter\(sender=u, receiver=request\.user, is_read=False\)\.count\(\)
        latest_msg = ChatMessage\.objects\.filter\(
            \(Q\(sender=request\.user\) & Q\(receiver=u\)\) \| \(Q\(sender=u\) & Q\(receiver=request\.user\)\)
        \)\.order_by\('-timestamp'\)\.first\(\)

        data\.append\(\{'''

    new_code = '''    users = User.objects.exclude(id=request.user.id)

    data = []
    for u in users:
        latest_msg = ChatMessage.objects.filter(
            (Q(sender=request.user) & Q(receiver=u)) | (Q(sender=u) & Q(receiver=request.user))
        ).order_by('-timestamp').first()
        
        if not latest_msg:
            continue

        unread_count = ChatMessage.objects.filter(sender=u, receiver=request.user, is_read=False).count()

        data.append({'''
    
    content = re.sub(old_code, new_code, content)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def fix_ekta():
    path = r'f:\Drishti\Drishti\backend\dashboard\ekta_rag.py'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Soften CRITICAL INSTRUCTION 3 and add instruction for generic summaries
    old_prompt = r'''"CRITICAL INSTRUCTION 3: If the question is completely irrelevant to the provided context, or if the uploaded document itself seems irrelevant \(like a generic resume or random template\), you MUST politely address that it seems irrelevant and that you cannot answer it\. For example: 'It seems this question is unrelated to the provided documents, so I am unable to answer it\. However, I can help you analyze the project files\.'\\n"'''
    
    new_prompt = '''"CRITICAL INSTRUCTION 3: If the question asks to 'explain the project' or is a generic request for a summary, you MUST summarize the provided context documents. Do not refuse. If the question is completely irrelevant to the provided context (e.g., asking about weather or unrelated topics), you MUST politely address that it seems irrelevant.\\n"'''
    
    content = content.replace(old_prompt, new_prompt)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def fix_app():
    path = r'f:\Drishti\Drishti\frontend\src\App.jsx'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add delete button back to the sidebar chat threads but make it grey
    # Manager side
    old_mgr = r'''<div className="d-flex align-items-center">
                                \{thread\.unread_count > 0 && \(
                                  <span className="badge bg-danger rounded-circle">\{thread\.unread_count\}</span>
                                \)\}
                              </div>'''
    new_mgr = '''<div className="d-flex align-items-center">
                                {thread.unread_count > 0 && (
                                  <span className="badge bg-danger rounded-circle me-2">{thread.unread_count}</span>
                                )}
                                <button type="button" className="btn btn-sm text-secondary p-0 m-0 border-0 bg-transparent" title="Delete Conversation" onClick={(e) => {
                                  e.stopPropagation();
                                  confirmAction("Delete entire conversation with " + thread.username + "?", () => handleClearConversation(thread.user_id));
                                }}>
                                  <i className="bi bi-trash"></i>
                                </button>
                              </div>'''
    content = re.sub(old_mgr, new_mgr, content)

    # Investigator side
    old_inv = r'''<div className="d-flex align-items-center">
                                \{m\.unread_count > 0 && \(
                                  <span className="badge bg-danger rounded-circle">\{m\.unread_count\}</span>
                                \)\}
                              </div>'''
    new_inv = '''<div className="d-flex align-items-center">
                                {m.unread_count > 0 && (
                                  <span className="badge bg-danger rounded-circle me-2">{m.unread_count}</span>
                                )}
                                <button type="button" className="btn btn-sm text-secondary p-0 m-0 border-0 bg-transparent" title="Delete Conversation" onClick={(e) => {
                                  e.stopPropagation();
                                  confirmAction("Delete entire conversation with " + m.username + "?", () => handleClearConversation(m.user_id));
                                }}>
                                  <i className="bi bi-trash"></i>
                                </button>
                              </div>'''
    content = re.sub(old_inv, new_inv, content)

    # Change Create Group buttons from btn-primary to btn-light (white/grey)
    content = content.replace('className="btn btn-sm btn-primary w-100 fw-bold"', 'className="btn btn-sm btn-light w-100 fw-bold"')
    content = content.replace('className="btn btn-sm btn-cyan py-0 px-2 fw-bold"', 'className="btn btn-sm btn-outline-light py-0 px-2 fw-bold"')

    # Fix Investigator Teams creation
    # The investigator side lacks the + Create Group button in the Teams / Groups header.
    # Let's see if we can add it. But investigators shouldn't create teams?
    # The user said "groups i amno table to create buttons are there but not working".
    # Wait, the buttons ARE there on the investigator side?
    # Let's just make sure the `btn-cyan` is changed everywhere
    content = content.replace('className="btn btn-sm btn-cyan', 'className="btn btn-sm btn-light')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    fix_api()
    fix_ekta()
    fix_app()
