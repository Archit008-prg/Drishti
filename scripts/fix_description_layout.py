import re

def main():
    with open(r'f:\Drishti\Drishti\frontend\src\App.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add state
    if 'const [comfortReadText' not in content:
        content = content.replace('  const [toast, setToast]', '  const [toast, setToast] = useState({ show: false, message: \'\', type: \'success\' });\n  const [comfortReadText, setComfortReadText] = useState(null);')
        # Wait, if `const [toast, setToast] = useState...` is replaced by `...toast... \n const [comfortReadText...`
        # Let's just find `const [toast, setToast]` and put it after.
        content = re.sub(r'(const \[toast, setToast\] = useState\([^)]+\);)', r'\1\n  const [comfortReadText, setComfortReadText] = useState(null);', content)

    # 2. Add Modal UI
    modal_ui = '''      {comfortReadText !== null && (
        <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
      )}
      {comfortReadText !== null && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
            <div className="modal-content bg-dark text-white border-secondary">
              <div className="modal-header border-bottom border-secondary">
                <h5 className="modal-title"><i className="bi bi-book me-2"></i>Project Description</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setComfortReadText(null)}></button>
              </div>
              <div className="modal-body fs-5" style={{ lineHeight: '1.8' }}>
                <p style={{ whiteSpace: 'pre-wrap' }}>{comfortReadText}</p>
              </div>
              <div className="modal-footer border-top border-secondary">
                <button type="button" className="btn btn-secondary" onClick={() => setComfortReadText(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}'''
    
    if 'Project Description' not in content:
        content = content.replace('{toast.show && (', modal_ui + '\n      {toast.show && (')

    # 3. Add to Manager view
    manager_desc = '''                      <li className="list-group-item ps-0"><strong>Investigator:</strong> {selectedProject.assigned_investigator || '-'}</li>
                      {selectedProject.description && (
                        <li className="list-group-item ps-0">
                          <strong>Description:</strong>
                          <div style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} className="small mt-1 mb-0">
                            {selectedProject.description}
                          </div>
                          {selectedProject.description.length > 150 && (
                            <button className="btn btn-link btn-sm text-cyan p-0 mt-1" onClick={() => setComfortReadText(selectedProject.description)}>
                              Read Full Description <i className="bi bi-arrows-fullscreen ms-1"></i>
                            </button>
                          )}
                        </li>
                      )}'''
    content = content.replace('<li className="list-group-item ps-0"><strong>Investigator:</strong> {selectedProject.assigned_investigator || \'-\'}</li>', manager_desc)

    # 4. Update Investigator view
    inv_old_desc = r'''                      \{selectedProject\.description && \(
                        <li className="list-group-item ps-0">
                          <strong>Description:</strong>
                          <p className="small mt-1 mb-0">\{selectedProject\.description\}</p>
                        </li>
                      \)\}'''
    inv_new_desc = '''                      {selectedProject.description && (
                        <li className="list-group-item ps-0">
                          <strong>Description:</strong>
                          <div style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} className="small mt-1 mb-0">
                            {selectedProject.description}
                          </div>
                          {selectedProject.description.length > 150 && (
                            <button className="btn btn-link btn-sm text-cyan p-0 mt-1" onClick={() => setComfortReadText(selectedProject.description)}>
                              Read Full Description <i className="bi bi-arrows-fullscreen ms-1"></i>
                            </button>
                          )}
                        </li>
                      )}'''
    content = re.sub(inv_old_desc, inv_new_desc, content)

    # 5. Make Investigator Sidebar Sticky
    inv_sidebar = r'''\{/\* Investigator Sidebar Detail Card \*/\}
            \{\!\['ekta', 'live-chats', 'profile'\]\.includes\(investigatorTab\) && \(
              <div className="col-lg-4">'''
    inv_sidebar_new = '''{/* Investigator Sidebar Detail Card */}
            {!['ekta', 'live-chats', 'profile'].includes(investigatorTab) && (
              <div className="col-lg-4" style={{ position: 'sticky', top: '20px', alignSelf: 'start' }}>'''
    content = re.sub(inv_sidebar, inv_sidebar_new, content)

    with open(r'f:\Drishti\Drishti\frontend\src\App.jsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    main()
