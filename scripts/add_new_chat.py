import re
import os

def update_backend():
    # Update urls.py
    urls_path = r'f:\Drishti\Drishti\backend\dashboard\urls.py'
    with open(urls_path, 'r', encoding='utf-8') as f:
        urls = f.read()
    
    urls = urls.replace("path('api/managers/', api.api_get_managers, name='api_get_managers')", "path('api/users/', api.api_get_all_users, name='api_get_all_users')")
    with open(urls_path, 'w', encoding='utf-8') as f:
        f.write(urls)

    # Update api.py
    api_path = r'f:\Drishti\Drishti\backend\dashboard\api.py'
    with open(api_path, 'r', encoding='utf-8') as f:
        api = f.read()

    old_api = '''def api_get_managers(request):
    """
    List all accounts for users to text
    """
    managers = User.objects.exclude(id=request.user.id)
    data = [{
        'user_id': m.id,
        'username': m.username,
        'email': m.email
    } for m in managers]
    return Response(data)'''
    
    new_api = '''def api_get_all_users(request):
    """
    List all accounts for users to text
    """
    users = User.objects.exclude(id=request.user.id)
    data = [{
        'user_id': m.id,
        'username': m.username,
        'email': m.email
    } for m in users]
    return Response(data)'''

    api = api.replace(old_api, new_api)
    with open(api_path, 'w', encoding='utf-8') as f:
        f.write(api)

def update_frontend():
    app_path = r'f:\Drishti\Drishti\frontend\src\App.jsx'
    with open(app_path, 'r', encoding='utf-8') as f:
        app = f.read()

    # 1. Add state for allUsers
    state_anchor = "const [chatThreads, setChatThreads] = useState([]);"
    new_state = state_anchor + "\n  const [allUsers, setAllUsers] = useState([]);"
    app = app.replace(state_anchor, new_state)

    # 2. Add fetchAllUsers function
    fetch_anchor = "const fetchChatConversations = async () => {"
    new_fetch = '''const fetchAllUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/users/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setAllUsers(await res.json());
      }
    } catch (e) { console.error(e); }
  };

  ''' + fetch_anchor
    app = app.replace(fetch_anchor, new_fetch)

    # 3. Call fetchAllUsers on load
    use_effect_anchor = "fetchChatConversations();\n      fetchTeams();"
    new_use_effect = "fetchChatConversations();\n      fetchTeams();\n      fetchAllUsers();"
    app = app.replace(use_effect_anchor, new_use_effect)

    # 4. Add "Start New Chat" dropdown UI for Manager
    old_mgr_header = '''<h5 className="fw-bold mb-3"><i className="bi bi-chat-dots-fill text-cyan me-2"></i>Conversation mode</h5>'''
    new_mgr_header = '''<div className="d-flex justify-content-between align-items-center mb-3">
                            <h5 className="fw-bold mb-0"><i className="bi bi-chat-dots-fill text-cyan me-2"></i>Conversation mode</h5>
                            <div className="dropdown">
                              <button className="btn btn-sm btn-outline-cyan dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                <i className="bi bi-pencil-square"></i> New
                              </button>
                              <ul className="dropdown-menu dropdown-menu-dark shadow-sm" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                {allUsers.map(u => (
                                  <li key={u.user_id}>
                                    <button className="dropdown-item" onClick={() => {
                                      setActiveTeam(null);
                                      setActiveThreadUser({ id: u.user_id, username: u.username });
                                      setChatMessages([]);
                                    }}>{u.username}</button>
                                  </li>
                                ))}
                                {allUsers.length === 0 && <li><span className="dropdown-item text-muted">No users found</span></li>}
                              </ul>
                            </div>
                          </div>'''
    app = app.replace(old_mgr_header, new_mgr_header)

    # 5. Add "Start New Chat" dropdown UI for Investigator
    old_inv_header = '''<h5 className="fw-bold mb-3"><i className="bi bi-chat-dots-fill text-cyan me-2"></i>Conversation mode</h5>'''
    app = app.replace(old_inv_header, new_mgr_header) # It's exactly the same JSX!

    with open(app_path, 'w', encoding='utf-8') as f:
        f.write(app)

if __name__ == '__main__':
    update_backend()
    update_frontend()
