import re

def main():
    with open(r'f:\Drishti\Drishti\frontend\src\App.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Ekta AI Context Project Select
    ekta_select = r'''          <select 
            className="form-select glass-input text-white" 
            value={selectedProject \? selectedProject\.id : ''}
            onChange=\{\(e\) => \{
              const p = projects\.find\(p => p\.id === parseInt\(e\.target\.value\)\);
              onSelectProject\(p \|\| null\);
            \}\}
          >
            <option value="" className="text-dark">-- Select Project --</option>
            \{projects\.map\(p => \(
              <option key=\{p\.id\} value=\{p\.id\} className="text-dark">\{p\.title\} \(\{p\.project_code\}\)</option>
            \)\)\}
          </select>'''
    
    ekta_new = '''          <CustomDropdown 
            value={selectedProject ? selectedProject.id : ''}
            onChange={(val) => {
              if (!val) { onSelectProject(null); return; }
              const p = projects.find(p => p.id === parseInt(val));
              onSelectProject(p || null);
            }}
            placeholder="-- Select Project --"
            options={[
              { value: '', label: '-- Select Project --' },
              ...projects.map(p => ({ value: p.id, label: `${p.title} (${p.project_code})` }))
            ]}
          />'''
    content = re.sub(ekta_select, ekta_new, content)

    # 2. Project Type Select
    type_select = r'''                          <select 
                            className="form-select bg-dark border-secondary text-white"
                            value=\{projectType\}
                            onChange=\{\(e\) => setProjectType\(e\.target\.value\)\}
                            required
                          >
                            <option value="S&T">Science & Technology</option>
                            <option value="R&D">Research & Development</option>
                          </select>'''
    
    type_new = '''                          <CustomDropdown
                            value={projectType}
                            onChange={(val) => setProjectType(val)}
                            options={[
                              { value: "S&T", label: "Science & Technology" },
                              { value: "R&D", label: "Research & Development" }
                            ]}
                          />'''
    content = re.sub(type_select, type_new, content)

    # 3. Project Status Select
    status_select = r'''                          <select 
                            className="form-select bg-dark border-secondary text-white"
                            value=\{projectStatus\}
                            onChange=\{\(e\) => setProjectStatus\(e\.target\.value\)\}
                            required
                          >
                            <option value="ongoing">Ongoing</option>
                            <option value="pending">Pending</option>
                            <option value="completed">Completed</option>
                            <option value="up_next">Up Next</option>
                          </select>'''
    
    status_new = '''                          <CustomDropdown
                            value={projectStatus}
                            onChange={(val) => setProjectStatus(val)}
                            options={[
                              { value: "ongoing", label: "Ongoing" },
                              { value: "pending", label: "Pending" },
                              { value: "completed", label: "Completed" },
                              { value: "up_next", label: "Up Next" }
                            ]}
                          />'''
    content = re.sub(status_select, status_new, content)

    # 4. Budget Unit Select
    budget_select = r'''                          <select 
                            className="form-select bg-dark border-secondary text-white"
                            value=\{budgetUnit\}
                            onChange=\{\(e\) => setBudgetUnit\(e\.target\.value\)\}
                          >
                            <option value="rupees">Rupees</option>
                            <option value="thousands">Thousands \(₹\)</option>
                            <option value="lakhs">Lakhs \(₹\)</option>
                            <option value="crores">Crores \(₹\)</option>
                          </select>'''
    
    budget_new = '''                          <CustomDropdown
                            value={budgetUnit}
                            onChange={(val) => setBudgetUnit(val)}
                            options={[
                              { value: "rupees", label: "Rupees" },
                              { value: "thousands", label: "Thousands (₹)" },
                              { value: "lakhs", label: "Lakhs (₹)" },
                              { value: "crores", label: "Crores (₹)" }
                            ]}
                          />'''
    content = re.sub(budget_select, budget_new, content)

    # 5. Update Project Status Select
    update_select = r'''                          <select 
                            className="form-select form-select-sm"
                            value=\{selectedProject\.status\}
                            onChange=\{\(e\) => handleUpdateProjectStatus\(selectedProject\.id, e\.target\.value\)\}
                          >
                            <option value="ongoing">Ongoing</option>
                            <option value="completed">Completed</option>
                            <option value="pending">Pending</option>
                            <option value="up_next">Up Next</option>
                          </select>'''
    
    update_new = '''                          <div style={{minWidth: '150px'}}><CustomDropdown
                            value={selectedProject.status}
                            onChange={(val) => handleUpdateProjectStatus(selectedProject.id, val)}
                            options={[
                              { value: "ongoing", label: "Ongoing" },
                              { value: "completed", label: "Completed" },
                              { value: "pending", label: "Pending" },
                              { value: "up_next", label: "Up Next" }
                            ]}
                          /></div>'''
    content = re.sub(update_select, update_new, content)

    # 6. Quick Select Project (Manager)
    quick_select_mgr = r'''                    <select 
                      className="form-select" 
                      onChange=\{\(e\) => \{
                        if \(e\.target\.value\) fetchProjectDetail\(e\.target\.value\);
                      \}\}
                      style=\{\{ background: 'rgba\(255,255,255,0\.05\)', color: '#fff', border: '1px solid rgba\(255,255,255,0\.1\)' \}\}
                    >
                      <option value="" style=\{\{ color: '#000' \}\}>-- Or quickly select a project here --</option>
                      \{projects\.map\(p => \(
                        <option key=\{p\.id\} value=\{p\.id\} style=\{\{ color: '#000' \}\}>
                          \{p\.project_code\} - \{p\.title\}
                        </option>
                      \)\)\}
                    </select>'''
    
    quick_new_mgr = '''                    <CustomDropdown
                      placeholder="-- Or quickly select a project here --"
                      value=""
                      onChange={(val) => {
                        if (val) fetchProjectDetail(val);
                      }}
                      options={[
                        { value: '', label: '-- Select a project --' },
                        ...projects.map(p => ({ value: p.id, label: `${p.project_code} - ${p.title}` }))
                      ]}
                    />'''
    content = re.sub(quick_select_mgr, quick_new_mgr, content)

    # 7. Quick Select Project (Investigator)
    quick_select_inv = r'''                    <select 
                      className="form-select" 
                      onChange=\{\(e\) => \{
                        if \(e\.target\.value\) fetchProjectDetail\(e\.target\.value\);
                      \}\}
                      style=\{\{ background: 'rgba\(255,255,255,0\.05\)', color: '#fff', border: '1px solid rgba\(255,255,255,0\.1\)' \}\}
                    >
                      <option value="" style=\{\{ color: '#000' \}\}>-- Or quickly select a task here --</option>
                      \{projects\.map\(p => \(
                        <option key=\{p\.id\} value=\{p\.id\} style=\{\{ color: '#000' \}\}>
                          \{p\.project_code\} - \{p\.title\}
                        </option>
                      \)\)\}
                    </select>'''
    
    quick_new_inv = '''                    <CustomDropdown
                      placeholder="-- Or quickly select a task here --"
                      value=""
                      onChange={(val) => {
                        if (val) fetchProjectDetail(val);
                      }}
                      options={[
                        { value: '', label: '-- Select a task --' },
                        ...projects.map(p => ({ value: p.id, label: `${p.project_code} - ${p.title}` }))
                      ]}
                    />'''
    content = re.sub(quick_select_inv, quick_new_inv, content)

    with open(r'f:\Drishti\Drishti\frontend\src\App.jsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    main()
