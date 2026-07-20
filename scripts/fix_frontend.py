import re
import sys

def main():
    path = r'f:\Drishti\Drishti\frontend\src\App.jsx'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add Toast state and showToast function
    if 'const [toast, setToast]' not in content:
        toast_state = '''  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };
'''
        content = content.replace("const [authError, setAuthError] = useState('');", toast_state + "\n  const [authError, setAuthError] = useState('');")

    # 2. Add handleOpenAddProject to reset form
    if 'const handleOpenAddProject' not in content:
        reset_fn = '''  const handleOpenAddProject = () => {
    setProjectCode('');
    setProjectTitle('');
    setProjectDesc('');
    setPrincipalAgency('');
    setBudgetAmount('');
    setStartDate('');
    setScheduledCompletion('');
    setAssignedInvestigatorId('');
    setPiName('');
    setPcName('');
    setImplAgencies('');
    setProjectDocs([]);
    setManagerTab('add-project');
  };
'''
        content = content.replace("const handleCreateProject = async (e) => {", reset_fn + "\n  const handleCreateProject = async (e) => {")

    # 3. Replace alert() with showToast()
    content = content.replace("alert('Project created successfully!');", "showToast('Project created successfully!', 'success');")
    content = content.replace("alert('Project updated successfully!');", "showToast('Project updated successfully!', 'success');")
    content = content.replace("alert('Project deleted successfully.');", "showToast('Project deleted successfully.', 'success');")
    content = content.replace("alert('Report submitted successfully!');", "showToast('Report submitted successfully!', 'success');")
    content = content.replace("alert('Report reviewed successfully!');", "showToast('Report reviewed successfully!', 'success');")
    # Also replace any other literal alerts starting with alert(`Backend Error
    content = re.sub(r'alert\(`Backend Error([^`]+)`\);', r'showToast(`Backend Error\1`, "danger");', content)
    
    # 4. Hide stat cards on 'add-project'
    content = content.replace("!['ekta', 'live-chats', 'profile'].includes(managerTab)", "!['ekta', 'live-chats', 'profile', 'add-project', 'edit-project'].includes(managerTab)")

    # 5. Use handleOpenAddProject for sidebar button
    content = content.replace("onClick={() => setManagerTab('add-project')}", "onClick={handleOpenAddProject}")

    # 6. Render Toast UI
    toast_ui = '''
      {toast.show && (
        <div className={`toast-container position-fixed bottom-0 end-0 p-3`} style={{ zIndex: 1100 }}>
          <div className={`toast show align-items-center text-white bg-${toast.type} border-0`} role="alert" aria-live="assertive" aria-atomic="true">
            <div className="d-flex">
              <div className="toast-body">
                {toast.message}
              </div>
              <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setToast({ show: false, message: '', type: 'success' })}></button>
            </div>
          </div>
        </div>
      )}
'''
    if 'toast-container' not in content:
        content = content.replace("      {/* Manager's Assignment Quick View Popup & FAB */}", toast_ui + "\n      {/* Manager's Assignment Quick View Popup & FAB */}")

    # 7. Add Supporting Documents to Project Detail view
    docs_ui = '''
                    {selectedProject.supporting_documents && selectedProject.supporting_documents.length > 0 && (
                      <div className="bg-dark bg-opacity-35 p-3 rounded mb-3 border border-secondary border-opacity-20">
                        <h6 className="mb-2"><strong>Reference Documents</strong></h6>
                        <ul className="list-group list-group-flush bg-transparent">
                          {selectedProject.supporting_documents.map(doc => (
                            <li key={doc.id} className="list-group-item bg-transparent text-white px-0 py-1 border-0">
                              <i className="bi bi-file-earmark-pdf me-2 text-danger"></i>
                              <a href={`${API_BASE}${doc.url}`} target="_blank" rel="noreferrer" className="text-decoration-none text-white-75 hover-text-white">
                                {doc.filename}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
'''
    if 'Reference Documents' not in content:
        # Insert before "{selectedProject.report ? ("
        content = content.replace("{selectedProject.report ? (", docs_ui + "\n                    {selectedProject.report ? (")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
