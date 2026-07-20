import re

def main():
    path = r'f:\Drishti\Drishti\backend\dashboard\api.py'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # The error is that strings like `f"Hello,\n\nThe...` became literal newlines.
    # So we have:
    # f"Hello,
    # 
    # A new report has been submitted by the investigator for project '{project.title}'.
    # Please review it on the dashboard."
    
    # Let's replace `f"Hello,\n` with `f"""Hello,\n` and the end quote with `"""`
    
    # 1. Report Submitted
    old_report = """f"Hello,

A new report has been submitted by the investigator for project '{project.title}'.
Please review it on the dashboard.\""""
    
    new_report = 'f"""Hello,\\n\\nA new report has been submitted by the investigator for project \'{project.title}\'.\\nPlease review it on the dashboard."""'
    content = content.replace(old_report, new_report)

    # 2. Project Cancelled
    old_cancel = """f"Hello,

The project '{title}' you were assigned to has been deleted or cancelled by the manager.\""""
    new_cancel = 'f"""Hello,\\n\\nThe project \'{title}\' you were assigned to has been deleted or cancelled by the manager."""'
    content = content.replace(old_cancel, new_cancel)
    
    # 3. Project Updated
    old_update = """f"Hello,

The project '{project.title}' ({project.project_code}) has been updated by the manager.
Please check the portal for new details.\""""
    new_update = 'f"""Hello,\\n\\nThe project \'{project.title}\' ({project.project_code}) has been updated by the manager.\\nPlease check the portal for new details."""'
    content = content.replace(old_update, new_update)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    main()
