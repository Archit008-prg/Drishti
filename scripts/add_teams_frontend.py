import re

def main():
    path = r'f:\Drishti\Drishti\frontend\src\App.jsx'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. State
    state_old = "const [chatThreads, setChatThreads] = useState([]);"
    state_new = """const [chatThreads, setChatThreads] = useState([]);
  const [teams, setTeams] = useState([]);
  const [activeTeam, setActiveTeam] = useState(null);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [showInviteMember, setShowInviteMember] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');"""
    if 'const [teams, setTeams] = useState' not in content:
        content = content.replace(state_old, state_new)

    # 2. fetchTeams API Call
    fetch_old = """const fetchChatConversations = async () => {"""
    fetch_new = """const fetchTeams = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/teams/`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
      }
    } catch (err) { console.error(err); }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/teams/create/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newTeamName })
      });
      if (res.ok) {
        setNewTeamName('');
        setShowCreateTeam(false);
        fetchTeams();
      }
    } catch (err) { console.error(err); }
  };

  const handleInviteToTeam = async (teamId) => {
    if (!inviteEmail.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/teams/${teamId}/add_member/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ email: inviteEmail })
      });
      if (res.ok) {
        setInviteEmail('');
        setShowInviteMember(false);
        fetchTeams();
        showToast("Invitation sent successfully!");
      }
    } catch (err) { console.error(err); }
  };

  const fetchChatConversations = async () => {"""
    if 'const fetchTeams = async () => {' not in content:
        content = content.replace(fetch_old, fetch_new)

    # Add fetchTeams to useEffects where fetchChatConversations is called
    content = content.replace("fetchChatConversations();\n        }", "fetchChatConversations();\n          fetchTeams();\n        }")
    content = content.replace("fetchChatConversations();\n    }", "fetchChatConversations();\n      fetchTeams();\n    }")

    # 3. Handle Send Message
    send_old = r'''const handleSendLiveMessage = async \(e\) => \{
    e\.preventDefault\(\);
    if \(!newMessage\.trim\(\) \|\| !activeThreadUser\) return;

    const textToSend = newMessage\.trim\(\);
    setNewMessage\(''\);

    try \{
      const res = await fetch\(`\$\{API_BASE\}/api/chat/send/`, \{
        method: 'POST',
        headers: \{
          'Content-Type': 'application/json',
          'Authorization': `Bearer \$\{token\}`
        \},
        body: JSON\.stringify\(\{
          receiver_id: activeThreadUser\.id,
          message: textToSend
        \}\)
      \}\);
      if \(res\.ok\) \{
        const msg = await res\.json\(\);
        setChatMessages\(\(prev\) => \[\.\.\.prev, msg\]\);
        fetchChatConversations\(\);
      \}
    \} catch \(err\) \{
      console\.error\('Error sending message:', err\);
    \}
  \};'''

    send_new = '''const handleSendLiveMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || (!activeThreadUser && !activeTeam)) return;

    const textToSend = newMessage.trim();
    setNewMessage('');

    try {
      const payload = { message: textToSend };
      if (activeTeam) payload.team_id = activeTeam.id;
      else payload.receiver_id = activeThreadUser.id;

      const res = await fetch(`${API_BASE}/api/chat/send/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const msg = await res.json();
        setChatMessages((prev) => [...prev, msg]);
        fetchChatConversations();
        fetchTeams();
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };'''
    content = re.sub(send_old, send_new, content)

    # Modify fetchChatMessages to handle team fetching
    fetch_msgs_old = r'''const fetchChatMessages = async \(userId\) => \{
    if \(!userId\) return;
    try \{
      const res = await fetch\(`\$\{API_BASE\}/api/chat/messages/\?with_user_id=\$\{userId\}`,'''
    
    fetch_msgs_new = '''const fetchChatMessages = async (userId, teamId = null) => {
    if (!userId && !teamId) return;
    try {
      const url = teamId 
        ? `${API_BASE}/api/chat/messages/?team_id=${teamId}`
        : `${API_BASE}/api/chat/messages/?with_user_id=${userId}`;
      const res = await fetch(url,'''
    content = re.sub(fetch_msgs_old, fetch_msgs_new, content)

    # 4. Inject Teams UI into Live Chats
    sidebar_team_ui = '''<div className="chat-active-header p-2 text-center small fw-bold border-bottom border-secondary d-flex justify-content-between align-items-center">
                          <span>Teams / Groups</span>
                          {isStaff && (
                            <button className="btn btn-sm btn-outline-cyan py-0 px-1" onClick={() => setShowCreateTeam(!showCreateTeam)}>+</button>
                          )}
                        </div>
                        {showCreateTeam && (
                          <div className="p-2 border-bottom border-secondary">
                            <input type="text" className="form-control form-control-sm bg-dark text-white border-secondary mb-1" placeholder="Team Name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
                            <button className="btn btn-sm btn-cyan w-100" onClick={handleCreateTeam}>Create</button>
                          </div>
                        )}
                        <div className="list-group list-group-flush mb-2">
                          {teams.map(t => (
                            <button
                              key={t.id}
                              type="button"
                              className={`list-group-item list-group-item-action border-0 d-flex justify-content-between align-items-center text-start ${activeTeam?.id === t.id ? 'bg-primary bg-opacity-25 text-white' : 'text-muted'}`}
                              onClick={() => {
                                setActiveThreadUser(null);
                                setActiveTeam(t);
                                fetchChatMessages(null, t.id);
                              }}
                            >
                              <div>
                                <i className="bi bi-people-fill me-2 text-cyan"></i>
                                {t.name}
                              </div>
                            </button>
                          ))}
                        </div>
                        <div className="chat-active-header p-2 text-center small fw-bold">Active Threads</div>'''
    
    # Replace the Manager Active Threads Header
    content = content.replace('<div className="chat-active-header p-2 text-center small fw-bold">Active Threads</div>', sidebar_team_ui)

    # Replace chat header to show active team
    header_old = r'''<h5 className="mb-0 fw-bold">
                              \{activeThreadUser \? `Chat with \$\{activeThreadUser\.username\}` : 'Select a conversation'\}
                            </h5>'''
    header_new = '''<h5 className="mb-0 fw-bold">
                              {activeTeam ? `Team Chat: ${activeTeam.name}` : (activeThreadUser ? `Chat with ${activeThreadUser.username}` : 'Select a conversation')}
                            </h5>'''
    content = re.sub(header_old, header_new, content)

    # Show Add Member button inside chat if team is active and user is manager
    add_member_ui = '''{activeTeam && activeTeam.manager_username === authUsername && (
                              <button className="btn btn-sm btn-outline-light ms-2" onClick={() => setShowInviteMember(!showInviteMember)}>
                                <i className="bi bi-person-plus"></i> Invite
                              </button>
                            )}'''
    content = content.replace('<button type="button" className="btn-close btn-close-white"', add_member_ui + '\n<button type="button" className="btn-close btn-close-white"')

    # Add the invite email input area just below the chat header if showInviteMember is true
    invite_area = '''{showInviteMember && activeTeam && (
                            <div className="p-2 bg-dark border-bottom border-secondary d-flex gap-2">
                              <input type="email" className="form-control form-control-sm bg-black text-white border-secondary" placeholder="Enter email address..." value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                              <button className="btn btn-sm btn-cyan" onClick={() => handleInviteToTeam(activeTeam.id)}>Send Invite</button>
                            </div>
                          )}'''
    content = content.replace('className="chat-messages-container', invite_area + '\nclassName="chat-messages-container')

    # Also handle the sender display in group chat (showing who sent what message)
    # Inside the map:
    msg_sender_old = r'''<span className="small opacity-50 mb-1 d-block">
                                      \{new Date\(msg\.timestamp\)\.toLocaleTimeString\(\[\]\, \{ hour: '2-digit', minute: '2-digit' \}\)\}
                                    </span>'''
    msg_sender_new = '''<span className="small opacity-50 mb-1 d-block">
                                      {msg.sender_username !== authUsername && <strong className="me-2 text-white">{msg.sender_username}</strong>}
                                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>'''
    content = re.sub(msg_sender_old, msg_sender_new, content)


    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
