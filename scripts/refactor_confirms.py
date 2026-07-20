import re

def main():
    path = r'f:\Drishti\Drishti\frontend\src\App.jsx'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. State for ConfirmDialog
    confirm_state = '''  const [confirmDialog, setConfirmDialog] = useState({ show: false, message: '', onConfirm: null });
  const confirmAction = (message, onConfirm) => {
    setConfirmDialog({ show: true, message, onConfirm });
  };
'''
    if 'const [confirmDialog' not in content:
        content = content.replace('  const [toast, setToast]', confirm_state + '\n  const [toast, setToast]')

    # 2. handleEktaDeleteDoc
    content = re.sub(
        r'  const handleEktaDeleteDoc = async \(docId\) => \{\s+if \(!window\.confirm\("Delete this document\?"\)\) return;',
        '  const handleEktaDeleteDoc = async (docId) => {',
        content
    )
    content = content.replace('onClick={() => handleEktaDeleteDoc(doc.id)}', 'onClick={() => confirmAction("Delete this document?", () => handleEktaDeleteDoc(doc.id))}')

    # 3. handleClearEktaHistory
    content = re.sub(
        r'  const handleClearEktaHistory = \(\) => \{\s+if \(!window\.confirm\("Clear this Ekta AI chat history\?"\)\) return;',
        '  const handleClearEktaHistory = () => {',
        content
    )
    content = content.replace('onClick={handleClearEktaHistory}', 'onClick={() => confirmAction("Clear this Ekta AI chat history?", handleClearEktaHistory)}')

    # 4. handleDeleteChatMessage
    content = re.sub(
        r'  const handleDeleteChatMessage = async \(msgId\) => \{\s+if \(!window\.confirm\("Delete this message\?"\)\) return;',
        '  const handleDeleteChatMessage = async (msgId) => {',
        content
    )
    content = content.replace('onClick={() => handleDeleteChatMessage(msg.id)}', 'onClick={() => confirmAction("Delete this message?", () => handleDeleteChatMessage(msg.id))}')

    # 5. handleClearConversation
    content = re.sub(
        r'  const handleClearConversation = async \(userId\) => \{\s+if \(!window\.confirm\("Are you sure you want to delete this entire conversation\? This action cannot be undone\."\)\) return;',
        '  const handleClearConversation = async (userId) => {\n    setActiveThreadUser(null);',
        content
    )
    content = content.replace('onClick={() => handleClearConversation(activeThreadUser.id)}', 'onClick={() => confirmAction("Are you sure you want to delete this entire conversation? This action cannot be undone.", () => handleClearConversation(activeThreadUser.id))}')

    # 6. handleDeleteProject
    # Since we already rewrote handleDeleteProject earlier, it might not have window.confirm inside anymore if we didn't include it. Wait, I wrote `window.confirm` in my previous script? Let's check what's currently in `handleDeleteProject`.
    # Let's just blindly replace it if it's there.
    
    old_proj_del = r'''  const handleDeleteProject = async \(id\) => \{
    if \(window\.confirm\("WARNING: Are you sure you want to permanently delete this project\? This action cannot be undone\."\)\) \{
      try \{
        const res = await fetch\(`\$\{API_BASE\}/api/projects/\$\{id\}/delete/`, \{
          method: 'POST',
          headers: \{ 'Authorization': `Bearer \$\{token\}` \}
        \}\);
        if \(res\.ok\) \{
          showToast\('Project deleted successfully\.', 'success'\);
          setManagerTab\('projects'\);
          fetchProjects\(\);
        \} else \{
          const data = await res\.json\(\);
          showToast\(`Backend Error: \$\{data\.error \|\| 'Failed to delete'\}\`, "danger"\);
        \}
      \} catch \(e\) \{
        console\.error\(e\);
        showToast\('Network error while deleting project', "danger"\);
      \}
    \}
  \};'''

    new_proj_del = '''  const handleDeleteProject = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${id}/delete/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Project deleted successfully.', 'success');
        setManagerTab('projects');
        fetchProjects();
      } else {
        const data = await res.json();
        showToast(`Backend Error: ${data.error || 'Failed to delete'}`, "danger");
      }
    } catch (e) {
      console.error(e);
      showToast('Network error while deleting project', "danger");
    }
  };'''

    if 'window.confirm("WARNING: Are you sure' in content:
        content = re.sub(old_proj_del, new_proj_del, content)
        content = content.replace('onClick={() => handleDeleteProject(project.id)}', 'onClick={() => confirmAction("WARNING: Are you sure you want to permanently delete this project? This action cannot be undone.", () => handleDeleteProject(project.id))}')
        content = content.replace('onClick={() => handleDeleteProject(selectedProject.id)}', 'onClick={() => confirmAction("WARNING: Are you sure you want to permanently delete this project? This action cannot be undone.", () => handleDeleteProject(selectedProject.id))}')


    # 7. Add ConfirmDialog UI
    modal_ui = '''      {confirmDialog.show && (
        <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
      )}
      {confirmDialog.show && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content bg-dark text-white border-secondary">
              <div className="modal-header border-bottom border-secondary">
                <h5 className="modal-title text-warning"><i className="bi bi-exclamation-triangle-fill me-2"></i>Confirmation Required</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setConfirmDialog({ show: false, message: '', onConfirm: null })}></button>
              </div>
              <div className="modal-body">
                <p>{confirmDialog.message}</p>
              </div>
              <div className="modal-footer border-top border-secondary">
                <button type="button" className="btn btn-secondary" onClick={() => setConfirmDialog({ show: false, message: '', onConfirm: null })}>Cancel</button>
                <button type="button" className="btn btn-danger" onClick={() => {
                  if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                  setConfirmDialog({ show: false, message: '', onConfirm: null });
                }}>Confirm Action</button>
              </div>
            </div>
          </div>
        </div>
      )}'''

    if 'Confirmation Required' not in content:
        content = content.replace('{toast.show && (', modal_ui + '\n      {toast.show && (')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    main()
