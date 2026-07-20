import re

def main():
    path = r'f:\Drishti\Drishti\frontend\src\App.jsx'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add newTeamMembers state
    if 'const [newTeamMembers, setNewTeamMembers]' not in content:
        content = content.replace("const [newTeamName, setNewTeamName] = useState('');", "const [newTeamName, setNewTeamName] = useState('');\n  const [newTeamMembers, setNewTeamMembers] = useState([]);")

    # 2. Update handleCreateTeam
    old_handle = r'''const handleCreateTeam = async \(\) => \{
    if \(!newTeamName\.trim\(\)\) return;
    try \{
      const res = await fetch\(`\$\{API_BASE\}/api/teams/create/`, \{
        method: 'POST',
        headers: \{ 'Content-Type': 'application/json', 'Authorization': `Bearer \$\{token\}` \},
        body: JSON\.stringify\(\{ name: newTeamName \}\)
      \}\);
      if \(res\.ok\) \{
        setNewTeamName\(''\);
        setShowCreateTeam\(false\);
        fetchTeams\(\);
      \}
    \} catch \(err\) \{ console\.error\(err\); \}
  \};'''
  
    new_handle = '''const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/teams/create/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newTeamName, member_ids: newTeamMembers })
      });
      if (res.ok) {
        setNewTeamName('');
        setNewTeamMembers([]);
        setShowCreateTeam(false);
        fetchTeams();
      }
    } catch (err) { console.error(err); }
  };'''
    content = re.sub(old_handle, new_handle, content)

    # 3. Update Create Team UI (For Manager)
    old_create_ui = r'''\{showCreateTeam && \(
                          <div className="p-2 border-bottom border-secondary">
                            <input type="text" className="form-control form-control-sm bg-dark text-white border-secondary mb-1" placeholder="Team Name" value=\{newTeamName\} onChange=\{e => setNewTeamName\(e\.target\.value\)\} />
                            <button className="btn btn-sm btn-cyan w-100" onClick=\{handleCreateTeam\}>Create</button>
                          </div>
                        \)\}'''
    
    new_create_ui = '''{showCreateTeam && (
                          <div className="p-2 border-bottom border-secondary bg-black">
                            <input type="text" className="form-control form-control-sm bg-dark text-white border-secondary mb-2" placeholder="Team Name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
                            <div className="mb-2" style={{ maxHeight: '100px', overflowY: 'auto' }}>
                              <small className="text-muted d-block mb-1">Select Members:</small>
                              {chatThreads.map(u => (
                                <div key={u.user_id} className="form-check form-check-sm" style={{ fontSize: '12px' }}>
                                  <input 
                                    className="form-check-input" 
                                    type="checkbox" 
                                    id={`check-${u.user_id}`} 
                                    checked={newTeamMembers.includes(u.user_id)}
                                    onChange={(e) => {
                                      if (e.target.checked) setNewTeamMembers([...newTeamMembers, u.user_id]);
                                      else setNewTeamMembers(newTeamMembers.filter(id => id !== u.user_id));
                                    }}
                                  />
                                  <label className="form-check-label text-white" htmlFor={`check-${u.user_id}`}>
                                    {u.username}
                                  </label>
                                </div>
                              ))}
                            </div>
                            <button className="btn btn-sm btn-primary w-100 fw-bold" onClick={handleCreateTeam}>Create Group</button>
                          </div>
                        )}'''
    content = re.sub(old_create_ui, new_create_ui, content)

    # 4. Remove sidebar trash buttons
    # Manager side
    old_mgr_trash = r'''<div className="d-flex align-items-center">
                                \{thread\.unread_count > 0 && \(
                                  <span className="badge bg-danger rounded-circle me-2">\{thread\.unread_count\}</span>
                                \)\}
                                <button type="button" className="btn btn-sm text-danger p-0 m-0 border-0 bg-transparent" title="Delete Conversation" onClick=\{\(e\) => \{
                                  e\.stopPropagation\(\);
                                  confirmAction\("Delete entire conversation with " \+ thread\.username \+ "\?", \(\) => handleClearConversation\(thread\.user_id\)\);
                                \}\}>
                                  <i className="bi bi-x-circle-fill"></i>
                                </button>
                              </div>'''
    new_mgr_trash = '''<div className="d-flex align-items-center">
                                {thread.unread_count > 0 && (
                                  <span className="badge bg-danger rounded-circle">{thread.unread_count}</span>
                                )}
                              </div>'''
    content = re.sub(old_mgr_trash, new_mgr_trash, content)

    # Investigator side
    old_inv_trash = r'''<div className="d-flex align-items-center">
                                \{m\.unread_count > 0 && \(
                                  <span className="badge bg-danger rounded-circle me-2">\{m\.unread_count\}</span>
                                \)\}
                                <button type="button" className="btn btn-sm text-danger p-0 m-0 border-0 bg-transparent" title="Delete Conversation" onClick=\{\(e\) => \{
                                  e\.stopPropagation\(\);
                                  confirmAction\("Delete entire conversation with " \+ m\.username \+ "\?", \(\) => handleClearConversation\(m\.user_id\)\);
                                \}\}>
                                  <i className="bi bi-x-circle-fill"></i>
                                </button>
                              </div>'''
    new_inv_trash = '''<div className="d-flex align-items-center">
                                {m.unread_count > 0 && (
                                  <span className="badge bg-danger rounded-circle">{m.unread_count}</span>
                                )}
                              </div>'''
    content = re.sub(old_inv_trash, new_inv_trash, content)

    # 5. Make active chat header clear conversation button more prominent
    content = content.replace('btn btn-sm btn-outline-danger py-0 px-2', 'btn btn-sm btn-danger py-0 px-2 fw-bold text-white')
    content = content.replace('<i className="bi bi-trash3"></i>', '<i className="bi bi-trash3"></i> Delete')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
