import re

def main():
    path = r'f:\Drishti\Drishti\frontend\src\App.jsx'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    old_form = r'''                      <div className="row mb-3">
                        <div className="col-md-4">
                          <label className="form-label small fw-bold">Project Code\*</label>
                          <input 
                            type="text" 
                            className="form-control" 
                            placeholder="e.g. S&T-2026-01" 
                            value={projectCode}
                            onChange={\(e\) => setProjectCode\(e.target.value\)}
                            required 
                            disabled={managerTab === 'edit-project'} // Cannot edit project code once created
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small fw-bold">Project Type\*</label>
                          <select 
                            className="form-select"
                            value={projectType}
                            onChange={\(e\) => setProjectType\(e.target.value\)}
                            required
                          >
                            <option value="S&T">Science & Technology</option>
                            <option value="R&D">Research & Development</option>
                          </select>
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small fw-bold">Status\*</label>
                          <select 
                            className="form-select"
                            value={projectStatus}
                            onChange={\(e\) => setProjectStatus\(e.target.value\)}
                            required
                          >
                            <option value="ongoing">Ongoing</option>
                            <option value="pending">Pending</option>
                            <option value="completed">Completed</option>
                            <option value="up_next">Up Next</option>
                          </select>
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="form-label small fw-bold">Project Title\*</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="Enter complete title"
                          value={projectTitle}
                          onChange={\(e\) => setProjectTitle\(e.target.value\)}
                          required 
                        />
                      </div>

                      <div className="mb-3">
                        <label className="form-label small fw-bold">Description</label>
                        <textarea 
                          className="form-control" 
                          rows="3"
                          placeholder="Operational details..."
                          value={projectDesc}
                          onChange={\(e\) => setProjectDesc\(e.target.value\)}
                        ></textarea>
                      </div>

                      <div className="row mb-3">
                        <div className="col-md-6">
                          <label className="form-label small fw-bold">Principal Agency\*</label>
                          <input 
                            type="text" 
                            className="form-control" 
                            placeholder="DST, DBT..."
                            value={principalAgency}
                            onChange={\(e\) => setPrincipalAgency\(e.target.value\)}
                            required 
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small fw-bold">Budget Amount</label>
                          <input 
                            type="number" 
                            className="form-control" 
                            step="0.01" 
                            placeholder="0.00"
                            value={budgetAmount}
                            onChange={\(e\) => setBudgetAmount\(e.target.value\)}
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small fw-bold">Budget Unit</label>
                          <select 
                            className="form-select"
                            value={budgetUnit}
                            onChange={\(e\) => setBudgetUnit\(e.target.value\)}
                          >
                            <option value="rupees">Rupees</option>
                            <option value="thousands">Thousands \(₹\)</option>
                            <option value="lakhs">Lakhs \(₹\)</option>
                            <option value="crores">Crores \(₹\)</option>
                          </select>
                        </div>
                      </div>

                      <div className="row mb-3">
                        <div className="col-md-6">
                          <label className="form-label small fw-bold">Start Date\*</label>
                          <input 
                            type="date" 
                            className="form-control"
                            value={startDate}
                            onChange={\(e\) => setStartDate\(e.target.value\)}
                            required 
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-bold">Scheduled Completion Date\*</label>
                          <input 
                            type="date" 
                            className="form-control"
                            value={scheduledCompletion}
                            onChange={\(e\) => setScheduledCompletion\(e.target.value\)}
                            required 
                          />
                        </div>
                      </div>

                      <div className="row mb-3">
                        <div className="col-md-6">
                          <label className="form-label small fw-bold">Principal Investigator \(PI\)</label>
                          <input 
                            type="text" 
                            className="form-control"
                            value={piName}
                            onChange={\(e\) => setPiName\(e.target.value\)}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-bold">Project Coordinator</label>
                          <input 
                            type="text" 
                            className="form-control"
                            value={pcName}
                            onChange={\(e\) => setPcName\(e.target.value\)}
                          />
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="form-label small fw-bold">Assign Investigator \(Select User or Type Email\)\*</label>
                        <input 
                          type="text"
                          className="form-control"
                          list="investigators-list"
                          placeholder="Select from list or type external email..."
                          value={assignedInvestigatorId}
                          onChange={\(e\) => setAssignedInvestigatorId\(e.target.value\)}
                          required
                        />
                        <datalist id="investigators-list">
                          {investigators.map\(\(user\) => \(
                            <option key={user.id} value={user.email \|\| user.id}>{user.username}</option>
                          \)\)}
                        </datalist>
                      </div>



                      <div className="mb-3">
                        <label className="form-label small fw-bold">Implementing Agencies</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="Agency A, Agency B..."
                          value={implAgencies}
                          onChange={\(e\) => setImplAgencies\(e.target.value\)}
                        />
                      </div>

                      <div className="mb-3">
                        <label className="form-label small fw-bold">Supporting Documents</label>
                        <input 
                          type="file" 
                          className="form-control" 
                          multiple
                          onChange={\(e\) => setProjectDocs\(e.target.files\)}
                        />
                        <div className="form-text text-muted" style={{ fontSize: '11px' }}>
                          Upload any relevant documents for this project. They will be processed by Ekta AI.
                        </div>
                      </div>'''

    new_form = '''                      {/* SECTION 1: Core Details */}
                      <h6 className="text-uppercase fw-bold text-muted mb-3 mt-2 border-bottom border-secondary pb-2" style={{ letterSpacing: '1px', fontSize: '0.8rem' }}>
                        <i className="bi bi-info-circle me-2"></i>Core Details
                      </h6>
                      
                      <div className="row g-3 mb-4">
                        <div className="col-md-4">
                          <label className="form-label small fw-semibold text-white-50">Project Code <span className="text-danger">*</span></label>
                          <input 
                            type="text" 
                            className="form-control bg-dark border-secondary text-white" 
                            placeholder="e.g. S&T-2026-01" 
                            value={projectCode}
                            onChange={(e) => setProjectCode(e.target.value)}
                            required 
                            disabled={managerTab === 'edit-project'}
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small fw-semibold text-white-50">Project Type <span className="text-danger">*</span></label>
                          <select 
                            className="form-select bg-dark border-secondary text-white"
                            value={projectType}
                            onChange={(e) => setProjectType(e.target.value)}
                            required
                          >
                            <option value="S&T">Science & Technology</option>
                            <option value="R&D">Research & Development</option>
                          </select>
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small fw-semibold text-white-50">Status <span className="text-danger">*</span></label>
                          <select 
                            className="form-select bg-dark border-secondary text-white"
                            value={projectStatus}
                            onChange={(e) => setProjectStatus(e.target.value)}
                            required
                          >
                            <option value="ongoing">Ongoing</option>
                            <option value="pending">Pending</option>
                            <option value="completed">Completed</option>
                            <option value="up_next">Up Next</option>
                          </select>
                        </div>
                        <div className="col-12">
                          <label className="form-label small fw-semibold text-white-50">Project Title <span className="text-danger">*</span></label>
                          <input 
                            type="text" 
                            className="form-control bg-dark border-secondary text-white form-control-lg" 
                            placeholder="Enter the complete title of the project"
                            value={projectTitle}
                            onChange={(e) => setProjectTitle(e.target.value)}
                            required 
                            style={{ fontSize: '1rem' }}
                          />
                        </div>
                        <div className="col-12">
                          <label className="form-label small fw-semibold text-white-50">Description</label>
                          <textarea 
                            className="form-control bg-dark border-secondary text-white" 
                            rows="3"
                            placeholder="Provide operational details and objectives..."
                            value={projectDesc}
                            onChange={(e) => setProjectDesc(e.target.value)}
                          ></textarea>
                        </div>
                      </div>

                      {/* SECTION 2: Financials & Timeline */}
                      <h6 className="text-uppercase fw-bold text-muted mb-3 mt-4 border-bottom border-secondary pb-2" style={{ letterSpacing: '1px', fontSize: '0.8rem' }}>
                        <i className="bi bi-cash-coin me-2"></i>Financials & Timeline
                      </h6>
                      
                      <div className="row g-3 mb-4">
                        <div className="col-md-6">
                          <label className="form-label small fw-semibold text-white-50">Principal Agency <span className="text-danger">*</span></label>
                          <input 
                            type="text" 
                            className="form-control bg-dark border-secondary text-white" 
                            placeholder="e.g. DST, DBT"
                            value={principalAgency}
                            onChange={(e) => setPrincipalAgency(e.target.value)}
                            required 
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small fw-semibold text-white-50">Budget Amount</label>
                          <input 
                            type="number" 
                            className="form-control bg-dark border-secondary text-white" 
                            step="0.01" 
                            placeholder="0.00"
                            value={budgetAmount}
                            onChange={(e) => setBudgetAmount(e.target.value)}
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small fw-semibold text-white-50">Budget Unit</label>
                          <select 
                            className="form-select bg-dark border-secondary text-white"
                            value={budgetUnit}
                            onChange={(e) => setBudgetUnit(e.target.value)}
                          >
                            <option value="rupees">Rupees</option>
                            <option value="thousands">Thousands (₹)</option>
                            <option value="lakhs">Lakhs (₹)</option>
                            <option value="crores">Crores (₹)</option>
                          </select>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-semibold text-white-50">Start Date <span className="text-danger">*</span></label>
                          <input 
                            type="date" 
                            className="form-control bg-dark border-secondary text-white"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            required 
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-semibold text-white-50">Scheduled Completion <span className="text-danger">*</span></label>
                          <input 
                            type="date" 
                            className="form-control bg-dark border-secondary text-white"
                            value={scheduledCompletion}
                            onChange={(e) => setScheduledCompletion(e.target.value)}
                            required 
                          />
                        </div>
                      </div>

                      {/* SECTION 3: Assignment & Documents */}
                      <h6 className="text-uppercase fw-bold text-muted mb-3 mt-4 border-bottom border-secondary pb-2" style={{ letterSpacing: '1px', fontSize: '0.8rem' }}>
                        <i className="bi bi-people-fill me-2"></i>Assignment & Documents
                      </h6>
                      
                      <div className="row g-3 mb-4">
                        <div className="col-md-6">
                          <label className="form-label small fw-semibold text-white-50">Principal Investigator (PI)</label>
                          <input 
                            type="text" 
                            className="form-control bg-dark border-secondary text-white"
                            placeholder="Name of PI"
                            value={piName}
                            onChange={(e) => setPiName(e.target.value)}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-semibold text-white-50">Project Coordinator</label>
                          <input 
                            type="text" 
                            className="form-control bg-dark border-secondary text-white"
                            placeholder="Name of Coordinator"
                            value={pcName}
                            onChange={(e) => setPcName(e.target.value)}
                          />
                        </div>
                        <div className="col-12">
                          <label className="form-label small fw-semibold text-white-50">Implementing Agencies</label>
                          <input 
                            type="text" 
                            className="form-control bg-dark border-secondary text-white" 
                            placeholder="Agency A, Agency B..."
                            value={implAgencies}
                            onChange={(e) => setImplAgencies(e.target.value)}
                          />
                        </div>
                        <div className="col-12">
                          <div className="p-3 bg-primary bg-opacity-10 border border-primary border-opacity-25 rounded mt-2">
                            <label className="form-label small fw-bold text-primary mb-1">Assign Investigator <span className="text-danger">*</span></label>
                            <p className="small text-muted mb-2" style={{fontSize: '0.75rem'}}>Select an existing investigator from the dropdown or type a new email address to assign the project externally.</p>
                            <input 
                              type="text"
                              className="form-control bg-dark border-primary text-white"
                              list="investigators-list"
                              placeholder="Type email address or select user..."
                              value={assignedInvestigatorId}
                              onChange={(e) => setAssignedInvestigatorId(e.target.value)}
                              required
                            />
                            <datalist id="investigators-list">
                              {investigators.map((user) => (
                                <option key={user.id} value={user.email || user.id}>{user.username}</option>
                              ))}
                            </datalist>
                          </div>
                        </div>
                        <div className="col-12 mt-3">
                          <label className="form-label small fw-semibold text-white-50">Supporting Documents</label>
                          <input 
                            type="file" 
                            className="form-control bg-dark border-secondary text-white" 
                            multiple
                            onChange={(e) => setProjectDocs(e.target.files)}
                          />
                          <div className="form-text text-muted mt-2" style={{ fontSize: '0.75rem' }}>
                            <i className="bi bi-shield-check me-1"></i>
                            Uploaded documents will be instantly processed and indexed by Ekta AI in the background.
                          </div>
                        </div>
                      </div>'''

    content = re.sub(old_form, new_form, content)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
