import re

def main():
    app_css = r'f:\Drishti\Drishti\frontend\src\App.css'
    with open(app_css, 'a', encoding='utf-8') as f:
        f.write('''
/* WhatsApp Chat Redesign Styles */
.wa-list-item:hover {
  background-color: #202c33 !important;
}
.wa-active-item {
  background-color: #2a3942 !important;
}
.wa-bubble:hover .delete-msg-btn {
  opacity: 1 !important;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.2);
  border-radius: 10px;
}
''')

    app_jsx = r'f:\Drishti\Drishti\frontend\src\App.jsx'
    with open(app_jsx, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add chatSearch state
    state_anchor = "const [allUsers, setAllUsers] = useState([]);"
    if "const [chatSearch, setChatSearch] = useState('');" not in content:
        content = content.replace(state_anchor, state_anchor + "\n  const [chatSearch, setChatSearch] = useState('');")

    # The WhatsApp Layout Template
    wa_layout = '''              {<REPLACE_TAB> === 'live-chats' && (
                <div className="card card-glass mb-4 shadow-lg border-0" style={{ overflow: 'hidden', height: '80vh' }}>
                  <div className="d-flex h-100">
                    
                    {/* LEFT SIDEBAR */}
                    <div className="d-flex flex-column border-end border-secondary" style={{ width: '350px', background: '#111b21', zIndex: 5 }}>
                      
                      {/* Sidebar Header */}
                      <div className="p-3 d-flex justify-content-between align-items-center" style={{ background: '#202c33' }}>
                        <h5 className="mb-0 text-white fw-bold"><i className="bi bi-chat-dots-fill text-success me-2"></i>Chats</h5>
                        <div className="d-flex gap-2">
                          {isStaff && (
                            <button className="btn btn-sm btn-outline-secondary text-white border-0" title="Create Group" onClick={() => setShowCreateTeam(!showCreateTeam)}>
                              <i className="bi bi-people-fill"></i>
                            </button>
                          )}
                          <div className="dropdown">
                            <button className="btn btn-sm btn-outline-secondary text-white border-0 dropdown-toggle" type="button" data-bs-toggle="dropdown" title="New Chat">
                              <i className="bi bi-plus-lg"></i>
                            </button>
                            <ul className="dropdown-menu dropdown-menu-dark shadow-sm dropdown-menu-end" style={{ maxHeight: '200px', overflowY: 'auto', backgroundColor: '#202c33' }}>
                              {allUsers.map(u => (
                                <li key={u.user_id}>
                                  <button className="dropdown-item text-white" onClick={() => {
                                    setActiveTeam(null);
                                    setActiveThreadUser({ id: u.user_id, username: u.username });
                                    setChatMessages([]);
                                  }}>{u.username}</button>
                                </li>
                              ))}
                              {allUsers.length === 0 && <li><span className="dropdown-item text-muted">No users found</span></li>}
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Search Bar */}
                      <div className="p-2" style={{ background: '#111b21' }}>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text bg-dark border-0 text-muted"><i className="bi bi-search"></i></span>
                          <input type="text" className="form-control bg-dark border-0 text-white shadow-none" placeholder="Search or start new chat" value={chatSearch} onChange={e => setChatSearch(e.target.value)} />
                        </div>
                      </div>

                      {/* Create Team Form (Toggleable) */}
                      {showCreateTeam && isStaff && (
                        <div className="p-3 border-bottom border-secondary" style={{ background: '#202c33' }}>
                          <input type="text" className="form-control form-control-sm bg-dark text-white border-secondary mb-2" placeholder="Team Name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
                          <label className="text-white small mb-1">Select Members:</label>
                          <div className="mb-2 custom-scrollbar" style={{ maxHeight: '100px', overflowY: 'auto' }}>
                            {allUsers.map(u => (
                              <div key={u.user_id} className="form-check">
                                <input className="form-check-input" type="checkbox" value={u.user_id} id={`m-team-cb-${u.user_id}`} checked={newTeamMembers.includes(u.user_id)} onChange={e => {
                                  if (e.target.checked) setNewTeamMembers([...newTeamMembers, u.user_id]);
                                  else setNewTeamMembers(newTeamMembers.filter(id => id !== u.user_id));
                                }} />
                                <label className="form-check-label text-white small" htmlFor={`m-team-cb-${u.user_id}`}>{u.username}</label>
                              </div>
                            ))}
                          </div>
                          <button className="btn btn-sm btn-success w-100 fw-bold" onClick={handleCreateTeam}>Confirm Create</button>
                        </div>
                      )}

                      {/* Chat Threads List */}
                      <div className="flex-grow-1 overflow-auto custom-scrollbar">
                        
                        {/* Teams */}
                        {teams.filter(t => t.name.toLowerCase().includes(chatSearch.toLowerCase())).map(t => (
                          <div key={t.id} className={`p-3 d-flex align-items-center border-bottom border-secondary wa-list-item ${activeTeam?.id === t.id ? 'wa-active-item' : ''}`} style={{ cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => {
                            setActiveThreadUser(null);
                            setActiveTeam(t);
                            fetchChatMessages(null, t.id);
                          }}>
                            <div className="wa-avatar bg-success text-white fw-bold d-flex align-items-center justify-content-center me-3" style={{ width: '45px', height: '45px', borderRadius: '50%', fontSize: '1.2rem' }}>
                              <i className="bi bi-people-fill"></i>
                            </div>
                            <div className="flex-grow-1 text-truncate">
                              <div className="d-flex justify-content-between align-items-center">
                                <strong className="text-white fs-6">{t.name}</strong>
                              </div>
                              <span className="text-muted small text-truncate d-block">Team Group Chat</span>
                            </div>
                          </div>
                        ))}

                        {/* Direct Messages */}
                        {chatThreads.filter(m => (m.username || '').toLowerCase().includes(chatSearch.toLowerCase())).map(thread => (
                          <div key={thread.user_id} className={`p-3 d-flex align-items-center border-bottom border-secondary wa-list-item ${activeThreadUser?.id === thread.user_id ? 'wa-active-item' : ''}`} style={{ cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => {
                            setActiveThreadUser({ id: thread.user_id, username: thread.username });
                            fetchChatMessages(thread.user_id);
                          }}>
                            <div className="wa-avatar bg-secondary text-white fw-bold d-flex align-items-center justify-content-center me-3 text-uppercase" style={{ width: '45px', height: '45px', borderRadius: '50%', fontSize: '1.2rem' }}>
                              {(thread.username || 'U').charAt(0)}
                            </div>
                            <div className="flex-grow-1 text-truncate">
                              <div className="d-flex justify-content-between align-items-center mb-1">
                                <strong className="text-white fs-6">{thread.username}</strong>
                                {thread.latest_timestamp && (
                                  <span className="text-muted" style={{ fontSize: '0.75rem' }}>{new Date(thread.latest_timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                )}
                              </div>
                              <div className="d-flex justify-content-between align-items-center">
                                <span className="text-muted small text-truncate flex-grow-1 me-2">{thread.latest_message || 'Start conversation...'}</span>
                                {thread.unread_count > 0 && <span className="badge rounded-pill" style={{ background: '#00a884' }}>{thread.unread_count}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                        {chatThreads.length === 0 && teams.length === 0 && (
                          <div className="text-center p-4 text-muted small">No active chats found.</div>
                        )}
                      </div>
                    </div>

                    {/* RIGHT MAIN CHAT */}
                    <div className="flex-grow-1 d-flex flex-column position-relative wa-bg-pattern" style={{ background: '#0b141a' }}>
                      
                      {activeThreadUser || activeTeam ? (
                        <>
                          {/* Chat Header */}
                          <div className="p-2 d-flex justify-content-between align-items-center shadow-sm" style={{ background: '#202c33', zIndex: 10 }}>
                            <div className="d-flex align-items-center">
                              <div className={`wa-avatar text-white fw-bold d-flex align-items-center justify-content-center me-3 text-uppercase ${activeTeam ? 'bg-success' : 'bg-secondary'}`} style={{ width: '40px', height: '40px', borderRadius: '50%', fontSize: '1rem' }}>
                                {activeTeam ? <i className="bi bi-people-fill"></i> : activeThreadUser.username.charAt(0)}
                              </div>
                              <div>
                                <h6 className="text-white mb-0 fw-bold">{activeTeam ? activeTeam.name : activeThreadUser.username}</h6>
                                <span className="text-muted" style={{ fontSize: '0.8rem' }}>{activeTeam ? 'Group' : 'Online'}</span>
                              </div>
                            </div>
                            <div className="d-flex align-items-center gap-3">
                              {activeThreadUser && (
                                <button className="btn btn-sm text-muted fs-5 py-0 px-2 border-0 bg-transparent" title="Clear Conversation" onClick={() => { if (window.confirm("Are you sure you want to delete this entire conversation?")) handleClearConversation(activeThreadUser.id); }}>
                                  <i className="bi bi-trash3"></i>
                                </button>
                              )}
                              {activeTeam && activeTeam.manager_username === username && (
                                <button className="btn btn-sm text-muted fs-5 py-0 px-2 border-0 bg-transparent" onClick={() => setShowInviteMember(!showInviteMember)}>
                                  <i className="bi bi-person-plus-fill"></i>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Chat Body */}
                          <div className="flex-grow-1 p-4 overflow-auto custom-scrollbar chat-history-pane d-flex flex-column gap-2" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat', opacity: 0.8 }}>
                            {chatMessages.map((msg, idx) => {
                              const isMe = msg.sender_username === username;
                              return (
                                <div key={idx} className={`d-flex ${isMe ? 'justify-content-end' : 'justify-content-start'}`}>
                                  <div className="px-3 py-2 shadow-sm wa-bubble" style={{ 
                                    background: isMe ? '#005c4b' : '#202c33', 
                                    color: '#e9edef',
                                    borderRadius: '7.5px',
                                    borderTopRightRadius: isMe ? '0px' : '7.5px',
                                    borderTopLeftRadius: isMe ? '7.5px' : '0px',
                                    maxWidth: '75%',
                                    position: 'relative',
                                    paddingBottom: '20px'
                                  }}>
                                    {activeTeam && !isMe && <div className="small fw-bold mb-1" style={{ color: '#53bdeb', fontSize: '0.8rem' }}>{msg.sender_username}</div>}
                                    <div style={{ fontSize: '0.95rem', wordWrap: 'break-word', whiteSpace: 'pre-wrap' }}>{msg.message}</div>
                                    
                                    <div className="d-flex align-items-center position-absolute bottom-0 end-0 mb-1 me-2 gap-1" style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)' }}>
                                      <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                      {isMe && <i className={`bi bi-check2-all ${msg.is_read ? 'text-info' : ''}`} style={{ fontSize: '0.9rem' }}></i>}
                                    </div>

                                    {isMe && (
                                      <button type="button" className="btn btn-link p-0 position-absolute top-0 start-0 ms-1 mt-1 text-muted delete-msg-btn" style={{ fontSize: '0.75rem', opacity: 0 }} onClick={() => handleDeleteLiveMessage(msg.id)}>
                                        <i className="bi bi-x"></i>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                            {chatMessages.length === 0 && (
                              <div className="d-flex justify-content-center mt-3">
                                <div className="badge rounded-pill fw-normal" style={{ background: '#182229', color: '#8696a0' }}>Today</div>
                              </div>
                            )}
                          </div>

                          {/* Chat Input */}
                          <form className="p-3 d-flex align-items-center gap-3 w-100" style={{ background: '#202c33' }} onSubmit={handleSendLiveMessage}>
                            <button type="button" className="btn btn-link text-muted p-0 fs-4 text-decoration-none"><i className="bi bi-emoji-smile"></i></button>
                            <button type="button" className="btn btn-link text-muted p-0 fs-4 text-decoration-none"><i className="bi bi-paperclip"></i></button>
                            <input type="text" className="form-control rounded-pill border-0 text-white shadow-none px-3 py-2 flex-grow-1" style={{ background: '#2a3942' }} placeholder="Type a message" value={newMessage} onChange={e => setNewMessage(e.target.value)} />
                            {newMessage.trim() ? (
                              <button type="submit" className="btn btn-link text-success p-0 fs-4"><i className="bi bi-send-fill"></i></button>
                            ) : (
                              <button type="button" className="btn btn-link text-muted p-0 fs-4"><i className="bi bi-mic"></i></button>
                            )}
                          </form>
                        </>
                      ) : (
                        <div className="d-flex flex-column align-items-center justify-content-center h-100 text-center" style={{ color: '#8696a0' }}>
                          <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="wa" style={{ width: '80px', opacity: 0.2, filter: 'grayscale(100%)', marginBottom: '20px' }} />
                          <h4 className="fw-light">Drishti Web</h4>
                          <p className="small">Select a conversation or start a new chat<br/>to begin exchanging encrypted messages.</p>
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              )}'''

    # Split lines to find exact bounds
    lines = content.splitlines(True)
    m_start = -1
    m_end = -1
    i_start = -1
    i_end = -1

    for i, line in enumerate(lines):
        if "managerTab === 'live-chats'" in line and m_start == -1:
            m_start = i
        if "managerTab === 'ekta'" in line and m_end == -1:
            m_end = i
        if "investigatorTab === 'live-chats'" in line and i_start == -1:
            i_start = i
        if "investigatorTab === 'ekta'" in line and i_end == -1:
            i_end = i

    # Replace Investigator block first (since it's lower)
    if i_start != -1 and i_end != -1:
        new_lines = lines[:i_start] + [wa_layout.replace('<REPLACE_TAB>', 'investigatorTab') + '\n'] + lines[i_end:]
        lines = new_lines

    # Replace Manager block
    if m_start != -1 and m_end != -1:
        new_lines = lines[:m_start] + [wa_layout.replace('<REPLACE_TAB>', 'managerTab') + '\n'] + lines[m_end:]
        lines = new_lines

    with open(app_jsx, 'w', encoding='utf-8') as f:
        f.writelines(lines)

    # 3. Add auto-scroll logic to useEffect
    with open(app_jsx, 'r', encoding='utf-8') as f:
        content = f.read()

    scroll_effect = '''  useEffect(() => {
    const pane = document.querySelector('.chat-history-pane');
    if (pane) {
      pane.scrollTop = pane.scrollHeight;
    }
  }, [chatMessages]);

  '''
    if "const pane = document.querySelector('.chat-history-pane');" not in content:
        content = content.replace("const handleSendLiveMessage", scroll_effect + "const handleSendLiveMessage")

    with open(app_jsx, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
