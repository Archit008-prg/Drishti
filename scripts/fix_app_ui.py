import sys

try:
    with open('f:\\Drishti\\Drishti\\frontend\\src\\App.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Fix handleCreateTeam
    old_create_team = "  const handleCreateTeam = async () => {\n    if (!newTeamName.trim()) return;"
    new_create_team = "  const handleCreateTeam = async () => {\n    if (!newTeamName.trim()) {\n      alert('Please enter a Team Name before confirming.');\n      return;\n    }"
    content = content.replace(old_create_team, new_create_team)

    # Remove dummy icons
    dummy1 = '<button type="button" className="btn btn-link text-muted p-0 fs-4 text-decoration-none"><i className="bi bi-emoji-smile"></i></button>'
    dummy2 = '<button type="button" className="btn btn-link text-muted p-0 fs-4 text-decoration-none"><i className="bi bi-paperclip"></i></button>'
    
    dummy_mic = ''' : (
                              <button type="button" className="btn btn-link text-muted p-0 fs-4"><i className="bi bi-mic"></i></button>
                            )'''

    content = content.replace(dummy1, '')
    content = content.replace(dummy2, '')
    content = content.replace(dummy_mic, '')

    with open('f:\\Drishti\\Drishti\\frontend\\src\\App.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("Success")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
