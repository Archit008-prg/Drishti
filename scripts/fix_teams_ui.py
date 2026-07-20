import re

def main():
    path = r'f:\Drishti\Drishti\frontend\src\App.jsx'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Rename Secure Chat Center (Live) to Conversation mode
    content = content.replace('Secure Chat Center (Live)', 'Conversation mode')

    # 2. Remove Active Threads text headers
    content = content.replace('<div className="chat-active-header p-2 text-center small fw-bold">Active Threads</div>', '')

    # 3. Enhance Create Team + button so it's not camouflaged and works properly
    old_create_btn = '<button className="btn btn-sm btn-outline-cyan py-0 px-1" onClick={() => setShowCreateTeam(!showCreateTeam)}>+</button>'
    new_create_btn = '<button className="btn btn-sm btn-cyan py-0 px-2 fw-bold" title="Create Group" onClick={() => setShowCreateTeam(!showCreateTeam)}><i className="bi bi-plus-lg"></i> Create Group</button>'
    content = content.replace(old_create_btn, new_create_btn)

    # 4. Fix Manager Side Chat Threads map to include Delete Conversation button
    old_manager_thread = r'''                          \{chatThreads\.map\(\(thread\) => \(
                            <button
                              key=\{thread\.user_id\}
                              type="button"
                              className=\{`list-group-item list-group-item-action border-0 d-flex justify-content-between align-items-center text-start \$\{activeThreadUser\?\.id === thread\.user_id \? 'bg-primary bg-opacity-25 text-white' : 'text-muted'\}`\}
                              onClick=\{\(\) => \{
                                setActiveThreadUser\(\{ id: thread\.user_id, username: thread\.username \}\);
                                fetchChatMessages\(thread\.user_id\);
                              \}\}
                            >
                              <div className="text-truncate" style=\{\{ maxWidth: '80%' \}\}>
                                <strong className="d-block text-white">\{thread\.username\}</strong>
                                <span className="small text-muted text-truncate d-block">
                                  \{thread\.latest_message \|\| 'Start conversation\.\.\.'\}
                                </span>
                              </div>
                              \{thread\.unread_count > 0 && \(
                                <span className="badge bg-danger rounded-circle">\{thread\.unread_count\}</span>
                              \)\}
                            </button>'''

    new_manager_thread = '''                          {chatThreads.map((thread) => (
                            <div
                              key={thread.user_id}
                              className={`list-group-item list-group-item-action border-0 d-flex justify-content-between align-items-center text-start ${activeThreadUser?.id === thread.user_id ? 'bg-primary bg-opacity-25 text-white' : 'text-muted'}`}
                              style={{ cursor: 'pointer' }}
                            >
                              <div className="text-truncate flex-grow-1" onClick={() => {
                                setActiveThreadUser({ id: thread.user_id, username: thread.username });
                                fetchChatMessages(thread.user_id);
                              }}>
                                <strong className="d-block text-white">{thread.username}</strong>
                                <span className="small text-muted text-truncate d-block">
                                  {thread.latest_message || 'Start conversation...'}
                                </span>
                              </div>
                              <div className="d-flex align-items-center">
                                {thread.unread_count > 0 && (
                                  <span className="badge bg-danger rounded-circle me-2">{thread.unread_count}</span>
                                )}
                                <button type="button" className="btn btn-sm text-danger p-0 m-0 border-0 bg-transparent" title="Delete Conversation" onClick={(e) => {
                                  e.stopPropagation();
                                  confirmAction("Delete entire conversation with " + thread.username + "?", () => handleClearConversation(thread.user_id));
                                }}>
                                  <i className="bi bi-x-circle-fill"></i>
                                </button>
                              </div>
                            </div>'''
    content = re.sub(old_manager_thread, new_manager_thread, content)

    # 5. Fix Investigator Side Chat Threads map to include Delete Conversation button
    old_invest_thread = r'''                          \{chatThreads\.map\(\(m\) => \(
                            <button
                              key=\{m\.user_id\}
                              type="button"
                              className=\{`list-group-item list-group-item-action border-0 d-flex justify-content-between align-items-center text-start \$\{activeThreadUser\?\.id === m\.user_id \? 'bg-primary bg-opacity-25 text-white' : 'text-muted'\}`\}
                              onClick=\{\(\) => \{
                                setActiveThreadUser\(\{ id: m\.user_id, username: m\.username \}\);
                                fetchChatMessages\(m\.user_id\);
                              \}\}
                            >
                              <div className="text-truncate" style=\{\{ maxWidth: '80%' \}\}>
                                <strong className="d-block text-white">\{m\.username\}</strong>
                                <span className="small text-muted text-truncate d-block">
                                  \{m\.latest_message \|\| \(m\.is_staff \? 'Manager Account' : 'Investigator Account'\)\}
                                </span>
                              </div>
                              \{m\.unread_count > 0 && \(
                                <span className="badge bg-danger rounded-circle">\{m\.unread_count\}</span>
                              \)\}
                            </button>'''

    new_invest_thread = '''                          {chatThreads.map((m) => (
                            <div
                              key={m.user_id}
                              className={`list-group-item list-group-item-action border-0 d-flex justify-content-between align-items-center text-start ${activeThreadUser?.id === m.user_id ? 'bg-primary bg-opacity-25 text-white' : 'text-muted'}`}
                              style={{ cursor: 'pointer' }}
                            >
                              <div className="text-truncate flex-grow-1" onClick={() => {
                                setActiveThreadUser({ id: m.user_id, username: m.username });
                                fetchChatMessages(m.user_id);
                              }}>
                                <strong className="d-block text-white">{m.username}</strong>
                                <span className="small text-muted text-truncate d-block">
                                  {m.latest_message || (m.is_staff ? 'Manager Account' : 'Investigator Account')}
                                </span>
                              </div>
                              <div className="d-flex align-items-center">
                                {m.unread_count > 0 && (
                                  <span className="badge bg-danger rounded-circle me-2">{m.unread_count}</span>
                                )}
                                <button type="button" className="btn btn-sm text-danger p-0 m-0 border-0 bg-transparent" title="Delete Conversation" onClick={(e) => {
                                  e.stopPropagation();
                                  confirmAction("Delete entire conversation with " + m.username + "?", () => handleClearConversation(m.user_id));
                                }}>
                                  <i className="bi bi-x-circle-fill"></i>
                                </button>
                              </div>
                            </div>'''
    content = re.sub(old_invest_thread, new_invest_thread, content)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
