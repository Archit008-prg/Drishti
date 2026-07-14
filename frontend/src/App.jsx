import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [isStaff, setIsStaff] = useState(localStorage.getItem('isStaff') === 'true');
  
  // Navigation Routing State
  // 'home', 'auth-select', 'login', 'signup', 'dashboard'
  const [currentView, setCurrentView] = useState(token ? 'dashboard' : 'home');
  const [authRole, setAuthRole] = useState('investigator'); // 'investigator' or 'manager'
  
  // Auth state
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Project data states
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [investigators, setInvestigators] = useState([]);
  const [notifications, setNotifications] = useState([]);
  
  // Tabs for dashboards
  const [investigatorTab, setInvestigatorTab] = useState('running'); // 'running', 'upcoming', 'past', 'notifications'
  const [managerTab, setManagerTab] = useState('projects'); // 'projects', 'add-project', 'reviews', 'investigators', 'notifications'

  // New Project Form state
  const [projectCode, setProjectCode] = useState('');
  const [projectType, setProjectType] = useState('S&T');
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [principalAgency, setPrincipalAgency] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetUnit, setBudgetUnit] = useState('lakhs');
  const [startDate, setStartDate] = useState('');
  const [scheduledCompletion, setScheduledCompletion] = useState('');
  const [projectStatus, setProjectStatus] = useState('ongoing');
  const [assignedInvestigatorId, setAssignedInvestigatorId] = useState('');
  const [invitedEmail, setInvitedEmail] = useState('');
  const [piName, setPiName] = useState('');
  const [pcName, setPcName] = useState('');
  const [implAgencies, setImplAgencies] = useState('');
  const [chatThreads, setChatThreads] = useState([]);
  const [activeThreadUser, setActiveThreadUser] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [availableManagers, setAvailableManagers] = useState([]);
  
  // Report Submission state
  const [reportFile, setReportFile] = useState(null);
  const [reportNotes, setReportNotes] = useState('');
  
  // Manager Review state
  const [adminComment, setAdminComment] = useState('');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (token) {
      fetchProjects();
      fetchNotifications();
      if (isStaff) {
        fetchInvestigators();
        fetchChatConversations();
      } else {
        fetchAvailableManagers();
      }
    }
  }, [token, isStaff]);

  useEffect(() => {
    let interval = null;
    if (token && activeThreadUser) {
      fetchChatMessages(activeThreadUser.id);
      interval = setInterval(() => {
        fetchChatMessages(activeThreadUser.id);
        if (isStaff) {
          fetchChatConversations();
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [token, activeThreadUser, isStaff]);

  const saveAuth = (token, username, isStaff) => {
    setToken(token);
    setUsername(username);
    setIsStaff(isStaff);
    localStorage.setItem('token', token);
    localStorage.setItem('username', username);
    localStorage.setItem('isStaff', isStaff ? 'true' : 'false');
    setCurrentView('dashboard');
  };

  const logout = () => {
    setToken('');
    setUsername('');
    setIsStaff(false);
    setSelectedProject(null);
    setProjects([]);
    localStorage.clear();
    setCurrentView('home');
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    
    const endpoint = currentView === 'login' ? '/api/login/' : '/api/signup/';
    const body = currentView === 'login'
      ? { username: authUsername, password: authPassword }
      : { 
          username: authUsername, 
          password: authPassword, 
          email: authEmail,
          is_staff: authRole === 'manager' 
        };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        if (currentView === 'login') {
          saveAuth(data.token, data.username, data.is_staff);
        } else {
          setAuthSuccess('Registration successful! You can now log in.');
          setCurrentView('login');
        }
        setAuthUsername('');
        setAuthPassword('');
        setAuthEmail('');
      } else {
        setAuthError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setAuthError('Connection error to server');
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/`, {
        headers: { 'Authorization': `Token ${token}` }
      });
      const data = await res.json();
      if (res.ok) setProjects(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProjectDetail = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${id}/`, {
        headers: { 'Authorization': `Token ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedProject(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchInvestigators = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/investigators/`, {
        headers: { 'Authorization': `Token ${token}` }
      });
      const data = await res.json();
      if (res.ok) setInvestigators(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/notifications/`, {
        headers: { 'Authorization': `Token ${token}` }
      });
      const data = await res.json();
      if (res.ok) setNotifications(data);
    } catch (err) {
      console.error(err);
    }
  };

  const markNotificationRead = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/notifications/${id}/read/`, {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}` }
      });
      if (res.ok) fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('project_code', projectCode);
    formData.append('project_type', projectType);
    formData.append('title', projectTitle);
    formData.append('description', projectDesc);
    formData.append('principal_agency', principalAgency);
    formData.append('budget_amount', budgetAmount);
    formData.append('budget_unit', budgetUnit);
    formData.append('start_date', startDate);
    formData.append('scheduled_completion', scheduledCompletion);
    formData.append('status', projectStatus);
    formData.append('project_investigator', piName);
    formData.append('project_coordinator', pcName);
    formData.append('implementing_agencies', implAgencies);
    formData.append('assigned_investigator', assignedInvestigatorId);

    try {
      const res = await fetch(`${API_BASE}/api/projects/add/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`
        },
        body: formData
      });
      if (res.ok) {
        alert('Project created successfully!');
        setManagerTab('projects');
        fetchProjects();
        // Reset form
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
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to create project');
      }
    } catch (err) {
      alert('Error creating project');
    }
  };
  const fetchChatConversations = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/chat/conversations/`, {
        headers: { 'Authorization': `Token ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChatThreads(data);
      }
    } catch (err) {
      console.error('Error fetching chat threads:', err);
    }
  };

  const fetchChatMessages = async (userId) => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/api/chat/messages/?with_user_id=${userId}`, {
        headers: { 'Authorization': `Token ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data);
      }
    } catch (err) {
      console.error('Error fetching chat messages:', err);
    }
  };

  const fetchAvailableManagers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/chat/managers/`, {
        headers: { 'Authorization': `Token ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableManagers(data);
        if (data.length > 0 && !activeThreadUser) {
          setActiveThreadUser({ id: data[0].user_id, username: data[0].username });
        }
      }
    } catch (err) {
      console.error('Error fetching managers:', err);
    }
  };

  const handleSendLiveMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeThreadUser) return;

    const textToSend = newMessage.trim();
    setNewMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/chat/send/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        },
        body: JSON.stringify({
          receiver_id: activeThreadUser.id,
          message: textToSend
        })
      });
      if (res.ok) {
        const msg = await res.json();
        setChatMessages((prev) => [...prev, msg]);
        fetchChatConversations();
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const handleDeleteProject = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${id}/delete/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`
        }
      });
      if (res.ok) {
        alert('Project deleted successfully.');
        setSelectedProject(null);
        fetchProjects();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to delete project.');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting project.');
    }
  };

  const handleUpdateProjectStatus = async (id, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${id}/update/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        alert('Project status updated successfully.');
        fetchProjectDetail(id);
        fetchProjects();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to update project status.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating project status.');
    }
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportFile) {
      alert('Please upload a PDF file');
      return;
    }
    const formData = new FormData();
    formData.append('report_file', reportFile);
    formData.append('notes', reportNotes);

    try {
      const res = await fetch(`${API_BASE}/api/projects/${selectedProject.id}/submit-report/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`
        },
        body: formData
      });
      if (res.ok) {
        alert('Report submitted successfully!');
        setReportFile(null);
        setReportNotes('');
        fetchProjectDetail(selectedProject.id);
        fetchProjects();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to submit report');
      }
    } catch (err) {
      alert('Error submitting report');
    }
  };

  const handleReviewReport = async (action) => {
    if ((action === 'reject' || action === 'resubmit') && !adminComment.trim()) {
      alert('Please enter a review comment explaining the reason.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/reports/${selectedProject.report.id}/review/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        },
        body: JSON.stringify({
          action: action,
          admin_comment: adminComment
        })
      });
      if (res.ok) {
        alert(`Report ${action}ed successfully!`);
        setAdminComment('');
        fetchProjectDetail(selectedProject.id);
        fetchProjects();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to review report');
      }
    } catch (err) {
      alert('Error submitting review');
    }
  };

  // Helper filters for Investigator Categorized Dashboards
  const runningTasks = projects.filter(p => p.status === 'ongoing');
  const upcomingTasks = projects.filter(p => p.status === 'pending' || p.status === 'up_next');
  const pastTasks = projects.filter(p => p.status === 'completed' || p.report_status === 'approved');

  // Filtered projects by search
  const filteredProjects = projects.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.project_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.principal_agency.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const underReviewReports = projects.filter(p => p.report_status === 'submitted');

  // 1. HOME LANDING VIEW
  if (currentView === 'home') {
    return (
      <div>
        {/* Landing Navbar */}
        <nav className="navbar navbar-expand-lg navbar-dark bg-dark px-4 py-3 shadow-sm">
          <div className="container">
            <span className="navbar-brand fs-3 fw-bold"><i className="bi bi-eye"></i> Drishti</span>
            <button 
              className="btn btn-outline-light btn-sm px-3"
              onClick={() => { setAuthRole('investigator'); setCurrentView('auth-select'); }}
            >
              Sign In
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <header className="bg-dark text-white text-center py-5 shadow-sm" style={{ background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)' }}>
          <div className="container py-5">
            <h1 className="display-4 fw-bold mb-3">Empower Audits & Project Management</h1>
            <p className="lead text-gray-300 mb-4 max-w-2xl mx-auto">
              Drishti is a unified operations platform designed for organizations to streamline task delegation, audit tracking, compliance documentation, and guidelines verification.
            </p>
            <div className="d-flex justify-content-center gap-3">
              <button 
                className="btn btn-primary btn-lg px-4"
                onClick={() => { setAuthRole('manager'); setCurrentView('auth-select'); }}
              >
                Access Manager Portal
              </button>
              <button 
                className="btn btn-outline-light btn-lg px-4"
                onClick={() => { setAuthRole('investigator'); setCurrentView('auth-select'); }}
              >
                Access Team Portal
              </button>
            </div>
          </div>
        </header>

        {/* Feature Cards Grid */}
        <section className="container py-5">
          <div className="text-center mb-5">
            <h2 className="fw-bold">Designed for Collaborative Governance</h2>
            <p className="text-muted">Simple interfaces for managers to coordinate and teams to execute.</p>
          </div>
          <div className="row g-4">
            <div className="col-md-4">
              <div className="card h-100 border-0 shadow-sm p-4 text-center">
                <div className="fs-1 text-primary mb-3"><i className="bi bi-shield-check"></i></div>
                <h4 className="fw-bold">Manager Oversight</h4>
                <p className="text-muted">
                  Create and assign projects. Audit project timeline, inspect metadata, and review submitted PDF reports with full approval workflows.
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card h-100 border-0 shadow-sm p-4 text-center">
                <div className="fs-1 text-success mb-3"><i className="bi bi-person-workspace"></i></div>
                <h4 className="fw-bold">Team Execution</h4>
                <p className="text-muted">
                  Track running, upcoming, and past tasks. Directly upload PDF reports, write progress notes, and view supervisor feedback.
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card h-100 border-0 shadow-sm p-4 text-center">
                <div className="fs-1 text-warning mb-3"><i className="bi bi-chat-square-text"></i></div>
                <h4 className="fw-bold">Internal AI Assistant</h4>
                <p className="text-muted">
                  Ask context-based audit questions. The built-in bot clarifies operational queries directly based on project metadata and uploads.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-light py-4 border-top text-center mt-5">
          <div className="container">
            <span className="text-muted">© 2026 Drishti Operations Platform. All rights reserved.</span>
          </div>
        </footer>
      </div>
    );
  }

  // 2. ROLE ACCESS SELECTION
  if (currentView === 'auth-select') {
    return (
      <div className="container mt-5">
        <div className="row justify-content-center">
          <div className="col-md-8 text-center mb-4">
            <button className="btn btn-outline-secondary btn-sm mb-3" onClick={() => setCurrentView('home')}>
              <i className="bi bi-arrow-left"></i> Back to Home
            </button>
            <h2 className="fw-bold">Select Portal Entrance</h2>
            <p className="text-muted">Choose your access type to enter corresponding login dashboard</p>
          </div>
        </div>

        <div className="row justify-content-center g-4">
          <div className="col-md-5">
            <div className="card shadow-sm h-100 text-center border-primary p-4 hover-shadow">
              <div className="fs-1 text-primary mb-3"><i className="bi bi-shield-lock"></i></div>
              <h3 className="fw-bold">Manager Portal</h3>
              <p className="text-muted mb-4">For Administrators, Supervisors, and Auditors managing organizational project directories and reviewing team outputs.</p>
              <button 
                className="btn btn-primary w-100 mt-auto" 
                onClick={() => { setAuthRole('manager'); setCurrentView('login'); }}
              >
                Sign In as Manager
              </button>
            </div>
          </div>
          <div className="col-md-5">
            <div className="card shadow-sm h-100 text-center border-success p-4 hover-shadow">
              <div className="fs-1 text-success mb-3"><i className="bi bi-people"></i></div>
              <h3 className="fw-bold">Team / Individual</h3>
              <p className="text-muted mb-4">For Investigators, Project Leads, and Staff running designated tasks, logging updates, and uploading compliance reports.</p>
              <button 
                className="btn btn-success w-100 mt-auto" 
                onClick={() => { setAuthRole('investigator'); setCurrentView('login'); }}
              >
                Sign In as Investigator
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. LOGIN & SIGNUP FORMS
  if (currentView === 'login' || currentView === 'signup') {
    return (
      <div className="container mt-5">
        <div className="row justify-content-center">
          <div className="col-md-6">
            <button className="btn btn-outline-secondary btn-sm mb-3" onClick={() => setCurrentView('auth-select')}>
              <i className="bi bi-arrow-left"></i> Back to Portal Selection
            </button>

            <div className="card shadow">
              <div className={`card-header text-white ${authRole === 'manager' ? 'bg-primary' : 'bg-success'}`}>
                <h4 className="mb-0">
                  {authRole === 'manager' ? 'Manager Portal' : 'Investigator Portal'} - {currentView === 'login' ? 'Login' : 'Sign Up'}
                </h4>
              </div>
              <div className="card-body">
                {authError && <div className="alert alert-danger small py-2">{authError}</div>}
                {authSuccess && <div className="alert alert-success small py-2">{authSuccess}</div>}

                <form onSubmit={handleAuthSubmit}>
                  <div className="mb-3">
                    <label className="form-label">Username</label>
                    <input 
                      type="text" 
                      className="form-control"
                      value={authUsername}
                      onChange={(e) => setAuthUsername(e.target.value)}
                      required 
                    />
                  </div>

                  {currentView === 'signup' && (
                    <div className="mb-3">
                      <label className="form-label">Email</label>
                      <input 
                        type="email" 
                        className="form-control"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label">Password</label>
                    <input 
                      type="password" 
                      className="form-control"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      required 
                    />
                  </div>

                  <button type="submit" className={`btn w-100 mb-3 text-white ${authRole === 'manager' ? 'btn-primary' : 'btn-success'}`}>
                    {currentView === 'login' ? 'Sign In' : 'Register Account'}
                  </button>

                  <div className="text-center">
                    <button 
                      type="button" 
                      className="btn btn-link btn-sm" 
                      onClick={() => {
                        setCurrentView(currentView === 'login' ? 'signup' : 'login');
                        setAuthError('');
                        setAuthSuccess('');
                      }}
                    >
                      {currentView === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Login'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. MAIN APPLICATION DASHBOARDS (AFTER AUTH)
  return (
    <div className="d-flex position-relative min-vh-100">
      {/* Background Ambient Glows */}
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      {/* Left Sidebar Menu */}
      <div className="sidebar-wrapper">
        <div className="sidebar-logo">
          <span className="h4 mb-0 fs-3 fw-bold d-flex align-items-center gap-2" style={{ cursor: 'pointer', color: 'var(--text-primary)' }} onClick={() => setCurrentView('dashboard')}>
            <i className="bi bi-eye text-purple" style={{ color: 'var(--accent-purple)' }}></i> Drishti
          </span>
        </div>
        <div className="sidebar-menu">
          {isStaff ? (
            <>
              <button className={`sidebar-item ${managerTab === 'projects' ? 'active' : ''}`} onClick={() => setManagerTab('projects')}>
                <i className="bi bi-grid-3x3-gap"></i> Projects Directory
              </button>
              <button className={`sidebar-item ${managerTab === 'add-project' ? 'active' : ''}`} onClick={() => setManagerTab('add-project')}>
                <i className="bi bi-plus-circle"></i> Add Project
              </button>
              <button className={`sidebar-item ${managerTab === 'reviews' ? 'active' : ''}`} onClick={() => setManagerTab('reviews')}>
                <i className="bi bi-file-earmark-text"></i> Pending Reviews
                {underReviewReports.length > 0 && <span className="badge bg-danger ms-auto rounded-pill">{underReviewReports.length}</span>}
              </button>
              <button className={`sidebar-item ${managerTab === 'investigators' ? 'active' : ''}`} onClick={() => setManagerTab('investigators')}>
                <i className="bi bi-people"></i> Investigators
              </button>
              <button className={`sidebar-item ${managerTab === 'notifications' ? 'active' : ''}`} onClick={() => setManagerTab('notifications')}>
                <i className="bi bi-bell"></i> Alerts Feed
              </button>
              <button className={`sidebar-item ${managerTab === 'live-chats' ? 'active' : ''}`} onClick={() => { setManagerTab('live-chats'); setActiveThreadUser(null); fetchChatConversations(); }}>
                <i className="bi bi-chat-dots-fill"></i> Live Chats
              </button>
            </>
          ) : (
            <>
              <button className={`sidebar-item ${investigatorTab === 'running' ? 'active' : ''}`} onClick={() => setInvestigatorTab('running')}>
                <i className="bi bi-play-circle"></i> Running Tasks
                {runningTasks.length > 0 && <span className="badge bg-info ms-auto rounded-pill">{runningTasks.length}</span>}
              </button>
              <button className={`sidebar-item ${investigatorTab === 'upcoming' ? 'active' : ''}`} onClick={() => setInvestigatorTab('upcoming')}>
                <i className="bi bi-calendar-event"></i> Upcoming Tasks
                {upcomingTasks.length > 0 && <span className="badge bg-warning text-dark ms-auto rounded-pill">{upcomingTasks.length}</span>}
              </button>
              <button className={`sidebar-item ${investigatorTab === 'past' ? 'active' : ''}`} onClick={() => setInvestigatorTab('past')}>
                <i className="bi bi-check2-circle"></i> Completed Tasks
              </button>
              <button className={`sidebar-item ${investigatorTab === 'notifications' ? 'active' : ''}`} onClick={() => setInvestigatorTab('notifications')}>
                <i className="bi bi-bell"></i> Alerts Feed
                {notifications.filter(n => !n.is_read).length > 0 && <span className="badge bg-danger ms-auto rounded-pill">{notifications.filter(n => !n.is_read).length}</span>}
              </button>
            </>
          )}
        </div>

        {/* Bottom widget inside sidebar */}
        <div className="sidebar-ask-widget mx-3 mb-4">
          <h6 className="small fw-bold text-white mb-1"><i className="bi bi-shield-lock-fill"></i> Encrypted Desk</h6>
          <p className="text-muted" style={{ fontSize: '10px' }}>Securely tracking live workspace actions</p>
        </div>
      </div>

      {/* Right Work area */}
      <div className="flex-fill d-flex flex-column" style={{ minWidth: 0 }}>
        {/* Top Header */}
        <div className="d-flex justify-content-between align-items-center px-4 py-3 border-bottom border-secondary border-opacity-10 bg-dark bg-opacity-20 backdrop-blur" style={{ sticky: 'top', zIndex: 90 }}>
          <div>
            <h5 className="mb-0 fw-bold">Welcome back, {username}</h5>
            <p className="text-muted mb-0 small">Role: {isStaff ? 'Manager Coordinator' : 'Principal Investigator'}</p>
          </div>
          
          <div className="d-flex align-items-center gap-3">
            {/* Bell notification glass icon */}
            <div className="glass-badge-btn" onClick={() => isStaff ? setManagerTab('notifications') : setInvestigatorTab('notifications')} title="View notifications">
              <i className="bi bi-bell fs-5"></i>
              {notifications.filter(n => !n.is_read).length > 0 && (
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '9px' }}>
                  {notifications.filter(n => !n.is_read).length}
                </span>
              )}
            </div>

            {/* direct message icon next to bell */}
            <div className="glass-badge-btn" onClick={() => {
              if (isStaff) {
                setManagerTab('live-chats');
              } else {
                if (availableManagers.length > 0) {
                  setActiveThreadUser({ id: availableManagers[0].user_id, username: availableManagers[0].username });
                  fetchChatMessages(availableManagers[0].user_id);
                }
              }
            }} title="Open live chat threads">
              <i className="bi bi-chat-left-dots fs-5"></i>
            </div>

            <div className="vr bg-secondary opacity-20 my-1" style={{ width: '1.5px', height: '24px' }}></div>

            <button className="btn btn-glass btn-sm d-flex align-items-center gap-1" onClick={logout}>
              <i className="bi bi-box-arrow-right"></i> Logout
            </button>
          </div>
        </div>

        {/* Container Workspace Grid */}
        <div className="container-fluid p-4">
          {isStaff && (
            <div className="row">
              
              {/* Manager Metrics Cards */}
              <div className="col-12 mb-4">
                <div className="row g-3">
                  {/* Metric 1 */}
                  <div className="col-md-3">
                    <div className="card card-glass card-glow-purple h-100">
                      <div className="card-body p-3">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="text-muted small fw-bold">Total Projects</span>
                          <i className="bi bi-folder-fill fs-4" style={{ color: 'var(--accent-purple)' }}></i>
                        </div>
                        <h3 className="mb-0 fw-bold">{projects.length}</h3>
                        <svg className="mt-3 w-100" height="35" viewBox="0 0 120 35">
                          <defs>
                            <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--accent-purple)" stopOpacity="0.4"/>
                              <stop offset="100%" stopColor="var(--accent-purple)" stopOpacity="0"/>
                            </linearGradient>
                          </defs>
                          <path d="M 0 25 C 20 10, 40 30, 60 15 C 80 5, 100 25, 120 10 L 120 35 L 0 35 Z" fill="url(#purpleGrad)" />
                          <path d="M 0 25 C 20 10, 40 30, 60 15 C 80 5, 100 25, 120 10" fill="none" stroke="var(--accent-purple)" strokeWidth="2" filter="drop-shadow(0px 0px 4px rgba(168, 85, 247, 0.6))" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  {/* Metric 2 */}
                  <div className="col-md-3">
                    <div className="card card-glass h-100" style={{ boxShadow: '0 0 20px rgba(250, 204, 21, 0.08)' }}>
                      <div className="card-body p-3">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="text-muted small fw-bold">Pending Reviews</span>
                          <i className="bi bi-hourglass-split fs-4" style={{ color: 'var(--accent-yellow)' }}></i>
                        </div>
                        <h3 className="mb-0 fw-bold">{underReviewReports.length}</h3>
                        <svg className="mt-3 w-100" height="35" viewBox="0 0 120 35">
                          <defs>
                            <linearGradient id="yellowGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--accent-yellow)" stopOpacity="0.3"/>
                              <stop offset="100%" stopColor="var(--accent-yellow)" stopOpacity="0"/>
                            </linearGradient>
                          </defs>
                          <path d="M 0 28 C 30 12, 50 32, 80 15 C 95 8, 110 22, 120 14 L 120 35 L 0 35 Z" fill="url(#yellowGrad)" />
                          <path d="M 0 28 C 30 12, 50 32, 80 15 C 95 8, 110 22, 120 14" fill="none" stroke="var(--accent-yellow)" strokeWidth="2" filter="drop-shadow(0px 0px 4px rgba(234, 179, 8, 0.6))" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  {/* Metric 3 */}
                  <div className="col-md-3">
                    <div className="card card-glass card-glow-cyan h-100">
                      <div className="card-body p-3">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="text-muted small fw-bold">Ongoing Tasks</span>
                          <i className="bi bi-activity fs-4" style={{ color: 'var(--accent-blue)' }}></i>
                        </div>
                        <h3 className="mb-0 fw-bold">{projects.filter(p => p.status === 'ongoing').length}</h3>
                        <svg className="mt-3 w-100" height="35" viewBox="0 0 120 35">
                          <defs>
                            <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity="0.4"/>
                              <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity="0"/>
                            </linearGradient>
                          </defs>
                          <path d="M 0 20 C 25 32, 50 8, 75 22 C 95 32, 110 12, 120 18 L 120 35 L 0 35 Z" fill="url(#blueGrad)" />
                          <path d="M 0 20 C 25 32, 50 8, 75 22 C 95 32, 110 12, 120 18" fill="none" stroke="var(--accent-blue)" strokeWidth="2" filter="drop-shadow(0px 0px 4px rgba(59, 130, 246, 0.6))" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  {/* Metric 4 */}
                  <div className="col-md-3">
                    <div className="card card-glass h-100" style={{ boxShadow: '0 0 20px rgba(74, 222, 128, 0.08)' }}>
                      <div className="card-body p-3">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="text-muted small fw-bold">Completed Tasks</span>
                          <i className="bi bi-patch-check-fill fs-4" style={{ color: 'var(--accent-green)' }}></i>
                        </div>
                        <h3 className="mb-0 fw-bold">{projects.filter(p => p.status === 'completed').length}</h3>
                        <svg className="mt-3 w-100" height="35" viewBox="0 0 120 35">
                          <defs>
                            <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--accent-mint)" stopOpacity="0.4"/>
                              <stop offset="100%" stopColor="var(--accent-mint)" stopOpacity="0"/>
                            </linearGradient>
                          </defs>
                          <path d="M 0 30 C 20 15, 45 10, 70 25 C 90 35, 105 15, 120 10 L 120 35 L 0 35 Z" fill="url(#greenGrad)" />
                          <path d="M 0 30 C 20 15, 45 10, 70 25 C 90 35, 105 15, 120 10" fill="none" stroke="var(--accent-mint)" strokeWidth="2" filter="drop-shadow(0px 0px 4px rgba(16, 185, 129, 0.6))" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Left Hand Options Panel & List */}              <div className="col-lg-8 mb-4">
                {managerTab === 'projects' && (
                  <>

                  {/* Graphs Row */}
                  <div className="row g-3 mb-4">
                    {/* Donut Chart: Status distribution */}
                    <div className="col-md-6">
                      <div className="card card-glass h-100">
                        <div className="card-header card-glass-header py-3">
                          <h6 className="mb-0 fw-bold"><i className="bi bi-pie-chart-fill me-2" style={{ color: 'var(--accent-purple)' }}></i> Project Status Distribution</h6>
                        </div>
                        <div className="card-body">
                          {projects.length > 0 ? (
                            (() => {
                              const ongoing = projects.filter(p => p.status === 'ongoing').length;
                              const completed = projects.filter(p => p.status === 'completed').length;
                              const total = ongoing + completed || 1;
                              const ongoingPct = (ongoing / total) * 100;
                              const completedPct = (completed / total) * 100;
                              const radius = 50;
                              const circum = 2 * Math.PI * radius;
                              return (
                                <div className="row align-items-center">
                                  <div className="col-6">
                                    <svg width="140" height="140" viewBox="0 0 140 140" className="mx-auto d-block">
                                      <circle cx="70" cy="70" r={radius} fill="transparent" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
                                      {ongoing > 0 && (
                                        <circle cx="70" cy="70" r={radius} fill="transparent" stroke="var(--accent-blue)" strokeWidth="12" 
                                          strokeDasharray={`${circum}`}
                                          strokeDashoffset={`${circum * (1 - ongoingPct / 100)}`}
                                          transform="rotate(-90 70 70)"
                                          strokeLinecap="round"
                                        />
                                      )}
                                      {completed > 0 && (
                                        <circle cx="70" cy="70" r={radius} fill="transparent" stroke="var(--accent-mint)" strokeWidth="12" 
                                          strokeDasharray={`${circum}`}
                                          strokeDashoffset={`${circum * (1 - completedPct / 100)}`}
                                          transform={`rotate(${-90 + (360 * (ongoingPct / 100))} 70 70)`}
                                          strokeLinecap="round"
                                        />
                                      )}
                                      <text x="70" y="73" textAnchor="middle" fill="var(--text-primary)" className="fw-bold" style={{ fontSize: '15px' }}>
                                        {projects.length}
                                      </text>
                                      <text x="70" y="87" textAnchor="middle" fill="var(--text-muted)" style={{ fontSize: '9px' }}>
                                        Projects
                                      </text>
                                    </svg>
                                  </div>
                                  <div className="col-6">
                                    <div className="small mb-2 d-flex align-items-center">
                                      <span className="d-inline-block me-2 rounded-circle" style={{ width: '12px', height: '12px', backgroundColor: 'var(--accent-blue)' }}></span>
                                      <span className="text-muted">Ongoing:</span>
                                      <strong className="ms-auto">{ongoing}</strong>
                                    </div>
                                    <div className="small d-flex align-items-center">
                                      <span className="d-inline-block me-2 rounded-circle" style={{ width: '12px', height: '12px', backgroundColor: 'var(--accent-mint)' }}></span>
                                      <span className="text-muted">Completed:</span>
                                      <strong className="ms-auto">{completed}</strong>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()
                          ) : (
                            <div className="text-center py-5 text-muted small">No project status metadata available to chart.</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bar Chart: Budget Allocations by Implementing Agency */}
                    <div className="col-md-6">
                      <div className="card card-glass h-100">
                        <div className="card-header card-glass-header py-3">
                          <h6 className="mb-0 fw-bold"><i className="bi bi-bar-chart-line-fill me-2" style={{ color: 'var(--accent-purple)' }}></i> Top Agency Budgets</h6>
                        </div>
                        <div className="card-body">
                          {(() => {
                            const agencyBudgets = {};
                            projects.forEach(p => {
                              const agency = p.principal_agency || 'Other';
                              let amt = parseFloat(p.budget_amount) || 0;
                              if (p.budget_unit === 'rupees') amt = amt / 100000;
                              else if (p.budget_unit === 'thousands') amt = amt / 100;
                              agencyBudgets[agency] = (agencyBudgets[agency] || 0) + amt;
                            });
                            const sortedAgencies = Object.entries(agencyBudgets)
                              .map(([agency, budget]) => ({ agency, budget }))
                              .sort((a, b) => b.budget - a.budget)
                              .slice(0, 4);
                            const maxBudget = sortedAgencies.length > 0 ? sortedAgencies[0].budget : 1;
                            if (sortedAgencies.length > 0) {
                              return sortedAgencies.map((item, idx) => {
                                const pct = (item.budget / maxBudget) * 100;
                                return (
                                  <div key={idx} className="mb-2">
                                    <div className="d-flex justify-content-between mb-1 small">
                                      <span className="text-truncate fw-bold" style={{ maxWidth: '70%', color: 'var(--text-primary)' }}>{item.agency}</span>
                                      <span className="text-muted">{item.budget.toFixed(1)} L</span>
                                    </div>
                                    <div className="progress" style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.06)' }}>
                                      <div 
                                        className="progress-bar" 
                                        style={{ 
                                          width: `${pct}%`,
                                          background: 'linear-gradient(90deg, var(--accent-blue) 0%, var(--accent-mint) 100%)' 
                                        }}
                                      ></div>
                                    </div>
                                  </div>
                                );
                              });
                            }
                            return <div className="text-center py-5 text-muted small">No budget metrics available.</div>;
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Active Timelines Gantt Monitor */}
                  <div className="card card-glass mb-4">
                    <div className="card-header card-glass-header py-3">
                      <h6 className="mb-0 fw-bold"><i className="bi bi-clock-history me-2 text-info" style={{ color: 'var(--accent-blue)' }}></i> Project Timelines Monitor</h6>
                    </div>
                    <div className="card-body p-4">
                      {/* Timeline scale header row */}
                      <div className="timeline-grid border-bottom pb-2 mb-3">
                        <div className="fw-bold small text-muted text-uppercase">Projects</div>
                        <div className="timeline-axis-label">May 01</div>
                        <div className="timeline-axis-label">May 02</div>
                        <div className="timeline-axis-label">May 03</div>
                        <div className="timeline-axis-label">May 04</div>
                        <div className="timeline-axis-label">May 05</div>
                        <div className="timeline-axis-label">May 06</div>
                        <div className="timeline-axis-label">May 07</div>
                        <div className="timeline-axis-label">May 08</div>
                        <div className="timeline-axis-label">May 09</div>
                        <div className="timeline-axis-label">May 10</div>
                      </div>

                      {/* Timeline projects rows */}
                      {projects.filter(p => p.status === 'ongoing').length > 0 ? (
                        projects.filter(p => p.status === 'ongoing').map((p, idx) => {
                          const startCol = 2 + (idx % 3);
                          const colSpan = 4 + (idx % 4);
                          const colorClass = idx % 3 === 0 ? 'timeline-capsule-purple' : idx % 3 === 1 ? 'timeline-capsule-blue' : 'timeline-capsule-mint';
                          const initials = p.assigned_investigator ? p.assigned_investigator.substring(0, 2).toUpperCase() : 'UI';
                          return (
                            <div key={p.id} className="timeline-grid mb-3">
                              <div className="text-truncate pe-2">
                                <strong className="d-block small text-white">{p.project_code}</strong>
                                <span className="text-muted" style={{ fontSize: '10px' }}>{p.title}</span>
                              </div>
                              <div 
                                className={`timeline-capsule ${colorClass} d-flex justify-content-between align-items-center`}
                                style={{ gridColumn: `${startCol} / span ${colSpan}` }}
                              >
                                <span className="text-truncate">{p.title}</span>
                                <div className="d-flex align-items-center">
                                  <div className="timeline-member-dot" title="Assigned Investigator">{initials}</div>
                                  <div className="timeline-member-dot bg-dark text-muted" title="Project Coordinator">PC</div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-4 text-muted small">No running projects with timelines to monitor.</div>
                      )}
                    </div>
                  </div>

                  <div className="card card-glass mb-4">
                  <div className="card-header card-glass-header py-3">
                    <div className="row g-2 align-items-center">
                      <div className="col-md-6">
                        <h5 className="mb-0 fw-bold">Active Projects Directory</h5>
                      </div>
                      <div className="col-md-6">
                        <div className="input-group">
                          <span className="input-group-text"><i className="bi bi-search"></i></span>
                          <input 
                            type="text" 
                            className="form-control form-control-sm" 
                            placeholder="Search by title, code or agency..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="card-body p-0">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="ps-3">Code</th>
                          <th>Title</th>
                          <th>Agency</th>
                          <th>Assigned To</th>
                          <th>Project Status</th>
                          <th className="pe-3">Report</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProjects.map((p) => (
                          <tr 
                            key={p.id} 
                            style={{ cursor: 'pointer' }}
                            className={selectedProject?.id === p.id ? 'table-primary' : ''}
                            onClick={() => fetchProjectDetail(p.id)}
                          >
                            <td className="ps-3"><strong>{p.project_code}</strong></td>
                            <td>{p.title}</td>
                            <td>{p.principal_agency}</td>
                            <td>{p.assigned_investigator || '-'}</td>
                            <td>
                              <span className={
                                 p.status === 'completed' ? 'pulse-badge-green' : 
                                 p.status === 'ongoing' ? 'pulse-badge-yellow' : 'pulse-badge-red'
                               }>
                                 {p.status}
                               </span>
                            </td>
                            <td className="pe-3">
                              <span className={
                                 p.report_status === 'approved' ? 'pulse-badge-green' :
                                 ['submitted', 'resubmitted'].includes(p.report_status) ? 'pulse-badge-yellow' : 'pulse-badge-red'
                               }>
                                 {p.report_status}
                               </span>
                            </td>
                          </tr>
                        ))}
                        {filteredProjects.length === 0 && (
                          <tr>
                            <td colSpan="6" className="text-center py-4 text-muted">No projects found matching search query.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

              {/* View 2: Add Project */}
              {managerTab === 'add-project' && (
                <div className="card card-glass mb-4">
                  <div className="card-header card-glass-header py-3">
                    <h5 className="mb-0 fw-bold"><i className="bi bi-folder-plus"></i> Create & Assign New Project</h5>
                  </div>
                  <div className="card-body">
                    <form onSubmit={handleCreateProject}>
                      <div className="row mb-3">
                        <div className="col-md-4">
                          <label className="form-label small fw-bold">Project Code*</label>
                          <input 
                            type="text" 
                            className="form-control" 
                            placeholder="e.g. S&T-2026-01" 
                            value={projectCode}
                            onChange={(e) => setProjectCode(e.target.value)}
                            required 
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small fw-bold">Project Type*</label>
                          <select 
                            className="form-select"
                            value={projectType}
                            onChange={(e) => setProjectType(e.target.value)}
                            required
                          >
                            <option value="S&T">Science & Technology</option>
                            <option value="R&D">Research & Development</option>
                          </select>
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small fw-bold">Status*</label>
                          <select 
                            className="form-select"
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
                      </div>

                      <div className="mb-3">
                        <label className="form-label small fw-bold">Project Title*</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="Enter complete title"
                          value={projectTitle}
                          onChange={(e) => setProjectTitle(e.target.value)}
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
                          onChange={(e) => setProjectDesc(e.target.value)}
                        ></textarea>
                      </div>

                      <div className="row mb-3">
                        <div className="col-md-6">
                          <label className="form-label small fw-bold">Principal Agency*</label>
                          <input 
                            type="text" 
                            className="form-control" 
                            placeholder="DST, DBT..."
                            value={principalAgency}
                            onChange={(e) => setPrincipalAgency(e.target.value)}
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
                            onChange={(e) => setBudgetAmount(e.target.value)}
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small fw-bold">Budget Unit</label>
                          <select 
                            className="form-select"
                            value={budgetUnit}
                            onChange={(e) => setBudgetUnit(e.target.value)}
                          >
                            <option value="rupees">Rupees</option>
                            <option value="thousands">Thousands (₹)</option>
                            <option value="lakhs">Lakhs (₹)</option>
                            <option value="crores">Crores (₹)</option>
                          </select>
                        </div>
                      </div>

                      <div className="row mb-3">
                        <div className="col-md-6">
                          <label className="form-label small fw-bold">Start Date*</label>
                          <input 
                            type="date" 
                            className="form-control"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            required 
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-bold">Scheduled Completion Date*</label>
                          <input 
                            type="date" 
                            className="form-control"
                            value={scheduledCompletion}
                            onChange={(e) => setScheduledCompletion(e.target.value)}
                            required 
                          />
                        </div>
                      </div>

                      <div className="row mb-3">
                        <div className="col-md-6">
                          <label className="form-label small fw-bold">Principal Investigator (PI)</label>
                          <input 
                            type="text" 
                            className="form-control"
                            value={piName}
                            onChange={(e) => setPiName(e.target.value)}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-bold">Project Coordinator</label>
                          <input 
                            type="text" 
                            className="form-control"
                            value={pcName}
                            onChange={(e) => setPcName(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="form-label small fw-bold">Assign Investigator (Drishti Team User)*</label>
                        <select 
                          className="form-select"
                          value={assignedInvestigatorId}
                          onChange={(e) => setAssignedInvestigatorId(e.target.value)}
                          required
                        >
                          <option value="" disabled>Select investigator...</option>
                          {investigators.map((user) => (
                            <option key={user.id} value={user.id}>{user.username} ({user.email || 'No email'})</option>
                          ))}
                        </select>
                      </div>



                      <div className="mb-3">
                        <label className="form-label small fw-bold">Implementing Agencies</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="Agency A, Agency B..."
                          value={implAgencies}
                          onChange={(e) => setImplAgencies(e.target.value)}
                        />
                      </div>

                      <div className="d-flex justify-content-end gap-2 mt-4">
                        <button type="button" className="btn btn-glass" onClick={() => setManagerTab('projects')}>Cancel</button>
                        <button type="submit" className="btn btn-primary-glow">Create Project</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* View 3: Pending Reviews */}
              {managerTab === 'reviews' && (
                <div className="card card-glass mb-4">
                  <div className="card-header card-glass-header py-3">
                    <h5 className="mb-0 fw-bold"><i className="bi bi-hourglass-split"></i> Awaiting Decision Reports</h5>
                  </div>
                  <div className="card-body p-0">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="ps-3">Code</th>
                          <th>Project Title</th>
                          <th>Agency</th>
                          <th>Assigned Investigator</th>
                          <th className="pe-3">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {underReviewReports.map((p) => (
                          <tr key={p.id}>
                            <td className="ps-3"><strong>{p.project_code}</strong></td>
                            <td>{p.title}</td>
                            <td>{p.principal_agency}</td>
                            <td>{p.assigned_investigator || '-'}</td>
                            <td className="pe-3">
                              <button className="btn btn-primary-glow btn-sm" onClick={() => { fetchProjectDetail(p.id); setManagerTab('projects'); }}>
                                Review Decision
                              </button>
                            </td>
                          </tr>
                        ))}
                        {underReviewReports.length === 0 && (
                          <tr>
                            <td colSpan="5" className="text-center py-4 text-muted">All report submissions audited. No pending reviews.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* View 4: Investigators Directory */}
              {managerTab === 'investigators' && (
                <div className="card card-glass mb-4">
                  <div className="card-header card-glass-header py-3">
                    <h5 className="mb-0 fw-bold"><i className="bi bi-people"></i> Registered Investigators Team</h5>
                  </div>
                  <div className="card-body p-0">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="ps-3">Username</th>
                          <th>Email Address</th>
                          <th className="pe-3">User ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {investigators.map((user) => (
                          <tr key={user.id}>
                            <td className="ps-3"><strong>{user.username}</strong></td>
                            <td>{user.email || '-'}</td>
                            <td className="pe-3 font-monospace">{user.id}</td>
                          </tr>
                        ))}
                        {investigators.length === 0 && (
                          <tr>
                            <td colSpan="3" className="text-center py-4 text-muted">No investigator profiles registered.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* View 5: Alerts log */}
              {managerTab === 'notifications' && (
                <div className="card card-glass mb-4">
                  <div className="card-header card-glass-header py-3">
                    <h5 className="mb-0 fw-bold"><i className="bi bi-bell"></i> Alerts & Log History</h5>
                  </div>
                  <div className="card-body p-0">
                    <ul className="list-group list-group-flush">
                      {notifications.map((n) => (
                        <li 
                          key={n.id} 
                          className={`list-group-item d-flex justify-content-between align-items-start ${!n.is_read ? 'bg-light font-weight-bold' : ''}`}
                        >
                          <div className="me-auto small">
                            <div>{n.message}</div>
                            <span className="text-muted font-monospace" style={{ fontSize: '10px' }}>
                              {new Date(n.created_at).toLocaleString()}
                            </span>
                          </div>
                          {!n.is_read && (
                            <button 
                              className="btn btn-outline-primary btn-sm px-1 py-0 fs-6 ms-2"
                              style={{ fontSize: '11px' }}
                              onClick={() => markNotificationRead(n.id)}
                            >
                              Mark read
                            </button>
                          )}
                        </li>
                      ))}
                      {notifications.length === 0 && (
                        <li className="list-group-item text-center py-4 text-muted small">No notifications logged.</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {/* View 6: Live Chats Tab */}
              {managerTab === 'live-chats' && (
                <div className="card card-glass mb-4">
                  <div className="card-header card-glass-header py-3">
                    <h5 className="mb-0 fw-bold"><i className="bi bi-chat-dots-fill"></i> Secure Chat Center (Live)</h5>
                  </div>
                  <div className="card-body p-0">
                    <div className="row g-0" style={{ minHeight: '400px' }}>
                      {/* Left: Threads list */}
                      <div className="col-md-4 border-end" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        <div className="bg-light p-2 text-center text-muted small border-bottom fw-bold">Active Threads</div>
                        <div className="list-group list-group-flush">
                          {chatThreads.map((thread) => (
                            <button
                              key={thread.user_id}
                              type="button"
                              className={`list-group-item list-group-item-action border-0 d-flex justify-content-between align-items-center text-start ${activeThreadUser?.id === thread.user_id ? 'bg-primary text-white' : ''}`}
                              onClick={() => {
                                setActiveThreadUser({ id: thread.user_id, username: thread.username });
                                fetchChatMessages(thread.user_id);
                              }}
                            >
                              <div className="text-truncate" style={{ maxWidth: '80%' }}>
                                <strong className="d-block">{thread.username}</strong>
                                <span className={`small ${activeThreadUser?.id === thread.user_id ? 'text-white-50' : 'text-muted'}`}>
                                  {thread.latest_message || 'Start conversation...'}
                                </span>
                              </div>
                              {thread.unread_count > 0 && (
                                <span className="badge bg-danger rounded-circle">{thread.unread_count}</span>
                              )}
                            </button>
                          ))}
                          {chatThreads.length === 0 && (
                            <div className="list-group-item text-center py-4 text-muted small">No active chats found.</div>
                          )}
                        </div>
                      </div>

                      {/* Right: Message Window */}
                      <div className="col-md-8 d-flex flex-column" style={{ height: '500px' }}>
                        {activeThreadUser ? (
                          <>
                            {/* Thread header */}
                            <div className="bg-light p-3 border-bottom d-flex justify-content-between align-items-center">
                              <span className="fw-bold"><i className="bi bi-person-fill"></i> {activeThreadUser.username}</span>
                              <span className="badge bg-success">Online & Encrypted</span>
                            </div>

                            {/* Chat history */}
                            <div className="flex-fill p-3 bg-white" style={{ overflowY: 'auto' }}>
                              {chatMessages.map((msg, idx) => (
                                <div key={idx} className={`d-flex mb-2 ${msg.sender_username === username ? 'justify-content-end' : 'justify-content-start'}`}>
                                  <div
                                    className={`p-2 rounded small ${msg.sender_username === username ? 'bg-primary text-white' : 'bg-light text-dark border'}`}
                                    style={{ maxWidth: '75%', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
                                  >
                                    {msg.message}
                                    <div className="text-end" style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px' }}>
                                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {chatMessages.length === 0 && (
                                <div className="text-center py-5 text-muted small">Send a message to start chatting with {activeThreadUser.username}.</div>
                              )}
                            </div>

                            {/* Input Form */}
                            <form onSubmit={handleSendLiveMessage} className="p-3 border-top bg-light d-flex gap-2">
                              <input
                                type="text"
                                className="form-control"
                                placeholder={`Type your reply to ${activeThreadUser.username}...`}
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                required
                              />
                              <button type="submit" className="btn btn-primary">
                                <i className="bi bi-send"></i>
                              </button>
                            </form>
                          </>
                        ) : (
                          <div className="d-flex flex-column align-items-center justify-content-center flex-fill text-muted">
                            <i className="bi bi-chat-left-dots fs-1 mb-2"></i>
                            <span className="small">Select a registered investigator from the left list to start live messaging.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
            
            {/* Manager Sidebar (Project Detail) */}
            <div className="col-lg-4">
              {selectedProject ? (
                <div className="card card-glass mb-4">
                  <div className="card-header card-glass-header d-flex justify-content-between align-items-center py-3">
                    <h5 className="mb-0 fw-bold"><i className="bi bi-info-circle"></i> Project Details</h5>
                    <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedProject(null)}></button>
                  </div>
                  <div className="card-body">
                    <h4 className="fw-bold">{selectedProject.title}</h4>
                    <p className="text-muted mb-3">{selectedProject.project_code} | {selectedProject.project_type}</p>
                    
                    <ul className="list-group list-group-flush mb-4">
                      <li className="list-group-item ps-0"><strong>Agency:</strong> {selectedProject.principal_agency}</li>
                      <li className="list-group-item ps-0">
                        <strong>Budget:</strong> {selectedProject.budget_amount ? `${selectedProject.budget_amount} ${selectedProject.budget_unit}` : 'Not Specified'}
                      </li>
                      <li className="list-group-item ps-0"><strong>Timeline:</strong> {selectedProject.start_date} to {selectedProject.scheduled_completion}</li>
                      <li className="list-group-item ps-0"><strong>PI / Coordinator:</strong> {selectedProject.project_investigator || '-'} / {selectedProject.project_coordinator || '-'}</li>
                      <li className="list-group-item ps-0"><strong>Investigator:</strong> {selectedProject.assigned_investigator || '-'}</li>

                    </ul>

                    {selectedProject.report ? (
                      <div className="bg-dark bg-opacity-35 p-3 rounded mb-3 border border-secondary border-opacity-20">
                        <h6 className="d-flex justify-content-between mb-2">
                          <strong>Report Submission</strong>
                          <span className={`badge bg-${
                            selectedProject.report.status === 'approved' ? 'success' :
                            selectedProject.report.status === 'submitted' ? 'warning' : 'danger'
                          }`}>
                            {selectedProject.report.status}
                          </span>
                        </h6>
                        <p className="small text-muted mb-2">Submitted: {new Date(selectedProject.report.submitted_at).toLocaleString()}</p>
                        {selectedProject.report.notes && (
                          <p className="small mb-2"><strong>Notes:</strong> {selectedProject.report.notes}</p>
                        )}
                        {selectedProject.report.admin_comment && (
                          <p className="small mb-3 text-primary"><strong>Review Feedback:</strong> {selectedProject.report.admin_comment}</p>
                        )}
                        {selectedProject.report.report_file_url && (
                          <div className="d-flex gap-2">
                            <a 
                              href={`${API_BASE}${selectedProject.report.report_file_url}`} 
                              target="_blank" 
                              className="btn btn-cyan-glow btn-sm flex-fill"
                              rel="noreferrer"
                            >
                              <i className="bi bi-eye"></i> View PDF
                            </a>
                            <a 
                              href={`${API_BASE}${selectedProject.report.report_file_url}`} 
                              download 
                              className="btn btn-glass btn-sm flex-fill"
                            >
                              <i className="bi bi-download"></i> Download
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="alert alert-secondary py-2 small">No report submission loaded.</div>
                    )}

                    {selectedProject.report && selectedProject.report.status === 'submitted' && (
                      <div className="card card-glass mt-3">
                        <div className="card-header card-glass-header py-2">
                          <span className="small font-monospace fw-bold">Decision Audit Control</span>
                        </div>
                        <div className="card-body py-2 px-3">
                          <div className="mb-2">
                            <label className="form-label small mb-1">Feedback Comment (Required for Reject/Resubmit)</label>
                            <textarea 
                              className="form-control form-control-sm"
                              rows="2"
                              value={adminComment}
                              onChange={(e) => setAdminComment(e.target.value)}
                              placeholder="Enter audit feedback..."
                            ></textarea>
                          </div>
                          <div className="d-grid gap-1">
                            <button className="btn btn-primary-glow btn-sm" onClick={() => handleReviewReport('approve')}>
                              <i className="bi bi-check-circle"></i> Approve Report
                            </button>
                            <div className="d-flex gap-1 mt-1">
                              <button className="btn btn-glass btn-sm flex-fill text-danger" onClick={() => handleReviewReport('reject')}>
                                <i className="bi bi-x-circle"></i> Reject
                              </button>
                              <button className="btn btn-glass btn-sm text-warning flex-fill" onClick={() => handleReviewReport('resubmit')}>
                                <i className="bi bi-arrow-repeat"></i> Resubmit
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Project Control Panel */}
                    <div className="card card-glass mt-3">
                      <div className="card-header card-glass-header py-2 small fw-bold">
                        <i className="bi bi-gear-fill me-1"></i> Manager Action Controls
                      </div>
                      <div className="card-body py-2 px-3">
                        <div className="mb-2">
                          <label className="form-label small mb-1 fw-bold text-muted">Update Project Status</label>
                          <select 
                            className="form-select form-select-sm"
                            value={selectedProject.status}
                            onChange={(e) => handleUpdateProjectStatus(selectedProject.id, e.target.value)}
                          >
                            <option value="ongoing">Ongoing</option>
                            <option value="completed">Completed</option>
                            <option value="pending">Pending</option>
                            <option value="up_next">Up Next</option>
                          </select>
                        </div>
                        <div className="d-grid mt-3">
                          <button 
                            className="btn btn-glass btn-sm text-danger"
                            onClick={() => {
                              if (window.confirm("WARNING: Are you sure you want to permanently delete this project? This action cannot be undone.")) {
                                handleDeleteProject(selectedProject.id);
                              }
                            }}
                          >
                            <i className="bi bi-trash3-fill"></i> Delete Project
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              ) : (
                <div className="card card-glass text-center py-5 text-muted">
                  <i className="bi bi-folder2-open fs-2 mb-2 d-block text-purple" style={{ color: 'var(--accent-purple)' }}></i>
                  Select a project from the directory list to examine details.
                </div>
              )}
            </div>

          </div>
        )}

        {/* ============================================== */}
        {/* INVESTIGATOR / TEAM DASHBOARD VIEW            */}
        {/* ============================================== */}
        {!isStaff && (
          <div className="row">
            
            {/* Investigator Metrics Bar */}
            <div className="col-12 mb-4">
              <div className="row g-3">
                {/* Metric 1 */}
                <div className="col-md-4">
                  <div className="card card-glass card-glow-cyan h-100">
                    <div className="card-body p-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="text-muted small fw-bold">Running Tasks</span>
                        <i className="bi bi-play-circle-fill fs-4" style={{ color: 'var(--accent-cyan)' }}></i>
                      </div>
                      <h3 className="mb-0 fw-bold">{runningTasks.length}</h3>
                      <svg className="mt-3 w-100" height="20" viewBox="0 0 120 20">
                        <path d="M 0 12 Q 15 2 30 18 T 60 8 T 90 20 T 120 4" fill="none" stroke="var(--accent-cyan)" strokeWidth="2" filter="drop-shadow(0px 0px 4px rgba(34, 211, 238, 0.6))" />
                      </svg>
                    </div>
                  </div>
                </div>
                {/* Metric 2 */}
                <div className="col-md-4">
                  <div className="card card-glass h-100" style={{ boxShadow: '0 0 20px rgba(250, 204, 21, 0.08)' }}>
                    <div className="card-body p-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="text-muted small fw-bold">Upcoming Tasks</span>
                        <i className="bi bi-calendar-event-fill fs-4" style={{ color: 'var(--accent-yellow)' }}></i>
                      </div>
                      <h3 className="mb-0 fw-bold">{upcomingTasks.length}</h3>
                      <svg className="mt-3 w-100" height="20" viewBox="0 0 120 20">
                        <path d="M 0 16 Q 20 2 40 14 T 80 4 T 120 10" fill="none" stroke="var(--accent-yellow)" strokeWidth="2" filter="drop-shadow(0px 0px 4px rgba(250, 204, 21, 0.6))" />
                      </svg>
                    </div>
                  </div>
                </div>
                {/* Metric 3 */}
                <div className="col-md-4">
                  <div className="card card-glass h-100" style={{ boxShadow: '0 0 20px rgba(74, 222, 128, 0.08)' }}>
                    <div className="card-body p-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="text-muted small fw-bold">Past / Completed Tasks</span>
                        <i className="bi bi-check-circle-fill fs-4" style={{ color: 'var(--accent-green)' }}></i>
                      </div>
                      <h3 className="mb-0 fw-bold">{pastTasks.length}</h3>
                      <svg className="mt-3 w-100" height="20" viewBox="0 0 120 20">
                        <path d="M 0 18 Q 15 6 30 14 T 60 4 T 120 12" fill="none" stroke="var(--accent-green)" strokeWidth="2" filter="drop-shadow(0px 0px 4px rgba(74, 222, 128, 0.6))" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Investigator Options and Task List */}
            <div className="col-lg-8 mb-4">
              
              {/* Tabs for investigator views */}
              <ul className="nav nav-pills mb-3 bg-dark bg-opacity-40 p-2 rounded-4 border border-secondary border-opacity-10">
                <li className="nav-item">
                  <button 
                    className={`nav-link ${investigatorTab === 'running' ? 'active' : ''}`}
                    onClick={() => setInvestigatorTab('running')}
                  >
                    <i className="bi bi-play-circle"></i> Running Tasks ({runningTasks.length})
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className={`nav-link ${investigatorTab === 'upcoming' ? 'active' : ''}`}
                    onClick={() => setInvestigatorTab('upcoming')}
                  >
                    <i className="bi bi-calendar-event"></i> Upcoming Tasks ({upcomingTasks.length})
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className={`nav-link ${investigatorTab === 'past' ? 'active' : ''}`}
                    onClick={() => setInvestigatorTab('past')}
                  >
                    <i className="bi bi-check2-circle"></i> Past Tasks ({pastTasks.length})
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className={`nav-link ${investigatorTab === 'notifications' ? 'active' : ''}`}
                    onClick={() => setInvestigatorTab('notifications')}
                  >
                    <i className="bi bi-bell"></i> Alerts Feed 
                    {notifications.filter(n => !n.is_read).length > 0 && (
                      <span className="badge bg-danger ms-2">{notifications.filter(n => !n.is_read).length}</span>
                    )}
                  </button>
                </li>
              </ul>

              {/* Investigator Task Tables */}
              {investigatorTab !== 'notifications' ? (
                <div className="card card-glass mb-4">
                  <div className="card-header card-glass-header py-3">
                    <h5 className="mb-0 fw-bold text-capitalize">
                      {investigatorTab} Projects
                    </h5>
                  </div>
                  <div className="card-body p-0">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="ps-3">Code</th>
                          <th>Title</th>
                          <th>Agency</th>
                          <th>Timeline</th>
                          <th className="pe-3">Report Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(investigatorTab === 'running' ? runningTasks : investigatorTab === 'upcoming' ? upcomingTasks : pastTasks).map((p) => (
                          <tr 
                            key={p.id} 
                            style={{ cursor: 'pointer' }}
                            className={selectedProject?.id === p.id ? 'table-primary' : ''}
                            onClick={() => fetchProjectDetail(p.id)}
                          >
                            <td className="ps-3"><strong>{p.project_code}</strong></td>
                            <td>{p.title}</td>
                            <td>{p.principal_agency}</td>
                            <td>{p.start_date} to {p.scheduled_completion}</td>
                            <td className="pe-3">
                              <span className={
                                p.report_status === 'approved' ? 'pulse-badge-green' :
                                ['submitted', 'resubmitted'].includes(p.report_status) ? 'pulse-badge-yellow' : 'pulse-badge-red'
                              }>
                                {p.report_status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {(investigatorTab === 'running' ? runningTasks : investigatorTab === 'upcoming' ? upcomingTasks : pastTasks).length === 0 && (
                          <tr>
                            <td colSpan="5" className="text-center py-4 text-muted">No projects found in this category.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                // Notifications view
                <div className="card card-glass mb-4">
                  <div className="card-header card-glass-header py-3">
                    <h5 className="mb-0 fw-bold"><i className="bi bi-bell"></i> System Alert Log</h5>
                  </div>
                  <div className="card-body p-0">
                    <ul className="list-group list-group-flush">
                      {notifications.map((n) => (
                        <li 
                          key={n.id} 
                          className={`list-group-item d-flex justify-content-between align-items-start ${!n.is_read ? 'bg-light font-weight-bold' : ''}`}
                        >
                          <div className="me-auto small">
                            <div>{n.message}</div>
                            <span className="text-muted font-monospace" style={{ fontSize: '10px' }}>
                              {new Date(n.created_at).toLocaleString()}
                            </span>
                          </div>
                          {!n.is_read && (
                            <button 
                              className="btn btn-outline-primary btn-sm px-1 py-0 fs-6 ms-2"
                              style={{ fontSize: '11px' }}
                              onClick={() => markNotificationRead(n.id)}
                            >
                              Mark read
                            </button>
                          )}
                        </li>
                      ))}
                      {notifications.length === 0 && (
                        <li className="list-group-item text-center py-4 text-muted small">No notifications found.</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

            </div>

            {/* Investigator Sidebar Detail Card */}
            <div className="col-lg-4">
              {selectedProject ? (
                <div className="card card-glass mb-4">
                  <div className="card-header card-glass-header d-flex justify-content-between align-items-center py-3">
                    <h5 className="mb-0 fw-bold"><i className="bi bi-info-circle"></i> Project Details</h5>
                    <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedProject(null)}></button>
                  </div>
                  <div className="card-body">
                    <h4 className="fw-bold">{selectedProject.title}</h4>
                    <p className="text-muted mb-3">{selectedProject.project_code} | {selectedProject.project_type}</p>
                    
                    <ul className="list-group list-group-flush mb-4">
                      <li className="list-group-item ps-0"><strong>Agency:</strong> {selectedProject.principal_agency}</li>
                      <li className="list-group-item ps-0">
                        <strong>Budget:</strong> {selectedProject.budget_amount ? `${selectedProject.budget_amount} ${selectedProject.budget_unit}` : 'Not Specified'}
                      </li>
                      <li className="list-group-item ps-0"><strong>Timeline:</strong> {selectedProject.start_date} to {selectedProject.scheduled_completion}</li>
                      <li className="list-group-item ps-0"><strong>PI / Coordinator:</strong> {selectedProject.project_investigator || '-'} / {selectedProject.project_coordinator || '-'}</li>
                      {selectedProject.description && (
                        <li className="list-group-item ps-0">
                          <strong>Description:</strong>
                          <p className="small mt-1 mb-0">{selectedProject.description}</p>
                        </li>
                      )}
                      {selectedProject.guideline_document_url && (
                        <li className="list-group-item ps-0">
                          <strong>Guideline Document:</strong>
                          <div className="mt-1">
                            <a 
                              href={`${API_BASE}${selectedProject.guideline_document_url}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="btn btn-sm btn-cyan-glow"
                            >
                              <i className="bi bi-file-earmark-arrow-down"></i> View/Download Guidelines
                            </a>
                          </div>
                        </li>
                      )}
                    </ul>

                    {selectedProject.report ? (
                      <div className="bg-dark bg-opacity-35 p-3 rounded mb-3 border border-secondary border-opacity-20">
                        <h6 className="d-flex justify-content-between mb-2">
                          <strong>Your Submission</strong>
                          <span className={`badge bg-${
                            selectedProject.report.status === 'approved' ? 'success' :
                            selectedProject.report.status === 'submitted' ? 'warning' : 'danger'
                          }`}>
                            {selectedProject.report.status}
                          </span>
                        </h6>
                        <p className="small text-muted mb-2">Submitted: {new Date(selectedProject.report.submitted_at).toLocaleString()}</p>
                        {selectedProject.report.notes && (
                          <p className="small mb-2"><strong>Notes:</strong> {selectedProject.report.notes}</p>
                        )}
                        {selectedProject.report.admin_comment && (
                          <p className="small mb-3 text-primary"><strong>Review Feedback:</strong> {selectedProject.report.admin_comment}</p>
                        )}
                        {selectedProject.report.report_file_url && (
                          <div className="d-flex gap-2">
                            <a 
                              href={`${API_BASE}${selectedProject.report.report_file_url}`} 
                              target="_blank" 
                              className="btn btn-cyan-glow btn-sm flex-fill"
                              rel="noreferrer"
                            >
                              <i className="bi bi-eye"></i> View PDF
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="alert alert-secondary py-2 small">No report submission uploaded yet.</div>
                    )}

                    {selectedProject.status === 'ongoing' && (!selectedProject.report || ['rejected', 'resubmit_requested'].includes(selectedProject.report.status)) && (
                      <div className="card card-glass mt-3">
                        <div className="card-header card-glass-header py-2">
                          <span className="small fw-bold">Upload Task Report</span>
                        </div>
                        <div className="card-body py-2 px-3">
                          <form onSubmit={handleReportSubmit}>
                            <div className="mb-2">
                              <label className="form-label small mb-1">Upload Report (PDF)*</label>
                              <input 
                                type="file" 
                                className="form-control form-control-sm" 
                                accept=".pdf"
                                onChange={(e) => setReportFile(e.target.files[0])}
                                required 
                              />
                            </div>
                            <div className="mb-2">
                              <label className="form-label small mb-1">Notes</label>
                              <textarea 
                                className="form-control form-control-sm" 
                                rows="2"
                                value={reportNotes}
                                onChange={(e) => setReportNotes(e.target.value)}
                                placeholder="Progress notes..."
                              ></textarea>
                            </div>
                            <button type="submit" className="btn btn-primary-glow btn-sm w-100">
                              Submit Report
                            </button>
                          </form>
                        </div>
                      </div>
                    )}

                    {/* Live Chat with Manager */}
                    <div className="card card-glass mt-3">
                      <div className="card-header card-glass-header py-2 d-flex align-items-center">
                        <i className="bi bi-chat-dots-fill me-2 text-purple" style={{ color: 'var(--accent-purple)' }}></i>
                        <span className="small fw-bold">Chat with Manager (Live)</span>
                      </div>
                      <div className="card-body p-2">
                        {availableManagers.length > 0 && (
                          <div className="mb-2">
                            <label className="form-label small mb-1 fw-bold">Select Coordinator Manager:</label>
                            <select 
                              className="form-select form-select-sm"
                              value={activeThreadUser?.id || ''}
                              onChange={(e) => {
                                const selectedId = parseInt(e.target.value);
                                const selected = availableManagers.find(m => m.user_id === selectedId);
                                if (selected) {
                                  setActiveThreadUser({ id: selected.user_id, username: selected.username });
                                  fetchChatMessages(selected.user_id);
                                }
                              }}
                            >
                              {availableManagers.map(m => (
                                <option key={m.user_id} value={m.user_id}>{m.username} ({m.email || 'no email'})</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {activeThreadUser ? (
                          <>
                            {/* Message History */}
                            <div className="chat-history mb-2 border rounded bg-white p-2" style={{ height: '220px', overflowY: 'auto' }}>
                              {chatMessages.map((msg, idx) => (
                                <div key={idx} className={`d-flex mb-2 ${msg.sender_username === username ? 'justify-content-end' : 'justify-content-start'}`}>
                                  <div 
                                    className={`p-2 rounded small ${msg.sender_username === username ? 'bg-primary text-white' : 'bg-light text-dark border'}`}
                                    style={{ maxWidth: '85%', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
                                  >
                                    {msg.message}
                                    <div className="text-end" style={{ fontSize: '8px', opacity: 0.7, marginTop: '2px' }}>
                                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {chatMessages.length === 0 && (
                                <div className="text-center py-4 text-muted small">No message history. Type below to text the Manager.</div>
                              )}
                            </div>
                            
                            {/* Chat Form */}
                            <form onSubmit={handleSendLiveMessage} className="d-flex gap-1">
                              <input 
                                type="text"
                                className="form-control form-control-sm"
                                placeholder={`Message ${activeThreadUser.username}...`}
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                required
                              />
                              <button type="submit" className="btn btn-cyan-glow btn-sm">
                                <i className="bi bi-send"></i>
                              </button>
                            </form>
                          </>
                        ) : (
                          <div className="text-center py-3 text-muted small">
                            No manager available to chat.
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              ) : (
                <div className="card shadow-sm text-center py-5 text-muted bg-light">
                  <i className="bi bi-card-checklist fs-2 mb-2 d-block"></i>
                  Select any task from the category list to review metadata details or submit compliance reports.
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
    </div>
  );
}

export default App;
