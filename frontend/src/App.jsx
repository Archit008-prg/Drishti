import React, { useState, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// ─── Smart budget formatter ──────────────────────────────────────────────────
const formatBudget = (amount, unit) => {
  const amt = parseFloat(amount);
  if (!amount || isNaN(amt)) return '—';
  const rupees = amt * ({ rupees: 1, thousands: 1000, lakhs: 100000, crores: 10000000 }[unit] || 1);
  if (rupees >= 10000000) return (rupees / 10000000).toFixed(2) + ' Cr';
  if (rupees >= 100000)   return (rupees / 100000).toFixed(2) + ' L';
  if (rupees >= 1000)     return (rupees / 1000).toFixed(2) + ' K';
  return '₹' + rupees.toFixed(0);
};

// ─── Timeline milestone builder (4 stages) ───────────────────────────────────
const getMilestonesForProject = (project) => {
  // No project selected → generic idle state
  if (!project) {
    return [
      { label: 'Task Initiated',  status: 'upcoming',  icon: 'bi-play-circle',    color: '#9b4dff', role: 'Coordinator' },
      { label: 'Report Submitted', status: 'upcoming', icon: 'bi-file-earmark-text', color: '#3b82f6', role: 'Investigator' },
      { label: 'Under Review',    status: 'upcoming',  icon: 'bi-search',          color: '#f59e0b', role: 'Manager' },
      { label: 'Decision',        status: 'upcoming',  icon: 'bi-shield-check',    color: '#10b981', role: 'Manager' },
    ];
  }

  const pStatus    = (project.status         || 'ongoing').toLowerCase();
  const rStatus    = (project.report_status  || 'not_submitted').toLowerCase();

  // Stage 4 — Final decision reached
  if (rStatus === 'approved' || pStatus === 'completed') {
    return [
      { label: 'Task Initiated',  status: 'completed', icon: 'bi-check2',            color: '#9b4dff', role: 'Coordinator' },
      { label: 'Report Submitted', status: 'completed', icon: 'bi-check2',           color: '#3b82f6', role: 'Investigator' },
      { label: 'Under Review',    status: 'completed', icon: 'bi-check2',             color: '#f59e0b', role: 'Manager' },
      { label: 'Approved ✓',      status: 'approved',  icon: 'bi-shield-fill-check', color: '#10b981', role: 'Manager' },
    ];
  }
  if (rStatus === 'rejected') {
    return [
      { label: 'Task Initiated',  status: 'completed', icon: 'bi-check2',         color: '#9b4dff', role: 'Coordinator' },
      { label: 'Report Submitted', status: 'completed', icon: 'bi-check2',        color: '#3b82f6', role: 'Investigator' },
      { label: 'Under Review',    status: 'completed', icon: 'bi-check2',          color: '#f59e0b', role: 'Manager' },
      { label: 'Rejected ✗',      status: 'rejected',  icon: 'bi-x-circle-fill',  color: '#ef4444', role: 'Manager' },
    ];
  }
  if (rStatus === 'resubmit_requested') {
    return [
      { label: 'Task Initiated',  status: 'completed',          icon: 'bi-check2',       color: '#9b4dff', role: 'Coordinator' },
      { label: 'Report Submitted', status: 'completed',         icon: 'bi-check2',       color: '#3b82f6', role: 'Investigator' },
      { label: 'Under Review',    status: 'completed',          icon: 'bi-check2',       color: '#f59e0b', role: 'Manager' },
      { label: 'Resubmit 🔄',     status: 'resubmit_requested', icon: 'bi-arrow-repeat', color: '#f59e0b', role: 'Manager' },
    ];
  }

  // Stage 3 — report submitted, manager reviewing
  if (['submitted', 'resubmitted'].includes(rStatus)) {
    return [
      { label: 'Task Initiated',  status: 'completed', icon: 'bi-check2',            color: '#9b4dff', role: 'Coordinator' },
      { label: 'Report Submitted', status: 'completed', icon: 'bi-check2',           color: '#3b82f6', role: 'Investigator' },
      { label: 'Under Review',    status: 'active',    icon: 'bi-hourglass-split',   color: '#f59e0b', role: 'Manager' },
      { label: 'Decision',        status: 'upcoming',  icon: 'bi-shield-check',      color: '#10b981', role: 'Manager' },
    ];
  }

  // Stage 2 — project ongoing, investigator working
  if (pStatus === 'ongoing') {
    return [
      { label: 'Task Initiated',  status: 'completed', icon: 'bi-check2',               color: '#9b4dff', role: 'Coordinator' },
      { label: 'Report Submitted', status: 'active',   icon: 'bi-file-earmark-arrow-up', color: '#3b82f6', role: 'Investigator' },
      { label: 'Under Review',    status: 'upcoming',  icon: 'bi-search',               color: '#f59e0b', role: 'Manager' },
      { label: 'Decision',        status: 'upcoming',  icon: 'bi-shield-check',         color: '#10b981', role: 'Manager' },
    ];
  }

  // Stage 1 — just assigned, task initiated
  return [
    { label: 'Task Initiated',  status: 'active',   icon: 'bi-play-circle',    color: '#9b4dff', role: 'Coordinator' },
    { label: 'Report Submitted', status: 'upcoming', icon: 'bi-file-earmark-text', color: '#3b82f6', role: 'Investigator' },
    { label: 'Under Review',    status: 'upcoming', icon: 'bi-search',          color: '#f59e0b', role: 'Manager' },
    { label: 'Decision',        status: 'upcoming', icon: 'bi-shield-check',    color: '#10b981', role: 'Manager' },
  ];
};

// ─── Reusable 4-node Timeline Canvas component ───────────────────────────────
const TimelineCanvas = ({ project, gradId = 'flowGrad4' }) => {
  const milestones = getMilestonesForProject(project);
  const completedCount = milestones.filter(m => m.status === 'completed').length;
  const activeIdx = milestones.findIndex(m => m.status === 'active' || m.status === 'approved' || m.status === 'rejected' || m.status === 'resubmit_requested');

  // Progress: each segment = 33.3%; active node = segment midpoint
  let progressPercent = 0;
  if (!project) progressPercent = 0;
  else if (completedCount === 4) progressPercent = 100;
  else if (completedCount === 3) progressPercent = activeIdx >= 0 ? 88 : 75;
  else if (completedCount === 2) progressPercent = activeIdx >= 0 ? 55 : 50;
  else if (completedCount === 1) progressPercent = activeIdx >= 0 ? 22 : 18;
  else progressPercent = 5;

  const strokeLength = 700;
  const strokeDashoffset = strokeLength - (strokeLength * progressPercent) / 100;

  // 4-node positions along an S-curve: x: 70, 260, 490, 710; y alternates 75, 170, 75, 170
  const nodePos = [
    { x: 70,  y: 75  },
    { x: 260, y: 170 },
    { x: 490, y: 75  },
    { x: 710, y: 170 },
  ];

  return (
    <div className="position-relative" style={{ minHeight: '260px' }}>
      {/* SVG curved path */}
      <svg
        className="position-absolute top-0 start-0 w-100 h-100"
        viewBox="0 0 800 250"
        preserveAspectRatio="none"
        style={{ pointerEvents: 'none' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#9b4dff" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        {/* Dim underlay */}
        <path
          d="M 70 75 C 140 170, 190 170, 260 170 C 330 170, 420 75, 490 75 C 560 75, 640 170, 710 170"
          fill="none" stroke="rgba(220,220,235,0.16)" strokeWidth="3" strokeLinecap="round"
        />
        {/* Glowing progress overlay */}
        <path
          d="M 70 75 C 140 170, 190 170, 260 170 C 330 170, 420 75, 490 75 C 560 75, 640 170, 710 170"
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={strokeLength}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.9s ease-in-out', filter: 'drop-shadow(0 0 5px rgba(155,77,255,0.7))' }}
        />
      </svg>

      {/* Milestone nodes */}
      {milestones.map((m, idx) => {
        const isActive    = m.status === 'active';
        const isCompleted = m.status === 'completed';
        const isApproved  = m.status === 'approved';
        const isRejected  = m.status === 'rejected';
        const isResubmit  = m.status === 'resubmit_requested';
        const isFinal     = isApproved || isRejected || isResubmit;

        const nodeColor = isFinal ? m.color :
                          isCompleted ? '#9b4dff' :
                          isActive    ? m.color :
                          'rgba(255,255,255,0.06)';

        const glowColor = isFinal ? m.color :
                          isActive ? m.color : '#9b4dff';

        const nx = nodePos[idx].x;
        const ny = nodePos[idx].y;
        // Convert SVG coords to % for absolute positioning
        const leftPct = `${(nx / 800) * 100}%`;
        const topPct  = `${(ny / 250) * 100}%`;

        return (
          <div
            key={idx}
            className="position-absolute d-flex flex-column align-items-center"
            style={{ left: leftPct, top: topPct, transform: 'translate(-50%, -50%)', zIndex: 10 }}
          >
            <div
              className="d-flex align-items-center justify-content-center rounded-circle"
              style={{
                width: '40px', height: '40px',
                backgroundColor: nodeColor,
                border: `2px solid ${(isActive || isFinal) ? glowColor : 'rgba(255,255,255,0.12)'}`,
                boxShadow: (isActive || isFinal) ? `0 0 18px ${glowColor}88` : 'none',
                transition: 'all 0.4s ease',
                position: 'relative',
              }}
            >
              {isActive && (
                <span style={{
                  position: 'absolute', inset: '-6px',
                  borderRadius: '50%',
                  background: `${glowColor}30`,
                  animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
                }} />
              )}
              <i className={`bi ${m.icon} text-white`} style={{ fontSize: '14px' }} />
            </div>
            <div className="mt-2 text-center" style={{ minWidth: '90px', maxWidth: '95px' }}>
              <span className="d-block fw-semibold" style={{ fontSize: '9px', color: (isActive || isFinal) ? '#fff' : 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>
                {m.label}
              </span>
              <span className="d-block" style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)' }}>
                {m.role}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const EktaTab = ({ isStaff, projects, selectedProject, onSelectProject, token }) => {
  const [chatHistories, setChatHistories] = useState({});
  const currentChatId = selectedProject ? selectedProject.id : 'system';
  
  const messages = chatHistories[currentChatId] || [{ sender: 'ekta', text: 'Hi! I am Ekta. Ask me anything about ' + (selectedProject ? 'the documents in this project.' : 'Drishti, or select a project to ask about its documents.') }];

  const setMessages = (updater) => {
    setChatHistories(prev => {
      const currentMsgs = prev[currentChatId] || [{ sender: 'ekta', text: 'Hi! I am Ekta. Ask me anything about ' + (selectedProject ? 'the documents in this project.' : 'Drishti, or select a project to ask about its documents.') }];
      const nextMsgs = typeof updater === 'function' ? updater(currentMsgs) : updater;
      return { ...prev, [currentChatId]: nextMsgs };
    });
  };

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [docs, setDocs] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);

  // Handle Paste for files
  useEffect(() => {
    const handlePaste = (e) => {
      if (e.clipboardData.files && e.clipboardData.files.length > 0) {
        setUploadFile(e.clipboardData.files[0]);
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch docs for selected project
  useEffect(() => {
    if (selectedProject && token) {
      fetchDocs();
    } else {
      setDocs([]);
    }
  }, [selectedProject, token]);

  const fetchDocs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ekta/documents/${selectedProject.id}/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDocs(data);
      }
    } catch (e) {
      console.error('Failed to fetch docs:', e);
    }
  };

  const handleUpload = async (fileToUpload) => {
    if (!fileToUpload || !selectedProject) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('project_id', selectedProject.id);

    try {
      const res = await fetch(`${API_BASE}/api/ekta/upload/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        setUploadFile(null);
        fetchDocs();
      } else {
        alert("Upload failed or file type not supported.");
        setUploadFile(null);
      }
    } catch (e) {
      console.error(e);
      setUploadFile(null);
    }
    setUploading(false);
  };

  // Auto-upload when a file is pasted/selected
  useEffect(() => {
    if (uploadFile && selectedProject) {
      handleUpload(uploadFile);
    }
  }, [uploadFile, selectedProject]);

  const handleDeleteDoc = async (docId) => {
    if (!window.confirm("Delete this document?")) return;
    try {
      await fetch(`${API_BASE}/api/ekta/documents/${docId}/delete/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchDocs();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const q = input.trim();
    setInput('');
    setMessages(prev => [...prev, { sender: 'user', text: q }]);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/ekta/query/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ question: q, project_id: selectedProject ? selectedProject.id : null })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { 
        sender: 'ekta', 
        text: data.answer, 
        in_scope: data.in_scope, 
        sources: data.sources 
      }]);
    } catch (e) {
      setMessages(prev => [...prev, { sender: 'ekta', text: "Error connecting to Ekta AI.", in_scope: false }]);
    }
    setIsLoading(false);
  };

  const handleClearEkta = () => {
    if (!window.confirm("Clear this Ekta AI chat history?")) return;
    setMessages([{ sender: 'ekta', text: 'Hi! I am Ekta. Ask me anything about ' + (selectedProject ? 'the documents in this project.' : 'Drishti, or select a project to ask about its documents.') }]);
  };

  return (
    <div className="row h-100">
      {/* Left Column (Manager: Upload Docs, Investigator: Doc List) */}
      <div className="col-lg-4 mb-4 mb-lg-0 d-flex flex-column gap-3">
        {/* Project Selector */}
        <div className="card card-glass p-3">
          <label className="text-white-50 small mb-2 fw-bold">CONTEXT PROJECT</label>
          <select 
            className="form-select glass-input text-white" 
            value={selectedProject ? selectedProject.id : ''}
            onChange={(e) => {
              const p = projects.find(p => p.id === parseInt(e.target.value));
              onSelectProject(p || null);
            }}
          >
            <option value="" className="text-dark">-- Select Project --</option>
            {projects.map(p => (
              <option key={p.id} value={p.id} className="text-dark">{p.title} ({p.project_code})</option>
            ))}
          </select>
        </div>


        {selectedProject && (
          <div className="card card-glass p-3 flex-fill overflow-auto" style={{ maxHeight: '400px' }}>
            <h6 className="fw-bold mb-3"><i className="bi bi-journal-text text-violet-400 me-2"></i>Indexed Documents</h6>
            {docs.length === 0 ? (
              <p className="text-white-50 small">No documents uploaded for this project yet.</p>
            ) : (
              <ul className="list-group list-group-flush">
                {docs.map(d => (
                  <li key={d.id} className="list-group-item bg-transparent border-white-10 px-0 d-flex justify-content-between align-items-center">
                    <div>
                      <span className="d-block text-white small text-truncate" style={{ maxWidth: '180px' }}>{d.filename}</span>
                      <span className="text-white-50" style={{ fontSize: '10px' }}>
                        {d.is_indexed ? <span className="text-success">✓ Indexed ({d.chunk_count} chunks)</span> : <span className="text-warning">✗ Not Indexed</span>}
                      </span>
                    </div>
                    {isStaff && (
                      <button className="btn btn-sm text-danger" onClick={() => handleDeleteDoc(d.id)}><i className="bi bi-trash"></i></button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Right Column: Chat Interface */}
      <div className="col-lg-8">
        <div className="card card-glass h-100 d-flex flex-column border-0" style={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)' }}>
          <div className="card-header border-bottom border-white-10 py-4 px-4 d-flex justify-content-between align-items-center" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
            <div className="d-flex align-items-center">
              <div className="position-relative me-4">
                <div className="rounded-circle bg-violet-600 d-flex align-items-center justify-content-center" style={{ width: '48px', height: '48px', boxShadow: '0 0 20px rgba(139,92,246,0.5)' }}>
                  <i className="bi bi-robot text-white fs-4"></i>
                </div>
                <span className="position-absolute bottom-0 end-0 rounded-circle bg-success" style={{ width: '12px', height: '12px', border: '2px solid #13141c' }}></span>
              </div>
              <div>
                <h5 className="mb-1 fw-bold tracking-tight text-white">Ekta AI</h5>
                <span className="text-white-50" style={{ fontSize: '13px', fontWeight: '500' }}>{selectedProject ? `RAG Assistant — ${selectedProject.title}` : 'System Assistant — Drishti Help'}</span>
              </div>
            </div>
            <button className="btn btn-sm btn-outline-danger d-flex align-items-center gap-2 rounded-pill px-3 py-1" onClick={handleClearEkta} title="Clear Context & Chat">
              <i className="bi bi-eraser-fill"></i> <span className="small fw-medium">Clear Chat</span>
            </button>
          </div>

          <div className="card-body p-4 p-md-5 d-flex flex-column" style={{ overflowY: 'auto', minHeight: '500px', scrollBehavior: 'smooth' }}>
            {messages.map((m, i) => (
              <div key={i} className={`d-flex mb-4 ${m.sender === 'user' ? 'justify-content-end' : 'justify-content-start'}`}>
                {m.sender === 'ekta' && (
                  <div className="me-3 position-relative flex-shrink-0" style={{ width: '38px', height: '38px', marginTop: '2px' }}>
                    <div className="rounded-circle d-flex align-items-center justify-content-center w-100 h-100 position-relative z-1" style={{ background: 'linear-gradient(135deg, #1e1e2d 0%, #2d2b45 100%)', border: '1px solid rgba(139,92,246,0.5)' }}>
                      <i className="bi bi-robot text-violet-300" style={{ fontSize: '18px' }}></i>
                    </div>
                    <div className="position-absolute top-50 start-50 translate-middle rounded-circle" style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #8B5CF6 0%, #ec4899 100%)', filter: 'blur(8px)', opacity: 0.5, zIndex: 0 }}></div>
                  </div>
                )}
                <div 
                  className={`p-3 p-md-4 rounded-4 position-relative ${m.sender === 'user' ? 'text-white' : 'text-white'}`}
                  style={{ 
                    maxWidth: '80%', 
                    borderBottomRightRadius: m.sender === 'user' ? '4px' : '1.2rem',
                    borderTopLeftRadius: m.sender === 'ekta' ? '4px' : '1.2rem',
                    borderBottomLeftRadius: '1.2rem',
                    borderTopRightRadius: '1.2rem',
                    background: m.sender === 'user' ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : 'rgba(25, 25, 35, 0.7)',
                    backdropFilter: m.sender === 'ekta' ? 'blur(10px)' : 'none',
                    border: m.sender === 'user' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(139,92,246,0.2)',
                    boxShadow: m.sender === 'user' ? '0 8px 25px rgba(99, 102, 241, 0.4)' : '0 8px 25px rgba(0,0,0,0.2)',
                  }}
                >
                  <p className="mb-0" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', fontSize: '14.5px', letterSpacing: '0.3px', fontWeight: '400', fontFamily: 'Inter, system-ui, sans-serif' }}>{m.text}</p>
                  
                  {m.sender === 'ekta' && m.in_scope === false && (
                    <div className="mt-3 pt-3 border-top" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                      <span className="badge bg-warning text-dark px-2 py-1 shadow-sm" style={{ fontSize: '11px', fontWeight: '600', borderRadius: '6px' }}><i className="bi bi-exclamation-triangle-fill me-1"></i> Out of scope</span>
                    </div>
                  )}
                  {m.sender === 'ekta' && m.sources && m.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-top" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                      <span className="text-white-50 d-flex align-items-center gap-2" style={{ fontSize: '11.5px', lineHeight: '1.4' }}>
                        <i className="bi bi-file-earmark-text text-violet-400"></i>
                        <span>Sources: <span className="text-white-75 fw-semibold">{m.sources.join(', ')}</span></span>
                      </span>
                    </div>
                  )}
                </div>
                {m.sender === 'user' && (
                  <div className="ms-3 rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 bg-white-10 shadow" style={{ width: '38px', height: '38px', marginTop: '2px', border: '1px solid rgba(255,255,255,0.2)' }}>
                    <i className="bi bi-person-fill text-white" style={{ fontSize: '18px' }}></i>
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="d-flex mb-4 justify-content-start align-items-center">
                <div className="me-3 rounded-circle bg-violet-600 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '32px', height: '32px' }}>
                  <i className="bi bi-robot text-white" style={{ fontSize: '14px' }}></i>
                </div>
                <div className="p-3 rounded-4 bg-white-10 text-white border border-white-10 d-flex align-items-center gap-2" style={{ borderTopLeftRadius: '4px' }}>
                  <span className="spinner-grow spinner-grow-sm text-violet-400" role="status"></span>
                  <span className="spinner-grow spinner-grow-sm text-violet-400" role="status" style={{ animationDelay: '0.15s' }}></span>
                  <span className="spinner-grow spinner-grow-sm text-violet-400" role="status" style={{ animationDelay: '0.3s' }}></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="card-footer py-4 px-4 px-md-5 border-top border-white-10 position-relative" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
            {uploading && (
              <div className="position-absolute" style={{ top: '-40px', left: '40px', zIndex: 10 }}>
                <span className="badge bg-primary rounded-pill px-3 py-2 shadow" style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)' }}>
                  <span className="spinner-border spinner-border-sm me-2"></span> Uploading {uploadFile?.name}...
                </span>
              </div>
            )}
            <form onSubmit={handleSend} className="d-flex gap-3 align-items-center position-relative">
              {selectedProject && (
                <label className="btn btn-glass rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 shadow-sm" style={{ width: '52px', height: '52px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.03)', transition: 'all 0.3s' }} title="Attach file">
                  <i className="bi bi-paperclip fs-4 text-violet-300"></i>
                  <input 
                    type="file" 
                    className="d-none"
                    onChange={e => setUploadFile(e.target.files[0])}
                    accept=".pdf,.txt,.md,.doc,.docx,.png,.jpg,.jpeg"
                  />
                </label>
              )}
              <div className="position-relative flex-fill d-flex align-items-center">
                <input 
                  type="text" 
                  className="form-control glass-input text-white flex-fill py-3 px-4 rounded-pill shadow-sm" 
                  placeholder={selectedProject ? "Message Ekta AI or paste a file (Ctrl+V)..." : "Ask Ekta about Drishti..."}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={isLoading || uploading}
                  style={{ fontSize: '15.5px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(139,92,246,0.3)', transition: 'all 0.3s' }}
                  onFocus={(e) => e.target.style.boxShadow = '0 0 15px rgba(139,92,246,0.25)'}
                  onBlur={(e) => e.target.style.boxShadow = 'none'}
                />
              </div>
              <button 
                type="submit" 
                className="btn btn-primary rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 shadow"
                disabled={isLoading || !input.trim() || uploading}
                style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)', border: 'none', boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)', transition: 'all 0.2s transform' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <i className="bi bi-arrow-up-short fs-3 fw-bold"></i>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Profile Management Component ─────────────────────────────────────────────
const ProfileTab = ({ token }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ bio: '', phone: '', is_public: true, email: '' });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, [token]);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/profile/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setFormData({ bio: data.bio || '', phone: data.phone || '', is_public: data.is_public, email: data.email || '' });
        setAvatarPreview(data.avatar);
      }
    } catch (e) { console.error("Error fetching profile", e); }
    finally { setLoading(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const form = new FormData();
    form.append('bio', formData.bio);
    form.append('phone', formData.phone);
    form.append('email', formData.email);
    form.append('is_public', formData.is_public);
    if (avatarFile) {
      form.append('avatar', avatarFile);
    }

    try {
      const res = await fetch(`${API_BASE}/api/profile/`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form
      });
      if (res.ok) {
        alert("Profile updated successfully!");
        fetchProfile();
      } else {
        alert("Failed to update profile.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving profile");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  if (loading) return <div className="text-center py-5"><span className="spinner-border text-primary"></span></div>;

  return (
    <div className="container-fluid py-4" style={{ maxWidth: '800px' }}>
      <div className="card card-glass shadow-lg border-0 rounded-4 overflow-hidden" style={{ background: 'rgba(25,25,35,0.7)', backdropFilter: 'blur(20px)' }}>
        <div className="card-header border-bottom border-white-10 py-4 px-4 px-md-5" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(236,72,153,0.05) 100%)' }}>
          <h4 className="mb-0 fw-bold tracking-tight text-white"><i className="bi bi-person-lines-fill me-3 text-violet-400"></i>Manage Profile</h4>
        </div>
        <div className="card-body p-4 p-md-5">
          <form onSubmit={handleSave}>
            <div className="d-flex align-items-center mb-5 pb-4 border-bottom border-white-10 gap-4">
              <div className="position-relative">
                <div className="rounded-circle overflow-hidden shadow-sm d-flex align-items-center justify-content-center bg-dark" style={{ width: '100px', height: '100px', border: '3px solid rgba(139,92,246,0.3)' }}>
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <i className="bi bi-person-fill text-white-50" style={{ fontSize: '3rem' }}></i>
                  )}
                </div>
                <label className="position-absolute bottom-0 end-0 btn btn-sm btn-primary rounded-circle shadow d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px', cursor: 'pointer' }}>
                  <i className="bi bi-camera-fill"></i>
                  <input type="file" className="d-none" accept="image/*" onChange={handleAvatarChange} />
                </label>
              </div>
              <div>
                <h5 className="mb-1 text-white fw-bold">{profile?.username}</h5>
                <span className="badge bg-white-10 text-white-75 px-3 py-2 rounded-pill fw-medium">{profile?.is_staff ? 'Manager' : 'Investigator'}</span>
              </div>
            </div>

            <div className="row g-4">
              <div className="col-md-6">
                <label className="form-label text-white-75 fw-medium small mb-2">Email Address</label>
                <input type="email" className="form-control glass-input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="col-md-6">
                <label className="form-label text-white-75 fw-medium small mb-2">Phone Number</label>
                <input type="text" className="form-control glass-input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div className="col-12">
                <label className="form-label text-white-75 fw-medium small mb-2">Bio</label>
                <textarea className="form-control glass-input" rows="3" value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} placeholder="Tell us about yourself..."></textarea>
              </div>
              <div className="col-12 mt-4">
                <div className="form-check form-switch d-flex align-items-center gap-3">
                  <input className="form-check-input" type="checkbox" id="publicProfileSwitch" style={{ width: '40px', height: '20px', cursor: 'pointer' }} checked={formData.is_public} onChange={e => setFormData({...formData, is_public: e.target.checked})} />
                  <label className="form-check-label text-white-75" htmlFor="publicProfileSwitch" style={{ cursor: 'pointer' }}>
                    <span className="d-block fw-medium text-white mb-1">Public Profile</span>
                    <span className="small">Allow other users to see your email, phone, and bio in chat. (Your avatar is always visible).</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-5 text-end">
              <button type="submit" className="btn btn-primary px-5 py-2 fw-semibold rounded-3 shadow-sm" disabled={saving}>
                {saving ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-check-circle me-2"></i>}
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ─── Dashboard Stat Cards (Unified for Manager & Investigator) ───────────────
const DashboardStatCards = ({ projects, isManager }) => {
  const total = projects.length;
  const pendingCount = isManager 
    ? projects.filter(p => ['submitted', 'resubmitted'].includes(p.report_status)).length
    : projects.filter(p => p.report_status === 'resubmit_requested' || p.status === 'pending').length;
  const ongoingCount = projects.filter(p => p.status === 'ongoing').length;
  const completedCount = projects.filter(p => p.status === 'completed').length;

  const cards = [
    { title: isManager ? 'Total Projects' : 'Assigned Projects', value: total, icon: 'bi-folder-fill', color: 'purple', cssClass: 'card-glow-purple', accent: 'var(--accent-purple)' },
    { title: isManager ? 'Pending Reviews' : 'Pending Actions', value: pendingCount, icon: 'bi-hourglass-split', color: 'yellow', cssClass: 'card-glow-yellow', accent: 'var(--accent-yellow)' },
    { title: 'Ongoing Tasks', value: ongoingCount, icon: 'bi-activity', color: 'blue', cssClass: 'card-glow-cyan', accent: 'var(--accent-blue)' },
    { title: 'Completed Tasks', value: completedCount, icon: 'bi-check-circle-fill', color: 'emerald', cssClass: 'card-glow-emerald', accent: 'var(--accent-emerald)' },
  ];

  return (
    <div className="row g-4 mb-4">
      {cards.map((c, i) => {
        const percent = total === 0 ? 0 : (c.value / total);
        const strokeOffset = 110 - (110 * percent);
        return (
          <div className="col-md-3" key={i}>
            <div className={`card card-glass ${c.cssClass} h-100`}>
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-muted small fw-bold">{c.title}</span>
                  <i className={`bi ${c.icon} fs-4`} style={{ color: c.accent }}></i>
                </div>
                <h3 className="mb-0 fw-bold">{c.value}</h3>
                <svg className="mt-3 w-100" height="35" viewBox="0 0 120 35">
                  {/* Subtle track */}
                  <path d="M 5 25 L 115 25" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" strokeLinecap="round" />
                  {/* Fill relative to total projects */}
                  <path 
                    d="M 5 25 L 115 25" 
                    fill="none" 
                    stroke={c.accent} 
                    strokeWidth="4" 
                    strokeLinecap="round" 
                    strokeDasharray="110"
                    strokeDashoffset={strokeOffset}
                    style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                    filter={`drop-shadow(0px 0px 6px ${c.accent}88)`}
                  />
                </svg>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

function App() {
  // ─── Auth state — stored in sessionStorage (per-tab, auto-cleared on close)
  // This isolates Manager and Investigator tabs from each other.
  const [token, setToken] = useState(() => {
    const stored = sessionStorage.getItem('token');
    const expiry = sessionStorage.getItem('tokenExpiry');
    // If the token has expired, clear and return empty
    if (stored && expiry && Date.now() > parseInt(expiry)) {
      sessionStorage.clear();
      return '';
    }
    return stored || '';
  });
  const [username, setUsername] = useState(() => sessionStorage.getItem('username') || '');
  const [isStaff, setIsStaff] = useState(() => sessionStorage.getItem('isStaff') === 'true');
  
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
  const [projectDocs, setProjectDocs] = useState([]);
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
  
  // Custom Popup State
  const [showAssignmentsPopup, setShowAssignmentsPopup] = useState(false);
  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Project Reference Document Upload state
  const [refUploadFile, setRefUploadFile] = useState(null);
  const [refUploading, setRefUploading] = useState(false);

  useEffect(() => {
    if (token) {
      fetchProjects();
      fetchNotifications();
      if (isStaff) {
        fetchInvestigators();
      }
      fetchChatConversations();
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
    // Use sessionStorage so each browser tab is fully isolated.
    // A Manager tab and Investigator tab cannot affect each other.
    const expiryTime = Date.now() + (8 * 60 * 60 * 1000); // 8 hours from now
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('username', username);
    sessionStorage.setItem('isStaff', isStaff ? 'true' : 'false');
    sessionStorage.setItem('tokenExpiry', expiryTime.toString());
    setCurrentView('dashboard');
  };

  const logout = () => {
    setToken('');
    setUsername('');
    setIsStaff(false);
    setSelectedProject(null);
    setProjects([]);
    // Clear only this tab's session data, not other tabs
    sessionStorage.clear();
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
          saveAuth(data.jwt_access, data.username, data.is_staff);
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

  // ─── Authenticated fetch helper ────────────────────────────────────────────
  // Every API call should go through this. If the server returns 401 (token
  // expired or invalid), the user is automatically logged out and shown the
  // login screen. This prevents "ghost sessions" where the UI is visible but
  // all API calls silently fail.
  const authFetch = async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    if (res.status === 401) {
      // Token is expired or invalid — force logout immediately
      logout();
      return null;
    }
    return res;
  };

  const fetchProjects = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/projects/`);
      if (!res) return;
      const data = await res.json();
      if (res.ok) setProjects(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProjectDetail = async (id) => {
    try {
      const res = await authFetch(`${API_BASE}/api/projects/${id}/`);
      if (!res) return;
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
      const res = await authFetch(`${API_BASE}/api/investigators/`);
      if (!res) return;
      const data = await res.json();
      if (res.ok) setInvestigators(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/notifications/`);
      if (!res) return;
      const data = await res.json();
      if (res.ok) setNotifications(data);
    } catch (err) {
      console.error(err);
    }
  };

  const markNotificationRead = async (id) => {
    try {
      const res = await authFetch(`${API_BASE}/api/notifications/${id}/read/`, {
        method: 'POST',
      });
      if (!res) return;
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
    
    Array.from(projectDocs).forEach(file => {
      formData.append('docs', file);
    });

    console.log("--- SUBMITTING NEW PROJECT PAYLOAD ---");
    for (let [key, value] of formData.entries()) {
      console.log(key, ":", value);
    }

    try {
      const res = await fetch(`${API_BASE}/api/projects/add/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
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
        setProjectDocs([]);
      } else {
        const text = await res.text();
        console.error("Backend Error Response Text:", text);
        try {
          const errData = JSON.parse(text);
          console.error("Backend JSON Error:", errData);
          alert(`Backend Error (${res.status}): ${errData.error || JSON.stringify(errData)}`);
        } catch (parseErr) {
          alert(`Backend Error (${res.status}): HTML/Non-JSON response returned. See console for text.`);
        }
      }
    } catch (err) {
      console.error("Network/Fetch Exception:", err);
      alert(`Network/Fetch Error: ${err.message}`);
    }
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    const payload = {
      title: projectTitle,
      description: projectDesc,
      principal_agency: principalAgency,
      budget_amount: budgetAmount,
      budget_unit: budgetUnit,
      start_date: startDate,
      scheduled_completion: scheduledCompletion,
      status: projectStatus,
      project_investigator: piName,
      project_coordinator: pcName,
      implementing_agencies: implAgencies,
      assigned_investigator: assignedInvestigatorId
    };

    try {
      const res = await fetch(`${API_BASE}/api/projects/${selectedProject.id}/update/`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert('Project updated successfully!');
        setManagerTab('projects');
        fetchProjects();
        fetchProjectDetail(selectedProject.id); // refresh the details sidebar
      } else {
        const data = await res.json();
        alert(`Error: ${data.error || 'Failed to update project'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error');
    }
  };

  const handleEditProjectClick = (p) => {
    setProjectCode(p.project_code || '');
    setProjectType(p.project_type || 'S&T');
    setProjectTitle(p.title || '');
    setProjectDesc(p.description || '');
    setPrincipalAgency(p.principal_agency || '');
    setBudgetAmount(p.budget_amount || '');
    setBudgetUnit(p.budget_unit || 'lakhs');
    setStartDate(p.start_date || '');
    setScheduledCompletion(p.scheduled_completion || '');
    setProjectStatus(p.status || 'ongoing');
    setAssignedInvestigatorId(p.assigned_investigator || '');
    setPiName(p.project_investigator || '');
    setPcName(p.project_coordinator || '');
    setImplAgencies(p.implementing_agencies || '');
    setProjectDocs([]); // Reset docs for update (we don't prefill existing docs into a file input)
    setSelectedProject(p);
    setManagerTab('edit-project');
  };

  const fetchChatMessages = async (userId) => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/api/chat/messages/?with_user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data);
      }
    } catch (err) {
      console.error('Error fetching chat messages:', err);
    }
  };

  const fetchChatConversations = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/chat/conversations/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChatThreads(data);
        if (data.length > 0 && !activeThreadUser) {
          setActiveThreadUser({ id: data[0].user_id, username: data[0].username });
        }
      }
    } catch (err) {
      console.error('Error fetching chat threads:', err);
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
          'Authorization': `Bearer ${token}`
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

  const handleDeleteLiveMessage = async (msgId) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/chat/messages/${msgId}/delete/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setChatMessages(prev => prev.filter(m => m.id !== msgId));
      }
    } catch (e) { console.error(e); }
  };

  const handleClearConversation = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this entire conversation? This action cannot be undone.")) return;
    try {
      const res = await fetch(`${API_BASE}/api/chat/conversations/${userId}/delete/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setChatMessages([]);
        fetchChatConversations();
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteProject = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${id}/delete/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
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
          'Authorization': `Bearer ${token}`
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
          'Authorization': `Bearer ${token}`
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
          'Authorization': `Bearer ${token}`
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

  // ── SHARED BACKGROUND BEAMS ──────────────────────────────────────
  const BackgroundBeams = () => {
    return (
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {/* Base dark — spans full page */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 90% 45% at 50% 15%, #1a0533 0%, #07030f 60%)' }} />
        {/* Mid-page subtle purple bridge */}
        <div style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translateX(-50%)', width: '80%', height: '40%', background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(76,29,149,0.12) 0%, transparent 70%)' }} />
        {/* Footer region glow — mirrors hero glow at bottom */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '55%', background: 'radial-gradient(ellipse 80% 60% at 30% 90%, rgba(109,40,217,0.22) 0%, transparent 60%)' }} />
        <div style={{ position: 'absolute', bottom: 0, right: '-10%', width: '60%', height: '45%', background: 'radial-gradient(ellipse 60% 50% at 70% 80%, rgba(76,29,149,0.15) 0%, transparent 65%)' }} />

        {/* ── Page-Specific Sharp Double Beams ── */}
        
        {currentView === 'home' && (
          <>
            {/* Main sweeping beam at the top of the page */}
            <div className="beam-container" style={{
              position: 'absolute', top: '-55%', left: '-10%',
              width: '120%', height: '120%',
              background: 'conic-gradient(from 200deg at 25% 55%, transparent 0deg, #4c1d95 8deg, #7c3aed 14deg, transparent 20deg, transparent 40deg, #3b0764 50deg, #5b21b6 54deg, transparent 60deg)',
              opacity: 0.8,
            }} />
          </>
        )}

        {currentView === 'features' && (
          <div className="deco-beam-1" style={{
            position: 'absolute', top: '-5%', right: '-15%',
            width: '120%', height: '120%',
            background: 'conic-gradient(from 125deg at 85% 25%, transparent 0deg, rgba(124,58,237,0.8) 6deg, rgba(167,139,250,1) 12deg, transparent 18deg, transparent 35deg, rgba(76,29,149,0.6) 45deg, rgba(139,92,246,0.85) 50deg, transparent 58deg)',
            opacity: 0.85,
            transform: 'rotate(-3deg)',
          }} />
        )}

        {currentView === 'how-it-works' && (
          <div className="beam-container" style={{
            position: 'absolute', top: '-30%', left: '-25%',
            width: '120%', height: '120%',
            background: 'conic-gradient(from 220deg at 30% 30%, transparent 0deg, rgba(76,29,149,0.8) 5deg, rgba(139,92,246,0.95) 9deg, transparent 16deg)',
            opacity: 0.65,
          }} />
        )}

        {currentView === 'for-teams' && (
          <div className="deco-beam-2" style={{
            position: 'absolute', top: '20%', right: '-30%',
            width: '100%', height: '100%',
            background: 'conic-gradient(from 110deg at 90% 40%, transparent 0deg, rgba(67,56,202,0.5) 8deg, rgba(99,102,241,0.65) 15deg, transparent 25deg)',
            opacity: 0.5,
          }} />
        )}

        {currentView === 'contact' && (
          <div className="beam-container" style={{
            position: 'absolute', top: '10%', left: '-35%',
            width: '100%', height: '150%',
            background: 'conic-gradient(from 210deg at 10% 50%, transparent 0deg, rgba(192,38,211,0.3) 6deg, rgba(232,121,249,0.45) 12deg, transparent 22deg)',
            opacity: 0.45,
          }} />
        )}

        {/* Secondary softer glow shared everywhere */}
        <div style={{
          position: 'absolute', top: 0, left: '-15%',
          width: '70%', height: '100%',
          background: 'radial-gradient(ellipse 60% 80% at 20% 50%, rgba(109,40,217,0.2) 0%, transparent 65%)',
          animation: 'beamDrift 18s ease-in-out infinite',
        }} />
        {/* Grain overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
          opacity: 0.045,
        }} />
      </div>
    );
  };

  // ── SHARED INNER PAGE LAYOUT WRAPPER ──────────────────────────────────────
  const InnerPageShell = ({ children }) => {
    return (
      <div style={{ background: '#07030f', minHeight: '100vh', fontFamily: 'Inter, sans-serif', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <BackgroundBeams />
        <div style={{ position: 'relative', zIndex: 10 }}>
          {/* Navbar */}
          <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px clamp(24px, 5vw, 64px)', gap: 24, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <button onClick={() => setCurrentView('home')} style={{ background: 'none', border: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="bi bi-eye" style={{ color: '#fff', fontSize: 22 }}></i>
                <span style={{ color: '#fff', fontWeight: 900, fontSize: 20, letterSpacing: '-0.02em' }}>Drishti</span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', paddingLeft: 30 }}>Audit & Ops Platform</span>
            </button>
            <button onClick={() => setCurrentView('home')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '6px 14px', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
            >
              <i className="bi bi-arrow-left"></i> Return to Home
            </button>
          </div>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            {[{ label: 'Features', view: 'features' }, { label: 'How It Works', view: 'how-it-works' }, { label: 'For Teams', view: 'for-teams' }, { label: 'Contact', view: 'contact' }].map(({ label, view }) => (
              <button key={label} onClick={() => setCurrentView(view)} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: currentView === view ? '#fff' : 'rgba(255,255,255,0.72)', fontWeight: currentView === view ? 700 : 400 }} className="nav-link-item">{label}</button>
            ))}
            <button onClick={() => setCurrentView('auth-select')} style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', color: '#fff', border: 0, borderRadius: 50, padding: '9px 22px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Get Started</button>
          </div>
        </nav>
        {children}
        </div>
      </div>
    );
  };

  // 1. HOME LANDING VIEW
  if (currentView === 'home') {
    return (
      <div style={{ background: 'linear-gradient(180deg, #07030f 0%, #0d0420 35%, #07030f 65%, #0d0420 100%)', minHeight: '100vh', fontFamily: 'Inter, sans-serif', overflow: 'hidden', position: 'relative' }}>

        {/* ── Animated Background: rotating light-beam spotlight ── */}


        <style>{`
          @keyframes beamSweep {
            0%   { transform: rotate(0deg) scale(1.2);   opacity: 1; }
            50%  { transform: rotate(20deg) scale(1.35); opacity: 0.85; }
            100% { transform: rotate(0deg) scale(1.2);   opacity: 1; }
          }
          @keyframes beamDrift {
            0%   { transform: translateX(0px)  rotate(-10deg); }
            50%  { transform: translateX(60px) rotate(10deg);  }
            100% { transform: translateX(0px)  rotate(-10deg); }
          }
          @keyframes beamPulse {
            0%, 100% { opacity: 0.18; transform: scaleX(1); }
            50%       { opacity: 0.32; transform: scaleX(1.08); }
          }
          @keyframes beamPulse2 {
            0%, 100% { opacity: 0.12; transform: rotate(0deg); }
            50%       { opacity: 0.22; transform: rotate(3deg); }
          }
          @keyframes marqueeLeft {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          @keyframes marqueeRight {
            0%   { transform: translateX(-50%); }
            100% { transform: translateX(0); }
          }
          .beam-container {
            animation: beamSweep 20s ease-in-out infinite;
          }
          .deco-beam-1 {
            animation: beamPulse 8s ease-in-out infinite;
          }
          .deco-beam-2 {
            animation: beamPulse2 12s ease-in-out infinite;
          }
          .pill-btn {
            display: inline-flex; align-items: center; gap: 10px;
            background: rgba(255,255,255,0.93); color: #1a0533;
            border: none; border-radius: 999px;
            padding: 14px 32px; font-size: 15px; font-weight: 700;
            cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;
          }
          .pill-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(109,40,217,0.35); }
          .pill-btn-outline {
            display: inline-flex; align-items: center; gap: 10px;
            background: rgba(255,255,255,0.08);
            color: #fff; border: 1.5px solid rgba(255,255,255,0.35);
            border-radius: 999px; padding: 14px 32px;
            font-size: 15px; font-weight: 600;
            cursor: pointer; transition: transform 0.2s, background 0.2s;
          }
          .pill-btn-outline:hover { background: rgba(255,255,255,0.15); transform: translateY(-2px); }
          .nav-link-item {
            color: rgba(255,255,255,0.72); font-size: 13px; font-weight: 400;
            text-decoration: none; white-space: nowrap;
            transition: color 0.15s;
          }
          .nav-link-item:hover { color: #fff; }
          .sign-in-pill {
            display: inline-flex; align-items: center; gap: 8px;
            background: rgba(255,255,255,0.95); color: #1a0533;
            border: none; border-radius: 999px;
            padding: 8px 18px 8px 20px; font-size: 13px; font-weight: 700;
            cursor: pointer; transition: transform 0.15s;
          }
          .sign-in-pill:hover { transform: scale(1.03); }
          .sign-in-pill .arrow-circle {
            display: flex; align-items: center; justify-content: center;
            width: 26px; height: 26px; border-radius: 50%;
            background: #6d28d9; color: #fff; font-size: 12px;
          }
          .marquee-track { display: flex; width: max-content; }
          .marquee-track-left { animation: marqueeLeft 38s linear infinite; }
          .marquee-track-right { animation: marqueeRight 42s linear infinite; }
          .marquee-track:hover { animation-play-state: paused; }
          .review-card {
            flex-shrink: 0;
            width: 320px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 16px;
            padding: 24px 22px;
            margin: 0 12px;
            transition: border-color 0.2s;
          }
          .review-card:hover { border-color: rgba(167,139,250,0.35); }
          .feat-card { transition: transform 0.22s, border-color 0.22s, box-shadow 0.22s; }
          .feat-card:hover { transform: translateY(-6px); box-shadow: 0 12px 40px rgba(109,40,217,0.25); }
        `}</style>

        {/* Animated background light-beam layer */}
        <BackgroundBeams />

        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

          {/* ── Navbar ── */}
          <nav style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px clamp(24px, 5vw, 64px)', gap: 24,
          }}>
            {/* Logo */}
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="bi bi-eye" style={{ color: '#fff', fontSize: 22 }}></i>
                <span style={{ color: '#fff', fontWeight: 900, fontSize: 20, letterSpacing: '-0.02em', fontFamily: '"Helvetica Neue Black", "Arial Black", sans-serif' }}>Drishti</span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', paddingLeft: 30 }}>Audit & Ops Platform</span>
            </div>

            {/* Center nav links */}
            <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
              {[
                { label: 'Features', view: 'features' },
                { label: 'How It Works', view: 'how-it-works' },
                { label: 'For Teams', view: 'for-teams' },
                { label: 'Contact', view: 'contact' },
              ].map(({ label, view }) => (
                <button key={label} onClick={() => setCurrentView(view)}
                  style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                  className="nav-link-item"
                >{label}</button>
              ))}
            </div>

            {/* Sign In pill — REMOVED (hero CTAs serve same purpose) */}
          </nav>

          {/* ── Hero Section ── */}
          <header style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', padding: 'clamp(48px, 8vw, 80px) clamp(24px, 5vw, 64px)',
          }}>
            {/* Headline — mixed serif/sans */}
            <h1 style={{
              color: '#fff', fontSize: 'clamp(36px, 6vw, 72px)',
              fontWeight: 800, lineHeight: 1.08,
              letterSpacing: '-0.03em', margin: '0 0 24px 0',
              maxWidth: 900,
            }}>
              Empower{' '}
              <span style={{ color: '#a78bfa' }}>
                <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontStyle: 'italic', fontWeight: 700 }}>
                  Audits &amp;
                </span>
                {' '}Project
              </span> Management
            </h1>

            {/* Subtext */}
            <p style={{
              color: 'rgba(255,255,255,0.68)', fontSize: 'clamp(14px, 1.8vw, 18px)',
              lineHeight: 1.65, maxWidth: 640,
              margin: '0 0 40px 0', fontWeight: 400,
            }}>
              Drishti is a unified operations platform designed for organizations to streamline task delegation, audit tracking, compliance documentation, and guidelines verification.
            </p>

            {/* CTA Button — single "Get Started" */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
              <button
                onClick={() => setCurrentView('auth-select')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 12,
                  background: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 100%)',
                  color: '#fff', border: 'none', borderRadius: 999,
                  padding: '16px 40px', fontSize: 16, fontWeight: 700,
                  cursor: 'pointer', boxShadow: '0 4px 24px rgba(109,40,217,0.5)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 36px rgba(109,40,217,0.65)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 24px rgba(109,40,217,0.5)'; }}
              >
                Get Started
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.22)', color: '#fff', fontSize: 14,
                }}>
                  <i className="bi bi-arrow-up-right"></i>
                </span>
              </button>
            </div>

            {/* Feature bullets */}
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { icon: 'bi-shield-check',   label: 'Role-based access control' },
                { icon: 'bi-file-earmark-check', label: 'Audit trail & PDF reports' },
                { icon: 'bi-robot',          label: 'AI-assisted compliance' },
              ].map(({ icon, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
                  <i className={`bi ${icon}`} style={{ fontSize: 15, color: 'rgba(200,170,255,0.8)' }}></i>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </header>

          {/* Feature Cards Grid — dark frosted glass treatment */}
          <section style={{ padding: '48px clamp(24px, 5vw, 64px)' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 'clamp(22px, 3vw, 32px)', marginBottom: 10 }}>Designed for Collaborative Governance</h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>Simple interfaces for managers to coordinate and teams to execute.</p>
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { icon: 'bi-shield-check', iconColor: '#60a5fa', title: 'Manager Oversight', body: 'Create and assign projects. Audit project timeline, inspect metadata, and review submitted PDF reports with full approval workflows.' },
                { icon: 'bi-person-workspace', iconColor: '#34d399', title: 'Team Execution', body: 'Track running, upcoming, and past tasks. Directly upload PDF reports, write progress notes, and view supervisor feedback.' },
                { icon: 'bi-chat-square-text', iconColor: '#fbbf24', title: 'Internal AI Assistant', body: 'Ask context-based audit questions. The built-in bot clarifies operational queries directly based on project metadata and uploads.' },
              ].map(({ icon, iconColor, title, body }) => (
                <div key={title} style={{
                  flex: '1 1 280px', maxWidth: 380,
                  background: 'rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 20,
                  padding: '36px 28px',
                  textAlign: 'center',
                  boxShadow: '0 4px 32px rgba(109,40,217,0.12), inset 0 1px 0 rgba(255,255,255,0.07)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 8px 40px rgba(109,40,217,0.25), inset 0 1px 0 rgba(255,255,255,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 32px rgba(109,40,217,0.12), inset 0 1px 0 rgba(255,255,255,0.07)'; }}
                >
                  <div style={{ fontSize: 40, color: iconColor, marginBottom: 20 }}><i className={`bi ${icon}`}></i></div>
                  <h4 style={{ color: '#fff', fontWeight: 700, marginBottom: 12, fontSize: 18 }}>{title}</h4>
                  <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.65, margin: 0 }}>{body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Stats Strip ── */}
          <section style={{ padding: '64px clamp(24px,5vw,64px)', borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 40, justifyContent: 'space-around', textAlign: 'center' }}>
              {[
                { num: '500+', label: 'Projects Managed', icon: 'bi-folder2-open', color: '#a78bfa' },
                { num: '98%', label: 'Report Accuracy', icon: 'bi-patch-check', color: '#34d399' },
                { num: '12x', label: 'Faster Audit Cycles', icon: 'bi-lightning-charge', color: '#fbbf24' },
                { num: '100%', label: 'Data Encrypted', icon: 'bi-shield-lock', color: '#60a5fa' },
              ].map(({ num, label, icon, color }) => (
                <div key={label} style={{ flex: '1 1 180px' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  style={{ flex: '1 1 180px', transition: 'transform 0.25s' }}
                >
                  <i className={`bi ${icon}`} style={{ fontSize: 32, color, marginBottom: 14, display: 'block' }}></i>
                  <div style={{ fontSize: 'clamp(32px,4vw,52px)', fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 8 }}>{num}</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── How It Works ── */}
          <section style={{ padding: '80px clamp(24px,5vw,64px)' }}>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <span style={{ color: '#a78bfa', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Simple by design</span>
              <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 'clamp(22px,3vw,36px)', margin: '12px 0 10px' }}>How Drishti Works</h2>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, maxWidth: 560, margin: '0 auto' }}>From project creation to report approval — everything in one secure platform.</p>
            </div>
            <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1100, margin: '0 auto' }}>
              {[
                { step: '01', title: 'Create Project', desc: 'Manager defines the project scope, assigns investigators, sets timelines, and uploads supporting documents.', icon: 'bi-plus-circle', color: '#a78bfa' },
                { step: '02', title: 'Assign & Notify', desc: 'Investigators receive instant email notifications. External collaborators get a secure invite link — no account needed to view.', icon: 'bi-send', color: '#60a5fa' },
                { step: '03', title: 'Execute & Upload', desc: 'Teams track tasks, submit PDF progress reports, and communicate directly through the encrypted desk.', icon: 'bi-file-earmark-arrow-up', color: '#34d399' },
                { step: '04', title: 'Review & Approve', desc: "Manager audits submissions with Ekta AI's insights, leaves feedback, and approves or requests revisions.", icon: 'bi-check2-all', color: '#fbbf24' },
              ].map(({ step, title, desc, icon, color }, idx) => (
                <div key={step} style={{ flex: '1 1 220px', maxWidth: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 16px', position: 'relative' }}>
                  {idx < 3 && <div style={{ position: 'absolute', right: 0, top: 28, width: '50%', height: 1, background: 'linear-gradient(90deg, rgba(167,139,250,0.4), rgba(167,139,250,0))', display: 'none' }} />}
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: `${color}18`, border: `2px solid ${color}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, position: 'relative' }}>
                    <i className={`bi ${icon}`} style={{ fontSize: 24, color }}></i>
                    <span style={{ position: 'absolute', top: -10, right: -10, background: color, color: '#000', fontSize: 10, fontWeight: 900, borderRadius: 20, padding: '2px 7px', letterSpacing: '0.05em' }}>{step}</span>
                  </div>
                  <h5 style={{ color: '#fff', fontWeight: 700, marginBottom: 10, fontSize: 16 }}>{title}</h5>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 1.7, margin: 0 }}>{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Scrolling Reviews Marquee ── */}
          <section style={{ padding: '72px 0', overflow: 'hidden', background: 'rgba(109,40,217,0.06)', borderTop: '1px solid rgba(167,139,250,0.12)', borderBottom: '1px solid rgba(167,139,250,0.12)' }}>
            <div style={{ textAlign: 'center', marginBottom: 44, padding: '0 clamp(24px,5vw,64px)' }}>
              <span style={{ color: '#a78bfa', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Voices from the field</span>
              <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 'clamp(20px,3vw,32px)', margin: '10px 0 0' }}>Trusted by India's Top Research Institutions</h2>
            </div>
          {/* Row 1 — scrolls LEFT */}
          {(() => {
            const row1 = [
              { quote: 'Drishti cut our quarterly audit preparation time from 3 weeks to 2 days. Ekta AI alone is worth the switch.', name: 'Dr. Priya Mehta', org: 'DRDO', role: 'Principal Investigator', initials: 'PM', color: '#a78bfa', rating: 5 },
              { quote: 'The timeline monitor gives us instant visibility across all running satellite projects. A game-changer for our lab.', name: 'V. Krishnamurthy', org: 'ISRO', role: 'Programme Director', initials: 'VK', color: '#60a5fa', rating: 4 },
              { quote: 'Report submissions used to take three rounds of emails. Now it\'s one upload, one click, and the manager sees it instantly.', name: 'Anjali Bose', org: 'CMPDI', role: 'Senior Analyst', initials: 'AB', color: '#34d399', rating: 5 },
              { quote: 'We manage 40+ concurrent projects across divisions. Drishti\'s role-based views mean nobody sees what they shouldn\'t.', name: 'Rajan Nair', org: 'BARC', role: 'Project Manager', initials: 'RN', color: '#fbbf24', rating: 4 },
              { quote: 'Ekta AI answered my compliance question in 4 seconds — it referenced the exact clause from the document I uploaded.', name: 'Prof. Sujata Desai', org: 'IIT Bombay', role: 'Research Coordinator', initials: 'SD', color: '#f472b6', rating: 5 },
            ];
            const doubled = [...row1, ...row1];
            return (
              <div style={{ overflow: 'hidden', marginBottom: 16 }}>
                <div className="marquee-track marquee-track-left" style={{ display: 'flex' }}>
                  {doubled.map((r, i) => (
                    <div key={i} className="review-card">
                      <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
                        {[1, 2, 3, 4, 5].map(s => <i key={s} className={`bi ${s <= r.rating ? 'bi-star-fill' : 'bi-star'}`} style={{ color: '#fbbf24', fontSize: 11 }}></i>)}
                      </div>
                      <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13.5, lineHeight: 1.72, marginBottom: 18, fontStyle: 'italic' }}>"{r.quote}"</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${r.color}25`, border: `1.5px solid ${r.color}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: r.color, fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{r.initials}</div>
                        <div>
                          <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{r.name}</div>
                          <div style={{ color: r.color, fontSize: 11, fontWeight: 600 }}>{r.org} &nbsp;·&nbsp; <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>{r.role}</span></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {/* Row 2 — scrolls RIGHT */}
          {(() => {
            const row2 = [
              { quote: 'Finally a platform that speaks the language of government R&D. Compliance, timelines, and AI — all in one place.', name: 'Arjun Kulkarni', org: 'BARC', role: 'Project Manager', initials: 'AK', color: '#34d399', rating: 5 },
              { quote: 'The encrypted desk feature is brilliant. Sensitive project communications stay within the platform.', name: 'Lt. Col. Harish Rao', org: 'DRDO', role: 'Defence Scientist', initials: 'HR', color: '#a78bfa', rating: 4 },
              { quote: 'We piloted Drishti on 5 CSIR-funded projects. Zero document mis-filing. The AI assistant alone saved 20+ hours.', name: 'Dr. Meera Lal', org: 'CSIR', role: 'Lab Director', initials: 'ML', color: '#60a5fa', rating: 5 },
              { quote: 'Setting up a new project used to take a day. With Drishti it\'s 10 minutes, start to finish. Some UI quirks but great.', name: 'Kiran Patel', org: 'CMPDI', role: 'Operations Lead', initials: 'KP', color: '#fbbf24', rating: 3 },
              { quote: 'Ekta\'s RAG approach means it actually understands our documents. It doesn\'t just search — it reasons.', name: 'Prof. Amita Singh', org: 'IIT Delhi', role: 'AI Research Lead', initials: 'AS', color: '#f472b6', rating: 5 },
            ];
            const doubled = [...row2, ...row2];
            return (
              <div style={{ overflow: 'hidden' }}>
                <div className="marquee-track marquee-track-right" style={{ display: 'flex' }}>
                  {doubled.map((r, i) => (
                    <div key={i} className="review-card">
                      <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
                        {[1, 2, 3, 4, 5].map(s => <i key={s} className={`bi ${s <= r.rating ? 'bi-star-fill' : 'bi-star'}`} style={{ color: '#fbbf24', fontSize: 11 }}></i>)}
                      </div>
                      <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13.5, lineHeight: 1.72, marginBottom: 18, fontStyle: 'italic' }}>"{r.quote}"</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${r.color}25`, border: `1.5px solid ${r.color}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: r.color, fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{r.initials}</div>
                        <div>
                          <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{r.name}</div>
                          <div style={{ color: r.color, fontSize: 11, fontWeight: 600 }}>{r.org} &nbsp;·&nbsp; <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>{r.role}</span></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </section>


          <section style={{ padding: '80px clamp(24px,5vw,64px)', textAlign: 'center' }}>
            <div style={{ maxWidth: 680, margin: '0 auto' }}>
              <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 'clamp(26px,4vw,44px)', lineHeight: 1.15, marginBottom: 16, letterSpacing: '-0.03em' }}>
                Ready to bring{' '}
                <span style={{ color: '#a78bfa' }}>clarity</span> to your operations?
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, marginBottom: 36 }}>Join research teams, government agencies, and enterprises already running on Drishti.</p>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => { setAuthRole('manager'); setCurrentView('auth-select'); }}
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', color: '#fff', border: 0, borderRadius: 50, padding: '14px 36px', fontWeight: 700, fontSize: 15, cursor: 'pointer', letterSpacing: '-0.01em', boxShadow: '0 4px 24px rgba(124,58,237,0.5)' }}
                >Get started as Manager</button>
                <button
                  onClick={() => { setAuthRole('investigator'); setCurrentView('auth-select'); }}
                  style={{ background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 50, padding: '14px 36px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
                >Join as Investigator</button>
              </div>
            </div>
          </section>

          {/* Premium Footer — full-bleed gradient, inline-style spacing to bypass Bootstrap */}
          <footer
            style={{
              position: 'relative',
              overflow: 'hidden',
              width: '100%',
              background: 'linear-gradient(180deg, rgba(13,4,32,0) 0%, rgba(26,5,51,0.85) 20%, rgba(59,7,100,0.75) 60%, rgba(109,40,217,0.25) 100%)',
            }}
          >
            {/* Giant Watermark — Arial Black, top-opaque → bottom-transparent */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, width: '100%',
              display: 'flex', justifyContent: 'center',
              pointerEvents: 'none', userSelect: 'none', overflow: 'hidden', zIndex: 0,
            }}>
              <span style={{
                fontSize: '19vw',
                fontFamily: '"Helvetica Neue", "Arial Black", Arial, sans-serif',
                fontStyle: 'normal',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                lineHeight: 1,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0) 100%)',
                userSelect: 'none',
              }}>
                DRISHTI
              </span>
            </div>

            {/* Content — max-width container with guaranteed padding */}
            <div style={{
              position: 'relative', zIndex: 10,
              maxWidth: 1400, margin: '0 auto',
              padding: 'clamp(24px, 5vw, 64px)',
              paddingTop: 48, paddingBottom: 16,
            }}>
              {/* Main row: headline+socials left | link columns right */}
              <div style={{
                display: 'flex', flexWrap: 'wrap',
                justifyContent: 'space-between', gap: 48,
                marginBottom: 40,
              }}>
                {/* Left: Headline + Social icons */}
                <div style={{ flex: '0 0 auto', maxWidth: 360 }}>
                  <h3 style={{
                    color: '#fff', fontSize: 24, fontWeight: 700,
                    lineHeight: 1.4, marginBottom: 24, margin: '0 0 24px 0',
                  }}>
                    Drishti is a{' '}
                    <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontStyle: 'italic', fontWeight: 400, color: '#d8b4fe' }}>
                      professional growth
                    </span>
                    {' '}& Employment Platform — Connecting Teams with Managers & Auditors.
                  </h3>
                  {/* Social icons — white outline circles */}
                  <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
                    {[
                      { icon: 'bi-linkedin',  href: '#' },
                      { icon: 'bi-twitter-x', href: '#' },
                      { icon: 'bi-instagram', href: '#' },
                      { icon: 'bi-facebook',  href: '#' },
                    ].map(({ icon, href }) => (
                      <a key={icon} href={href} className="text-decoration-none" style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 40, height: 40, borderRadius: '50%',
                        border: '1.5px solid rgba(255,255,255,0.7)',
                        color: '#fff', fontSize: 16, transition: 'background 0.2s',
                        flexShrink: 0,
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <i className={`bi ${icon}`}></i>
                      </a>
                    ))}
                  </div>
                </div>

                {/* Right: 3 link columns */}
                <div style={{ display: 'flex', gap: 64, flexWrap: 'wrap' }}>
                  {/* Get started now */}
                  <div>
                    <h5 style={{ color: '#fff', fontWeight: 600, fontSize: 14, marginBottom: 20 }}>Get started now</h5>
                    {[
                      { label: 'Register as a team',    role: 'investigator' },
                      { label: 'Join as a manager',     role: 'manager' },
                      { label: 'Register as a company', role: 'manager' },
                    ].map(({ label, role }) => (
                      <button key={label}
                        onClick={() => { setAuthRole(role); setCurrentView('auth-select'); }}
                        style={{
                          display: 'block', background: 'none', border: 0, padding: 0,
                          color: 'rgba(255,255,255,0.65)', fontSize: 13, textAlign: 'left',
                          marginBottom: 16, cursor: 'pointer', transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.65)'}
                      >{label}</button>
                    ))}
                    <button
                      onClick={() => { setAuthRole('investigator'); setCurrentView('auth-select'); }}
                      style={{
                        display: 'block', background: 'none', border: 0, padding: 0,
                        color: '#fff', fontSize: 13, fontWeight: 700,
                        textAlign: 'left', cursor: 'pointer',
                      }}
                    >Login</button>
                  </div>

                  {/* About */}
                  <div>
                    <h5 style={{ color: '#fff', fontWeight: 600, fontSize: 14, marginBottom: 20 }}>About</h5>
                    {['Features', 'Who is this platform for?', 'How does it work?', 'Frequently Asked Questions'].map(link => (
                      <a key={link} href="#" className="text-decoration-none" style={{
                        display: 'block', color: 'rgba(255,255,255,0.65)',
                        fontSize: 13, marginBottom: 16, transition: 'color 0.15s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.65)'}
                      >{link}</a>
                    ))}
                  </div>

                  {/* Support */}
                  <div>
                    <h5 style={{ color: '#fff', fontWeight: 600, fontSize: 14, marginBottom: 20 }}>Support</h5>
                    {['Contact us', 'Privacy Policy', 'Terms of Use'].map(link => (
                      <a key={link} href="#" className="text-decoration-none" style={{
                        display: 'block', color: 'rgba(255,255,255,0.65)',
                        fontSize: 13, marginBottom: 16, transition: 'color 0.15s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.65)'}
                      >{link}</a>
                    ))}
                  </div>
                </div>
              </div>

              {/* Copyright */}
              <div style={{
                textAlign: 'center', color: 'rgba(255,255,255,0.38)',
                fontSize: 13, paddingTop: 16,
              }}>
                © 2026 Drishti All rights reserved.
              </div>
            </div>
          </footer>
        </div>
      </div>
    );
  }


  // 2a. FEATURES PAGE
  if (currentView === 'features') {
    return (
      <InnerPageShell>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '72px clamp(24px,5vw,64px)' }}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <span style={{ color: '#a78bfa', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Everything you need</span>
            <h1 style={{ color: '#fff', fontWeight: 900, fontSize: 'clamp(32px,5vw,56px)', margin: '16px 0 16px', letterSpacing: '-0.03em' }}>Platform Features</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, maxWidth: 560, margin: '0 auto' }}>Drishti combines project management, compliance, and AI into a single end-to-end solution.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
            {[
              { icon: 'bi-kanban', color: '#a78bfa', title: 'Project Lifecycle Management', desc: 'Create, track, and close projects with full status control — Up Next, Ongoing, Completed. Every state change is timestamped.' },
              { icon: 'bi-robot', color: '#34d399', title: 'Ekta AI (RAG Assistant)', desc: 'Context-aware AI built on your own project documents. Ask anything about timelines, budgets, or compliance — no hallucinations.' },
              { icon: 'bi-person-badge', color: '#60a5fa', title: 'Role-Based Access Control', desc: "Managers get full oversight. Investigators get a focused execution view. Data is strictly isolated — users only see what's theirs." },
              { icon: 'bi-file-earmark-pdf', color: '#fbbf24', title: 'Secure Report Submission', desc: 'PDF-only report uploads with server-side validation. Manager feedback and approval workflows built in.' },
              { icon: 'bi-envelope-check', color: '#f472b6', title: 'Automated Email Invites', desc: 'Assign projects to anyone by email. External collaborators get a secure notification — no account required to receive context.' },
              { icon: 'bi-graph-up-arrow', color: '#a78bfa', title: 'Project Timeline Monitor', desc: 'Visual Gantt-style timeline showing all projects in parallel. Instantly see what is on track, overdue, or upcoming.' },
              { icon: 'bi-chat-dots', color: '#34d399', title: 'Encrypted Live Chat', desc: 'Direct messaging between managers and investigators scoped to project context. Every message is session-isolated.' },
              { icon: 'bi-shield-lock', color: '#60a5fa', title: 'JWT Session Security', desc: 'Tokens expire in 5 hours. Each browser tab is independently authenticated — opening two dashboards never cross-contaminates.' },
              { icon: 'bi-cloud-upload', color: '#fbbf24', title: 'Smart Document Indexing', desc: 'Upload PDF, TXT, DOCX — Ekta automatically indexes every file into ChromaDB and makes it queryable in seconds.' },
            ].map(({ icon, color, title, desc }) => (
              <div key={title}
                style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '28px 24px', border: '1px solid rgba(255,255,255,0.08)', transition: 'transform 0.2s, border-color 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = `${color}60`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              >
                <i className={`bi ${icon}`} style={{ fontSize: 28, color, marginBottom: 16, display: 'block' }}></i>
                <h4 style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 10 }}>{title}</h4>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13.5, lineHeight: 1.7, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </InnerPageShell>
    );
  }

  // 2b. HOW IT WORKS PAGE
  if (currentView === 'how-it-works') {
    return (
      <InnerPageShell>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '72px clamp(24px,5vw,64px)' }}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <span style={{ color: '#a78bfa', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Step by step</span>
            <h1 style={{ color: '#fff', fontWeight: 900, fontSize: 'clamp(32px,5vw,52px)', margin: '16px 0 16px', letterSpacing: '-0.03em' }}>How Drishti Works</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, maxWidth: 520, margin: '0 auto' }}>A guided walkthrough of the full project lifecycle on the platform.</p>
          </div>
          {/* How It Works loop */}
          {[
            { step: '01', color: '#a78bfa', icon: 'bi-person-plus', title: 'Sign Up & Choose Your Role', body: 'Create an account in under 30 seconds. Choose Manager (to create and oversee projects) or Investigator (to execute and report). Your entire UI adapts to your role.', badge: 'Setup' },
            { step: '02', color: '#60a5fa', icon: 'bi-folder-plus', title: 'Manager Creates a Project', body: 'Define the project code, title, agency, budget, timeline, and assign an investigator by username or email. Upload supporting reference documents (PDF, DOCX, TXT) — Ekta AI indexes them instantly.', badge: 'Manager Action' },
            { step: '03', color: '#34d399', icon: 'bi-envelope-open', title: 'Investigator Gets Notified', body: 'The assigned investigator receives an in-app notification and an automated email with full project details and a link to their dashboard. External collaborators can also receive project summaries via email invite.', badge: 'Notification' },
            { step: '04', color: '#fbbf24', icon: 'bi-laptop', title: 'Investigator Executes & Submits', body: 'The investigator logs in to see their running, upcoming, and completed tasks. They submit progress using PDF report uploads, add notes, and chat with the manager in real time.', badge: 'Execution' },
            { step: '05', color: '#f472b6', icon: 'bi-robot', title: 'Ask Ekta AI Anything', body: 'Both managers and investigators can use Ekta AI scoped to a specific project. Ask "what was the approved budget?" or "summarise the submitted report" — Ekta retrieves answers from your actual indexed documents.', badge: 'AI Layer' },
            { step: '06', color: '#a78bfa', icon: 'bi-check2-circle', title: 'Manager Reviews & Approves', body: "The manager inspects the submitted PDF, reads Ekta's AI summary, adds review notes, and either approves the report or requests a revision. The investigator sees the feedback instantly.", badge: 'Closure' },
          ].map(({ step, color, icon, title, body, badge }, idx) => (
            <div key={step} style={{ display: 'flex', gap: 28, marginBottom: 48, alignItems: 'flex-start', transition: 'transform 0.3s', cursor: 'default' }}
                 onMouseEnter={e => e.currentTarget.style.transform = 'translateX(10px)'}
                 onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0px)'}>
              <div style={{ flexShrink: 0 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: `${color}18`, border: `2px solid ${color}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', transition: 'box-shadow 0.3s' }}
                     onMouseEnter={e => e.currentTarget.style.boxShadow = `0 0 20px ${color}40`}
                     onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                  <i className={`bi ${icon}`} style={{ fontSize: 22, color }}></i>
                  <span style={{ position: 'absolute', top: -10, right: -12, background: color, color: '#000', fontSize: 9, fontWeight: 900, borderRadius: 20, padding: '2px 7px' }}>{step}</span>
                </div>
                {idx < 5 && <div style={{ width: 2, height: 40, background: `linear-gradient(${color}40, transparent)`, margin: '8px auto 0' }} />}
              </div>
              <div style={{ paddingTop: 8 }}>
                <span style={{ background: `${color}20`, color, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', borderRadius: 20, padding: '3px 10px', marginBottom: 10, display: 'inline-block' }}>{badge}</span>
                <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: 10, marginTop: 8 }}>{title}</h3>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.75, margin: 0 }}>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </InnerPageShell>
    );
  }

  // 2c. FOR TEAMS PAGE
  if (currentView === 'for-teams') {
    return (
      <InnerPageShell>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '72px clamp(24px,5vw,64px)' }}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <span style={{ color: '#a78bfa', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Built for your workflow</span>
            <h1 style={{ color: '#fff', fontWeight: 900, fontSize: 'clamp(32px,5vw,52px)', margin: '16px 0 16px', letterSpacing: '-0.03em' }}>Drishti For Teams</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, maxWidth: 560, margin: '0 auto' }}>Whether you are a solo manager or a 100-person research division, Drishti scales to your needs.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 32, marginBottom: 80 }}>
            {[
              {
                role: 'For Managers', icon: 'bi-person-gear', color: '#a78bfa',
                points: ['Create & assign unlimited projects', 'Full audit trail of submissions', 'Approve or reject reports with comments', 'Monitor all timelines in a visual Gantt view', 'Upload reference documents for AI indexing', 'Communicate via encrypted desk'],
              },
              {
                role: 'For Investigators', icon: 'bi-person-workspace', color: '#34d399',
                points: ['Personal dashboard for running tasks', 'Upcoming & completed task tracker', 'Submit PDF progress reports securely', 'Use Ekta AI on assigned project documents', 'View manager feedback in real time', 'Receive project alerts via email'],
              },
            ].map(({ role, icon, color, points }) => (
              <div key={role} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: '36px 32px', border: `1px solid ${color}30`, transition: 'transform 0.3s, box-shadow 0.3s' }}
                   onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = `0 12px 40px ${color}20`; }}
                   onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: `${color}18`, border: `2px solid ${color}60`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className={`bi ${icon}`} style={{ fontSize: 22, color }}></i>
                  </div>
                  <h3 style={{ color: '#fff', fontWeight: 800, fontSize: 20, margin: 0 }}>{role}</h3>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {points.map(p => (
                    <li key={p} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                      <i className="bi bi-check-circle-fill" style={{ color, fontSize: 14, marginTop: 2, flexShrink: 0 }}></i>
                      <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Trust logos placeholder strip */}
          <div style={{ textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 56 }}>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 32 }}>Trusted by teams from</p>
            <div style={{ display: 'flex', gap: 48, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
              {['DRDO', 'BARC', 'ISRO', 'IIT Labs', 'CSIR', 'Gov. of India'].map(org => (
                <span key={org} style={{ color: 'rgba(255,255,255,0.25)', fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>{org}</span>
              ))}
            </div>
          </div>
        </div>
      </InnerPageShell>
    );
  }

  // 2d. CONTACT PAGE
  if (currentView === 'contact') {
    return (
      <InnerPageShell>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '72px clamp(24px,5vw,64px)' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <span style={{ color: '#a78bfa', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Get in touch</span>
            <h1 style={{ color: '#fff', fontWeight: 900, fontSize: 'clamp(32px,5vw,52px)', margin: '16px 0 16px', letterSpacing: '-0.03em' }}>Contact Us</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, maxWidth: 480, margin: '0 auto' }}>Have a question, partnership enquiry, or need a custom deployment? We would love to hear from you.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32, marginBottom: 56 }}>
            {[
              { icon: 'bi-envelope', color: '#a78bfa', label: 'Email Us', value: 'appdrishty@gmail.com', sub: 'Typically respond within 24h' },
              { icon: 'bi-building', color: '#34d399', label: 'Enterprise & Partnerships', value: 'enterprise@drishti.app', sub: 'Custom deployments & integrations' },
              { icon: 'bi-headset', color: '#60a5fa', label: 'Support', value: 'support@drishti.app', sub: 'Technical issues & account help' },
            ].map(({ icon, color, label, value, sub }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '28px 24px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
                <i className={`bi ${icon}`} style={{ fontSize: 28, color, marginBottom: 16, display: 'block' }}></i>
                <h5 style={{ color: '#fff', fontWeight: 700, marginBottom: 8 }}>{label}</h5>
                <p style={{ color, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{value}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>{sub}</p>
              </div>
            ))}
          </div>

          {/* Simple contact form */}
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: '40px 36px', border: '1px solid rgba(167,139,250,0.2)', transition: 'box-shadow 0.3s', boxShadow: '0 8px 32px rgba(0,0,0,0)' }}
               onMouseEnter={e => e.currentTarget.style.boxShadow = '0 12px 48px rgba(109,40,217,0.15)'}
               onMouseLeave={e => e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0)'}>
            <h3 style={{ color: '#fff', fontWeight: 700, marginBottom: 28 }}>Send a Message</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>Name</label>
                <input type="text" placeholder="Your name" style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '11px 14px', color: '#fff', fontSize: 14, outline: 'none', transition: 'border-color 0.2s, background 0.2s' }}
                  onFocus={e => { e.target.style.borderColor = '#a78bfa'; e.target.style.background = 'rgba(255,255,255,0.09)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.background = 'rgba(255,255,255,0.06)'; }}
                />
              </div>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>Email</label>
                <input type="email" placeholder="you@org.com" style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '11px 14px', color: '#fff', fontSize: 14, outline: 'none', transition: 'border-color 0.2s, background 0.2s' }}
                  onFocus={e => { e.target.style.borderColor = '#a78bfa'; e.target.style.background = 'rgba(255,255,255,0.09)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.background = 'rgba(255,255,255,0.06)'; }}
                />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>Subject</label>
              <input type="text" placeholder="How can we help?" style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '11px 14px', color: '#fff', fontSize: 14, outline: 'none', transition: 'border-color 0.2s, background 0.2s' }}
                onFocus={e => { e.target.style.borderColor = '#a78bfa'; e.target.style.background = 'rgba(255,255,255,0.09)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.background = 'rgba(255,255,255,0.06)'; }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>Message</label>
              <textarea rows={5} placeholder="Tell us more..." style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '11px 14px', color: '#fff', fontSize: 14, outline: 'none', resize: 'vertical', transition: 'border-color 0.2s, background 0.2s' }}
                onFocus={e => { e.target.style.borderColor = '#a78bfa'; e.target.style.background = 'rgba(255,255,255,0.09)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.background = 'rgba(255,255,255,0.06)'; }}
              />
            </div>
            <button style={{ background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', color: '#fff', border: 0, borderRadius: 50, padding: '13px 32px', fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', boxShadow: '0 4px 24px rgba(124,58,237,0.4)' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(124,58,237,0.6)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(124,58,237,0.4)'; }}
            >
              <i className="bi bi-send me-2"></i>Send Message
            </button>
          </div>
        </div>
      </InnerPageShell>
    );
  }

  // 2. ROLE ACCESS SELECTION
  if (currentView === 'auth-select') {
    return (
      <div style={{
        minHeight: '100vh', fontFamily: 'Inter, sans-serif',
        background: 'linear-gradient(160deg, #07030f 0%, #1a0533 40%, #07030f 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Ambient glow */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ position: 'absolute', top: '20%', left: '20%', width: '60%', height: '60%', background: 'radial-gradient(ellipse at 50% 50%, rgba(109,40,217,0.18) 0%, transparent 70%)' }} />
        </div>

        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 900, textAlign: 'center' }}>
          {/* Back button */}
          <button
            onClick={() => setCurrentView('home')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 999, color: 'rgba(255,255,255,0.7)', fontSize: 13,
              padding: '8px 18px', marginBottom: 40, cursor: 'pointer', transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
          >
            <i className="bi bi-arrow-left"></i> Back to Home
          </button>

          <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 'clamp(24px, 4vw, 40px)', marginBottom: 12, letterSpacing: '-0.02em' }}>Select Portal Entrance</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 48, fontSize: 15 }}>Choose your access type to enter corresponding login dashboard</p>

          {/* Portal cards */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
            {/* Manager Portal */}
            <div style={{
              flex: '1 1 320px', maxWidth: 400,
              background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(109,40,217,0.45)',
              borderRadius: 24, padding: '40px 32px',
              boxShadow: '0 4px 40px rgba(109,40,217,0.15)',
            }}>
              <div style={{ fontSize: 44, color: '#818cf8', marginBottom: 20 }}><i className="bi bi-shield-lock"></i></div>
              <h3 style={{ color: '#fff', fontWeight: 800, fontSize: 24, marginBottom: 12 }}>Manager Portal</h3>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.65, marginBottom: 32 }}>For Administrators, Supervisors, and Auditors managing organizational project directories and reviewing team outputs.</p>
              <button
                style={{
                  width: '100%', borderRadius: 999, padding: '14px 0', fontWeight: 700, fontSize: 15,
                  background: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 100%)',
                  color: '#fff', border: 'none', cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(109,40,217,0.4)', transition: 'transform 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                onClick={() => { setAuthRole('manager'); setCurrentView('login'); }}
              >
                Sign In as Manager
              </button>
            </div>

            {/* Team Portal */}
            <div style={{
              flex: '1 1 320px', maxWidth: 400,
              background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(52,211,153,0.35)',
              borderRadius: 24, padding: '40px 32px',
              boxShadow: '0 4px 40px rgba(52,211,153,0.08)',
            }}>
              <div style={{ fontSize: 44, color: '#34d399', marginBottom: 20 }}><i className="bi bi-people"></i></div>
              <h3 style={{ color: '#fff', fontWeight: 800, fontSize: 24, marginBottom: 12 }}>Team / Individual</h3>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.65, marginBottom: 32 }}>For Investigators, Project Leads, and Staff running designated tasks, logging updates, and uploading compliance reports.</p>
              <button
                style={{
                  width: '100%', borderRadius: 999, padding: '14px 0', fontWeight: 700, fontSize: 15,
                  background: 'linear-gradient(135deg, #065f46 0%, #059669 100%)',
                  color: '#fff', border: 'none', cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(52,211,153,0.25)', transition: 'transform 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
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
    const isManager = authRole === 'manager';
    const accentColor = isManager ? '#7c3aed' : '#059669';
    const accentGlow  = isManager ? 'rgba(109,40,217,0.35)' : 'rgba(52,211,153,0.25)';
    return (
      <div style={{
        minHeight: '100vh', fontFamily: 'Inter, sans-serif',
        background: 'linear-gradient(160deg, #07030f 0%, #1a0533 40%, #07030f 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Ambient glow */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ position: 'absolute', top: '25%', left: '50%', transform: 'translateX(-50%)', width: '70%', height: '60%', background: `radial-gradient(ellipse at 50% 50%, ${isManager ? 'rgba(109,40,217,0.15)' : 'rgba(52,211,153,0.08)'} 0%, transparent 70%)` }} />
        </div>

        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440 }}>
          {/* Back button */}
          <button
            onClick={() => setCurrentView('auth-select')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 999, color: 'rgba(255,255,255,0.7)', fontSize: 13,
              padding: '8px 18px', marginBottom: 32, cursor: 'pointer', transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
          >
            <i className="bi bi-arrow-left"></i> Back to Portal Selection
          </button>

          {/* Card */}
          <div style={{
            background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `1px solid ${isManager ? 'rgba(109,40,217,0.4)' : 'rgba(52,211,153,0.3)'}`,
            borderRadius: 24, overflow: 'hidden',
            boxShadow: `0 8px 48px ${accentGlow}`,
          }}>
            {/* Header */}
            <div style={{ background: isManager ? 'linear-gradient(135deg,#3b0764,#5b21b6)' : 'linear-gradient(135deg,#064e3b,#065f46)', padding: '24px 32px' }}>
              <h4 style={{ color: '#fff', fontWeight: 800, margin: 0, fontSize: 20 }}>
                {isManager ? 'Manager Portal' : 'Investigator Portal'} — {currentView === 'login' ? 'Sign In' : 'Create Account'}
              </h4>
            </div>

            {/* Body */}
            <div style={{ padding: '32px' }}>
              {authError   && <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10, color: '#fca5a5', padding: '10px 14px', fontSize: 13, marginBottom: 20 }}>{authError}</div>}
              {authSuccess && <div style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.35)', borderRadius: 10, color: '#6ee7b7', padding: '10px 14px', fontSize: 13, marginBottom: 20 }}>{authSuccess}</div>}

              <form onSubmit={handleAuthSubmit}>
                {/* Username */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 8, fontWeight: 500 }}>Username</label>
                  <input
                    type="text"
                    value={authUsername}
                    onChange={e => setAuthUsername(e.target.value)}
                    required
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 12, padding: '12px 16px',
                      color: '#fff', fontSize: 15, outline: 'none',
                    }}
                    onFocus={e => e.target.style.borderColor = accentColor}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                  />
                </div>

                {/* Email (signup only) */}
                {currentView === 'signup' && (
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 8, fontWeight: 500 }}>Email</label>
                    <input
                      type="email"
                      value={authEmail}
                      onChange={e => setAuthEmail(e.target.value)}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 12, padding: '12px 16px',
                        color: '#fff', fontSize: 15, outline: 'none',
                      }}
                      onFocus={e => e.target.style.borderColor = accentColor}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                    />
                  </div>
                )}

                {/* Password */}
                <div style={{ marginBottom: 28 }}>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 8, fontWeight: 500 }}>Password</label>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={e => setAuthPassword(e.target.value)}
                    required
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 12, padding: '12px 16px',
                      color: '#fff', fontSize: 15, outline: 'none',
                    }}
                    onFocus={e => e.target.style.borderColor = accentColor}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  style={{
                    width: '100%', borderRadius: 999, padding: '14px 0',
                    fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer',
                    background: isManager ? 'linear-gradient(135deg,#5b21b6,#7c3aed)' : 'linear-gradient(135deg,#065f46,#059669)',
                    color: '#fff', boxShadow: `0 4px 20px ${accentGlow}`,
                    marginBottom: 20, transition: 'transform 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  {currentView === 'login' ? 'Sign In' : 'Create Account'}
                </button>

                {/* Toggle link */}
                <div style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: accentColor === '#7c3aed' ? '#a78bfa' : '#6ee7b7', fontSize: 13, cursor: 'pointer', padding: 0 }}
                    onClick={() => { setCurrentView(currentView === 'login' ? 'signup' : 'login'); setAuthError(''); setAuthSuccess(''); }}
                  >
                    {currentView === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Login'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleRefUpload = async (e) => {
    e.preventDefault();
    if (!refUploadFile || !selectedProject) return;
    setRefUploading(true);
    const fd = new FormData();
    fd.append('file', refUploadFile);
    fd.append('project_id', selectedProject.id);

    try {
      const res = await fetch(`${API_BASE}/api/ekta/upload/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      });
      if (res.ok) {
        setRefUploadFile(null);
        alert("Reference document successfully uploaded and indexed for Ekta AI!");
      } else {
        alert("Upload failed.");
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading file.");
    }
    setRefUploading(false);
  };

  // 4. MAIN APPLICATION DASHBOARDS (AFTER AUTH)
  return (
    <div 
      className="d-flex position-relative min-vh-100 bg-[#0B0C10]" 
      style={{ background: 'radial-gradient(circle at 80% -20%, rgba(168, 85, 247, 0.15) 0%, #0B0C10 60%)' }}
    >
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
              <button className={`sidebar-item ${managerTab === 'ekta' ? 'active' : ''}`} onClick={() => setManagerTab('ekta')}>
                <i className="bi bi-robot" style={{ color: '#8B5CF6', textShadow: '0 0 10px rgba(139,92,246,0.6)' }}></i> Ekta AI
              </button>
              <button className={`sidebar-item ${managerTab === 'profile' ? 'active' : ''}`} onClick={() => setManagerTab('profile')}>
                <i className="bi bi-person-circle"></i> Manage Profile
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
              <button className={`sidebar-item ${investigatorTab === 'live-chats' ? 'active' : ''}`} onClick={() => {
                setInvestigatorTab('live-chats');
                if (availableManagers.length > 0) {
                  setActiveThreadUser({ id: availableManagers[0].user_id, username: availableManagers[0].username });
                  fetchChatMessages(availableManagers[0].user_id);
                }
              }}>
                <i className="bi bi-chat-dots-fill"></i> Live Chats
              </button>
              <button className={`sidebar-item ${investigatorTab === 'ekta' ? 'active' : ''}`} onClick={() => setInvestigatorTab('ekta')}>
                <i className="bi bi-robot" style={{ color: '#8B5CF6', textShadow: '0 0 10px rgba(139,92,246,0.6)' }}></i> Ekta AI
              </button>
              <button className={`sidebar-item ${investigatorTab === 'profile' ? 'active' : ''}`} onClick={() => setInvestigatorTab('profile')}>
                <i className="bi bi-person-circle"></i> Manage Profile
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
        {/* Top Header — transparent, merged into page background with a subtle top-right glow */}
        <div
          className="d-flex justify-content-between align-items-center px-4 py-3"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 90,
            background: 'radial-gradient(ellipse 55% 140% at 100% 0%, rgba(155, 77, 255, 0.52) 0%, rgba(130, 50, 220, 0.22) 38%, transparent 65%)',
            borderBottom: '0.5px solid rgba(155, 77, 255, 0.12)',
            backdropFilter: 'blur(2px)',
          }}
        >
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
                setInvestigatorTab('live-chats');
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
              
              {/* Manager Metrics Cards (hidden when using Ekta or Live Chats to maximize space) */}
              {!['ekta', 'live-chats', 'profile'].includes(managerTab) && (
                <div className="col-12 mb-4">
                  <DashboardStatCards projects={projects} isManager={true} />
                </div>
              )}

              {/* Left Hand Options Panel & List */}
              <div className={`mb-4 ${['ekta', 'live-chats', 'profile'].includes(managerTab) ? 'col-12' : 'col-lg-8'}`}>
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
                              let rupees = parseFloat(p.budget_amount) || 0;
                              const conv = { rupees: 1, thousands: 1000, lakhs: 100000, crores: 10000000 };
                              rupees = rupees * (conv[p.budget_unit] || 1);
                              agencyBudgets[agency] = (agencyBudgets[agency] || 0) + rupees;
                            });
                            const sortedAgencies = Object.entries(agencyBudgets)
                              .map(([agency, budget]) => ({ agency, budget }))
                              .sort((a, b) => b.budget - a.budget)
                              .slice(0, 4);
                            const maxBudget = sortedAgencies.length > 0 ? sortedAgencies[0].budget : 1;
                            const fmtAmt = (r) => {
                              if (r >= 10000000) return (r/10000000).toFixed(2) + ' Cr';
                              if (r >= 100000)   return (r/100000).toFixed(2) + ' L';
                              if (r >= 1000)     return (r/1000).toFixed(2) + ' K';
                              return '₹' + r.toFixed(0);
                            };
                            if (sortedAgencies.length > 0) {
                              return sortedAgencies.map((item, idx) => {
                                const pct = (item.budget / maxBudget) * 100;
                                return (
                                  <div key={idx} className="mb-2">
                                    <div className="d-flex justify-content-between mb-1 small">
                                      <span className="text-truncate fw-bold" style={{ maxWidth: '70%', color: 'var(--text-primary)' }}>{item.agency}</span>
                                      <span className="text-muted">{fmtAmt(item.budget)}</span>
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
                  {/* Split layout: Vertical Feature Cards on Left, Large Workflow Timeline Canvas on Right */}
                  <div className="row mb-4">
                    {/* Left: 3 Feature Cards stacked vertically — Live Data */}
                    <div className="col-lg-4 d-flex flex-column gap-3 mb-4 mb-lg-0">
                      {/* Blue Card — Active Projects */}
                      <div
                        className="card card-glass p-3 flex-fill position-relative overflow-hidden"
                        style={{ background: 'radial-gradient(circle at 90% 10%, rgba(255,255,255,0.15) 0%, rgba(59,130,246,0.35) 25%, rgba(19,20,28,0.85) 70%)', cursor: 'pointer' }}
                        onClick={() => setManagerTab('projects')}
                      >
                        <div className="d-flex align-items-start gap-3 position-relative" style={{ zIndex: 1 }}>
                          <div className="bg-white/10 backdrop-blur-md border-[0.5px] border-white/20 rounded-xl p-2 d-flex align-items-center justify-content-center flex-shrink-0">
                            <i className="bi bi-folder2-open text-white fs-5"></i>
                          </div>
                          <div>
                            <h6 className="fw-bold text-white mb-1">Active Projects</h6>
                            <p className="text-white/60 mb-0" style={{ fontSize: '11px', lineHeight: '1.4' }}>
                              <span style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>{projects.filter(p => p.status === 'ongoing').length}</span> ongoing &nbsp;·&nbsp;
                              {projects.filter(p => p.status !== 'completed').length} total open
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Purple Card — Reports Awaiting Review */}
                      <div
                        className="card card-glass p-3 flex-fill position-relative overflow-hidden"
                        style={{ background: 'radial-gradient(circle at 90% 10%, rgba(255,255,255,0.15) 0%, rgba(155,77,255,0.35) 25%, rgba(19,20,28,0.85) 70%)', cursor: 'pointer' }}
                        onClick={() => setManagerTab('reviews')}
                      >
                        <div className="d-flex align-items-start gap-3 position-relative" style={{ zIndex: 1 }}>
                          <div className="bg-white/10 backdrop-blur-md border-[0.5px] border-white/20 rounded-xl p-2 d-flex align-items-center justify-content-center flex-shrink-0">
                            <i className="bi bi-file-earmark-check text-white fs-5"></i>
                          </div>
                          <div>
                            <h6 className="fw-bold text-white mb-1">Reports to Review</h6>
                            <p className="text-white/60 mb-0" style={{ fontSize: '11px', lineHeight: '1.4' }}>
                              <span style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>{projects.filter(p => ['submitted','resubmitted'].includes(p.report_status)).length}</span> pending action
                              {projects.filter(p => p.report_status === 'resubmit_requested').length > 0 && (
                                <span style={{ color: '#f59e0b' }}> · {projects.filter(p => p.report_status === 'resubmit_requested').length} resubmit</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Teal Card — Completion Rate */}
                      <div
                        className="card card-glass p-3 flex-fill position-relative overflow-hidden"
                        style={{ background: 'radial-gradient(circle at 90% 10%, rgba(255,255,255,0.15) 0%, rgba(20,184,166,0.35) 25%, rgba(19,20,28,0.85) 70%)' }}
                      >
                        <div className="d-flex align-items-start gap-3 position-relative" style={{ zIndex: 1 }}>
                          <div className="bg-white/10 backdrop-blur-md border-[0.5px] border-white/20 rounded-xl p-2 d-flex align-items-center justify-content-center flex-shrink-0">
                            <i className="bi bi-graph-up-arrow text-white fs-5"></i>
                          </div>
                          <div>
                            <h6 className="fw-bold text-white mb-1">Impact</h6>
                            <p className="text-white/60 mb-0" style={{ fontSize: '11px', lineHeight: '1.4' }}>
                              <span style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>
                                {projects.length > 0 ? Math.round((projects.filter(p => p.status === 'completed').length / projects.length) * 100) : 0}%
                              </span> completion rate
                              {(() => { const now = new Date(); const ov = projects.filter(p => p.status !== 'completed' && p.scheduled_completion && new Date(p.scheduled_completion) < now).length; return ov > 0 ? <span style={{ color: '#ef4444' }}> · {ov} overdue</span> : null; })()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Large Project Timeline Canvas */}
                    <div className="col-lg-8">
                      <div className="card card-glass h-100">
                        <div className="card-header card-glass-header py-3">
                          <h6 className="mb-0 fw-bold">
                            <i className="bi bi-diagram-3-fill me-2" style={{ color: '#9b4dff' }}></i>
                            Project Timeline — {selectedProject ? selectedProject.title : 'Workspace Live Flow'}
                          </h6>
                        </div>
                        <div className="card-body p-4" style={{ minHeight: '300px' }}>
                          <TimelineCanvas project={selectedProject} gradId="mgr4" />
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
                      {/* Timeline scale header & rows rendered dynamically */}
                      {(() => {
                        // Show all projects on the timeline
                        const timelineProjects = projects;
                        let minDate = new Date();
                        let maxDate = new Date();
                        if (timelineProjects.length > 0) {
                          const startTimes = timelineProjects.map(p => {
                            const d = new Date(p.start_date);
                            return isNaN(d) ? new Date().getTime() : d.getTime();
                          });
                          const endTimes = timelineProjects.map(p => {
                            let d = new Date(p.actual_completion || p.scheduled_completion);
                            return isNaN(d) ? new Date().getTime() : d.getTime();
                          });
                          minDate = new Date(Math.min(...startTimes));
                          maxDate = new Date(Math.max(...endTimes));
                        }

                        let totalDuration = maxDate - minDate;
                        if (totalDuration < 30 * 24 * 60 * 60 * 1000) {
                            totalDuration = 30 * 24 * 60 * 60 * 1000;
                            const center = minDate.getTime() + (maxDate.getTime() - minDate.getTime()) / 2;
                            minDate = new Date(center - totalDuration / 2);
                            maxDate = new Date(center + totalDuration / 2);
                        }

                        const pad = totalDuration * 0.05;
                        const chartStart = new Date(minDate.getTime() - pad);
                        const chartEnd = new Date(maxDate.getTime() + pad);
                        const chartDuration = chartEnd - chartStart;

                        const labels = [];
                        for (let i = 0; i <= 5; i++) {
                          const d = new Date(chartStart.getTime() + (chartDuration * i / 5));
                          labels.push(d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }));
                        }

                        return (
                          <div style={{ maxHeight: '400px', overflowY: 'auto', overflowX: 'hidden', paddingRight: '5px' }} className="custom-scrollbar">
                            <div className="timeline-grid border-bottom pb-2 mb-3" style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'rgba(19, 20, 28, 0.95)', backdropFilter: 'blur(5px)' }}>
                              <div className="fw-bold small text-muted text-uppercase">Projects</div>
                              <div className="d-flex justify-content-between w-100 position-relative text-muted small">
                                {labels.map((lbl, idx) => (
                                  <div key={idx} className="timeline-axis-label" style={{ width: '16.66%' }}>{lbl}</div>
                                ))}
                              </div>
                            </div>

                            {timelineProjects.length > 0 ? (
                              timelineProjects.map((p, idx) => {
                                // Color coding by status
                                let colorClass = 'timeline-capsule-purple';
                                if (p.status === 'completed') colorClass = 'bg-success text-white';
                                else if (p.status === 'pending' || p.status === 'up_next') colorClass = 'bg-warning text-dark';
                                else if (idx % 3 === 0) colorClass = 'timeline-capsule-purple';
                                else if (idx % 3 === 1) colorClass = 'timeline-capsule-blue';
                                else colorClass = 'timeline-capsule-mint';

                                const initials = p.assigned_investigator ? p.assigned_investigator.substring(0, 2).toUpperCase() : 'UI';
                                
                                let pStart = new Date(p.start_date);
                                if (isNaN(pStart)) pStart = minDate;
                                let pEnd = new Date(p.actual_completion || p.scheduled_completion);
                                if (isNaN(pEnd)) pEnd = maxDate;

                                const startPct = Math.max(0, (pStart - chartStart) / chartDuration) * 100;
                                const endPct = Math.min(1, (pEnd - chartStart) / chartDuration) * 100;
                                const widthPct = Math.max(5, endPct - startPct); // Ensure it's wide enough to be visible
                                
                                return (
                                  <div key={p.id} className="timeline-grid mb-3">
                                    <div className="text-truncate pe-2">
                                      <strong className="d-block small text-white">{p.project_code}</strong>
                                      <span className="text-muted" style={{ fontSize: '10px' }}>{p.title}</span>
                                    </div>
                                    <div className="w-100 position-relative" style={{ height: '36px' }}>
                                      <div 
                                        className={`timeline-capsule ${colorClass} d-flex justify-content-between align-items-center position-absolute`}
                                        style={{ left: `${startPct}%`, width: `${widthPct}%`, top: '0', bottom: '0', minWidth: '100px' }}
                                      >
                                        <span className="text-truncate px-2">{p.title}</span>
                                        <div className="d-flex align-items-center pe-2">
                                          <div className="timeline-member-dot" title="Assigned Investigator">{initials}</div>
                                          <div className="timeline-member-dot bg-dark text-muted" title="Project Coordinator">PC</div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="text-center py-4 text-muted small">No running projects with timelines to monitor.</div>
                            )}
                          </div>
                        );
                      })()}
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
                          <th>Report</th>
                          <th className="pe-3 text-end">Actions</th>
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
                            <td className="ps-3 align-middle"><strong>{p.project_code}</strong></td>
                            <td className="align-middle">{p.title}</td>
                            <td className="align-middle">{p.principal_agency}</td>
                            <td className="align-middle">{p.assigned_investigator || '-'}</td>
                            <td className="align-middle">
                              <span className={
                                 p.status === 'completed' ? 'pulse-badge-green' : 
                                 p.status === 'ongoing' ? 'pulse-badge-yellow' : 'pulse-badge-red'
                               }>
                                 {p.status}
                               </span>
                            </td>
                            <td className="align-middle">
                              <span className={
                                 p.report_status === 'approved' ? 'pulse-badge-green' :
                                 ['submitted', 'resubmitted'].includes(p.report_status) ? 'pulse-badge-yellow' : 'pulse-badge-red'
                               }>
                                 {p.report_status}
                               </span>
                            </td>
                            <td className="pe-3 text-end align-middle">
                              <button 
                                className="btn btn-sm btn-outline-light me-2" 
                                onClick={(e) => { e.stopPropagation(); handleEditProjectClick(p); }}
                                title="Edit Project"
                              >
                                <i className="bi bi-pencil-square"></i>
                              </button>
                              <button 
                                className="btn btn-sm btn-danger" 
                                onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id); }}
                                title="Delete Project"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
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

              {/* View 2: Add / Edit Project */}
              {['add-project', 'edit-project'].includes(managerTab) && (
                <div className="card card-glass mb-4">
                  <div className="card-header card-glass-header py-3">
                    <h5 className="mb-0 fw-bold">
                      <i className="bi bi-folder-plus"></i> {managerTab === 'edit-project' ? 'Edit Project Details' : 'Create & Assign New Project'}
                    </h5>
                  </div>
                  <div className="card-body">
                    <form onSubmit={managerTab === 'edit-project' ? handleUpdateProject : handleCreateProject}>
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
                            disabled={managerTab === 'edit-project'} // Cannot edit project code once created
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
                        <label className="form-label small fw-bold">Assign Investigator (Select User or Type Email)*</label>
                        <input 
                          type="text"
                          className="form-control"
                          list="investigators-list"
                          placeholder="Select from list or type external email..."
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

                      <div className="mb-3">
                        <label className="form-label small fw-bold">Supporting Documents</label>
                        <input 
                          type="file" 
                          className="form-control" 
                          multiple
                          onChange={(e) => setProjectDocs(e.target.files)}
                        />
                        <div className="form-text text-muted" style={{ fontSize: '11px' }}>
                          Upload any relevant documents for this project. They will be processed by Ekta AI.
                        </div>
                      </div>

                      <div className="d-flex justify-content-end gap-2 mt-4">
                        <button type="button" className="btn btn-glass" onClick={() => setManagerTab('projects')}>Cancel</button>
                        <button type="submit" className="btn btn-primary-glow">
                          {managerTab === 'edit-project' ? 'Update Project' : 'Create Project'}
                        </button>
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
                      <div className="col-md-4 chat-thread-list" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        <div className="chat-active-header p-2 text-center small fw-bold">Active Threads</div>
                        <div className="list-group list-group-flush">
                          {chatThreads.map((thread) => (
                            <button
                              key={thread.user_id}
                              type="button"
                              className={`list-group-item list-group-item-action border-0 d-flex justify-content-between align-items-center text-start ${activeThreadUser?.id === thread.user_id ? 'bg-primary bg-opacity-25 text-white' : 'text-muted'}`}
                              onClick={() => {
                                setActiveThreadUser({ id: thread.user_id, username: thread.username });
                                fetchChatMessages(thread.user_id);
                              }}
                            >
                              <div className="text-truncate" style={{ maxWidth: '80%' }}>
                                <strong className="d-block text-white">{thread.username}</strong>
                                <span className="small text-muted text-truncate d-block">
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
                            <div className="chat-active-header p-3 d-flex justify-content-between align-items-center">
                              <span className="fw-bold"><i className="bi bi-person-fill"></i> {activeThreadUser.username}</span>
                              <div className="d-flex align-items-center gap-3">
                                <span className="badge bg-success">Online & Encrypted</span>
                                <button className="btn btn-sm btn-outline-danger py-0 px-2" title="Clear Conversation" onClick={() => handleClearConversation(activeThreadUser.id)}>
                                  <i className="bi bi-trash3"></i>
                                </button>
                              </div>
                            </div>

                            {/* Chat history */}
                            <div className="flex-fill p-3 chat-history-pane" style={{ overflowY: 'auto' }}>
                              {chatMessages.map((msg, idx) => (
                                <div key={idx} className={`d-flex mb-2 align-items-center ${msg.sender_username === username ? 'justify-content-end' : 'justify-content-start'}`}>
                                  {msg.sender_username === username && (
                                    <button type="button" className="btn btn-link text-danger p-0 me-2" style={{ fontSize: '12px', border: 'none', background: 'none' }} title="Delete Message" onClick={() => handleDeleteLiveMessage(msg.id)}>
                                      <i className="bi bi-trash"></i>
                                    </button>
                                  )}
                                  <div
                                    className={`p-2 rounded small ${msg.sender_username === username ? 'chat-bubble-outgoing' : 'chat-bubble-incoming'}`}
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
                            <form onSubmit={handleSendLiveMessage} className="p-3 chat-input-bar d-flex gap-2">
                              <input
                                type="text"
                                className="form-control"
                                placeholder={`Type your reply to ${activeThreadUser.username}...`}
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                required
                              />
                              <button type="submit" className="btn btn-cyan-glow">
                                <i className="bi bi-send"></i>
                              </button>
                            </form>
                          </>
                        ) : (
                          <div className="d-flex flex-column align-items-center justify-content-center flex-fill text-muted">
                            <i className="bi bi-chat-left-dots fs-1 mb-2 text-purple" style={{ color: 'var(--accent-purple)' }}></i>
                            <span className="small">Select a conversation thread to view history and messages.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {managerTab === 'ekta' && (
                <div style={{ height: 'calc(100vh - 140px)', minHeight: '600px' }}>
                  <EktaTab 
                    isStaff={isStaff} 
                    projects={projects} 
                    selectedProject={selectedProject} 
                    onSelectProject={setSelectedProject} 
                    token={token} 
                  />
                </div>
              )}

              {managerTab === 'profile' && (
                <ProfileTab token={token} username={username} />
              )}

            </div>
            
            {/* Manager Sidebar (Project Detail) */}
            {!['ekta', 'live-chats', 'profile'].includes(managerTab) && (
              <div className="col-lg-4" style={{ position: 'sticky', top: '20px', alignSelf: 'start' }}>
                {selectedProject ? (
                <div className="card card-glass mb-4">
                  <div className="card-header card-glass-header d-flex justify-content-between align-items-center py-3">
                    <h5 className="mb-0 fw-bold"><i className="bi bi-info-circle"></i> Project Details</h5>
                    <div>
                      <button type="button" className="btn btn-sm btn-outline-light me-2" onClick={() => handleEditProjectClick(selectedProject)}>
                        <i className="bi bi-pencil-square"></i> Edit
                      </button>
                      <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedProject(null)}></button>
                    </div>
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

                    {/* Quick Document Upload Form */}
                    <div className="bg-dark bg-opacity-35 p-3 rounded border border-secondary border-opacity-20 mt-3">
                      <h6 className="mb-2 fw-bold"><i className="bi bi-cloud-arrow-up text-violet-400 me-2"></i>Upload Reference Docs</h6>
                      <p className="small text-white-50 mb-3">Add supporting materials (.pdf, .txt, .md, .docx, images) to this project at any time. Ekta AI will read them instantly.</p>
                      <form onSubmit={handleRefUpload}>
                        <div className="d-flex align-items-center gap-2 mb-3">
                          <label className="btn btn-outline-light d-flex align-items-center justify-content-center p-0" style={{ width: '35px', height: '35px', borderRadius: '50%', cursor: 'pointer', border: '1px dashed rgba(255,255,255,0.3)', flexShrink: 0 }} title="Choose File or Paste Document/Image">
                            <i className="bi bi-paperclip fs-5 text-violet-400"></i>
                            <input 
                              type="file" 
                              className="d-none" 
                              onChange={e => setRefUploadFile(e.target.files[0])}
                              accept=".pdf,.txt,.md,.doc,.docx,.png,.jpg,.jpeg"
                            />
                          </label>
                          <div className="small text-white-50 text-truncate" style={{ flex: 1, fontSize: '11px' }}>
                            {refUploadFile ? refUploadFile.name : "Select or paste file..."}
                          </div>
                        </div>
                        <button type="submit" className="btn btn-sm btn-primary w-100 shadow-sm" disabled={!refUploadFile || refUploading} style={{ background: '#8B5CF6', border: 'none', transition: 'all 0.2s' }}>
                          {refUploading ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-upload me-2"></i>}
                          {refUploading ? 'Uploading...' : 'Upload & Index'}
                        </button>
                      </form>
                    </div>

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
                  <p className="mb-3">Select a project from the directory list to examine details.</p>
                  <div className="px-4">
                    <select 
                      className="form-select" 
                      onChange={(e) => {
                        if (e.target.value) fetchProjectDetail(e.target.value);
                      }}
                      style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <option value="" style={{ color: '#000' }}>-- Or quickly select a project here --</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id} style={{ color: '#000' }}>
                          {p.project_code} - {p.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
            )}

          </div>
        )}

        {/* ============================================== */}
        {/* INVESTIGATOR / TEAM DASHBOARD VIEW            */}
        {/* ============================================== */}
        {!isStaff && (
          <div className="row">
            
            {/* Investigator Metrics Bar (hidden when using Ekta AI or Live Chats to maximize space) */}
            {!['ekta', 'live-chats', 'profile'].includes(investigatorTab) && (
              <div className="col-12 mb-4">
                <DashboardStatCards projects={projects} isManager={false} />
              </div>
            )}

            {/* Investigator Options and Task List */}
            <div className={`mb-4 ${['ekta', 'live-chats', 'profile'].includes(investigatorTab) ? 'col-12' : 'col-lg-8'}`}>
              
              {investigatorTab === 'running' && (
                <>
                  {/* Split layout: Vertical Feature Cards on Left, Large Workflow Timeline Canvas on Right */}
                  <div className="row mb-4">
                    {/* Left: 3 Feature Cards stacked vertically — Investigator Live Data */}
                    <div className="col-lg-4 d-flex flex-column gap-3 mb-4 mb-lg-0">
                      {/* Blue Card — My Active Task */}
                      <div
                        className="card card-glass p-3 flex-fill position-relative overflow-hidden"
                        style={{ background: 'radial-gradient(circle at 90% 10%, rgba(255,255,255,0.15) 0%, rgba(59,130,246,0.35) 25%, rgba(19,20,28,0.85) 70%)', cursor: 'pointer' }}
                        onClick={() => setInvestigatorTab('running')}
                      >
                        <div className="d-flex align-items-start gap-3 position-relative" style={{ zIndex: 1 }}>
                          <div className="bg-white/10 backdrop-blur-md border-[0.5px] border-white/20 rounded-xl p-2 d-flex align-items-center justify-content-center flex-shrink-0">
                            <i className="bi bi-play-circle text-white fs-5"></i>
                          </div>
                          <div>
                            <h6 className="fw-bold text-white mb-1">My Active Projects</h6>
                            <p className="text-white/60 mb-0" style={{ fontSize: '11px', lineHeight: '1.4' }}>
                              <span style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>{runningTasks.length}</span> running &nbsp;·&nbsp;
                              {upcomingTasks.length} upcoming
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Purple Card — Report Status */}
                      <div
                        className="card card-glass p-3 flex-fill position-relative overflow-hidden"
                        style={{ background: 'radial-gradient(circle at 90% 10%, rgba(255,255,255,0.15) 0%, rgba(155,77,255,0.35) 25%, rgba(19,20,28,0.85) 70%)' }}
                      >
                        <div className="d-flex align-items-start gap-3 position-relative" style={{ zIndex: 1 }}>
                          <div className="bg-white/10 backdrop-blur-md border-[0.5px] border-white/20 rounded-xl p-2 d-flex align-items-center justify-content-center flex-shrink-0">
                            <i className="bi bi-file-earmark-text text-white fs-5"></i>
                          </div>
                          <div>
                            <h6 className="fw-bold text-white mb-1">Report Status</h6>
                            <p className="text-white/60 mb-0" style={{ fontSize: '11px', lineHeight: '1.4' }}>
                              {selectedProject ? (
                                <>
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: selectedProject.report_status === 'approved' ? '#10b981' : selectedProject.report_status === 'rejected' ? '#ef4444' : selectedProject.report_status === 'submitted' ? '#f59e0b' : '#fff' }}>
                                    {selectedProject.report_status === 'not_submitted' ? 'Not Submitted' :
                                     selectedProject.report_status === 'submitted' ? 'Under Review' :
                                     selectedProject.report_status === 'approved' ? '✓ Approved' :
                                     selectedProject.report_status === 'rejected' ? '✗ Rejected' :
                                     selectedProject.report_status === 'resubmit_requested' ? '🔄 Resubmit' :
                                     selectedProject.report_status}
                                  </span>
                                  <span className="d-block mt-1" style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px' }}>{selectedProject.title}</span>
                                </>
                              ) : (
                                <span>{projects.filter(p => p.report_status === 'submitted').length} under review · {projects.filter(p => p.report_status === 'approved').length} approved</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Teal Card — Completion */}
                      <div
                        className="card card-glass p-3 flex-fill position-relative overflow-hidden"
                        style={{ background: 'radial-gradient(circle at 90% 10%, rgba(255,255,255,0.15) 0%, rgba(20,184,166,0.35) 25%, rgba(19,20,28,0.85) 70%)', cursor: 'pointer' }}
                        onClick={() => setInvestigatorTab('past')}
                      >
                        <div className="d-flex align-items-start gap-3 position-relative" style={{ zIndex: 1 }}>
                          <div className="bg-white/10 backdrop-blur-md border-[0.5px] border-white/20 rounded-xl p-2 d-flex align-items-center justify-content-center flex-shrink-0">
                            <i className="bi bi-trophy text-white fs-5"></i>
                          </div>
                          <div>
                            <h6 className="fw-bold text-white mb-1">Completed</h6>
                            <p className="text-white/60 mb-0" style={{ fontSize: '11px', lineHeight: '1.4' }}>
                              <span style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>{pastTasks.length}</span> task{pastTasks.length !== 1 ? 's' : ''} done
                              {projects.length > 0 && (
                                <span> · {Math.round((pastTasks.length / projects.length) * 100)}% rate</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Large Project Timeline Canvas */}
                    <div className="col-lg-8">
                      <div className="card card-glass h-100">
                        <div className="card-header card-glass-header py-3">
                          <h6 className="mb-0 fw-bold">
                            <i className="bi bi-diagram-3-fill me-2" style={{ color: '#9b4dff' }}></i>
                            Project Timeline — {selectedProject ? selectedProject.title : 'Select a project'}
                          </h6>
                        </div>
                        <div className="card-body p-4" style={{ minHeight: '300px' }}>
                          <TimelineCanvas project={selectedProject} gradId="inv4" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Running Tasks Table */}
                  <div className="card card-glass mb-4">
                    <div className="card-header card-glass-header py-3">
                      <h5 className="mb-0 fw-bold"><i className="bi bi-play-circle me-2 text-primary"></i> Running Projects</h5>
                    </div>
                    <div className="card-body p-0">
                      <table className="table table-hover mb-0">
                        <thead>
                          <tr>
                            <th className="ps-3">Code</th>
                            <th>Title</th>
                            <th>Agency</th>
                            <th>Timeline</th>
                            <th className="pe-3">Report Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {runningTasks.map((p) => (
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
                          {runningTasks.length === 0 && (
                            <tr>
                              <td colSpan="5" className="text-center py-4 text-muted">No running projects currently.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* Upcoming Tasks - Unique Calendar/Grid Design */}
              {investigatorTab === 'upcoming' && (
                <div className="row g-4 mb-4">
                  <div className="col-12">
                    <h4 className="fw-bold mb-1"><i className="bi bi-calendar-event text-warning me-2"></i> Upcoming Pipeline</h4>
                    <p className="text-muted small">Projects scheduled to start soon. Prepare necessary documents.</p>
                  </div>
                  {upcomingTasks.length > 0 ? upcomingTasks.map(p => {
                    const daysUntil = Math.ceil((new Date(p.start_date) - new Date()) / (1000 * 60 * 60 * 24));
                    return (
                      <div className="col-md-6" key={p.id}>
                        <div 
                          className={`card card-glass h-100 ${selectedProject?.id === p.id ? 'border-warning' : ''}`} 
                          style={{ cursor: 'pointer', transition: 'transform 0.2s', borderLeft: '4px solid var(--accent-yellow)' }} 
                          onClick={() => fetchProjectDetail(p.id)}
                        >
                          <div className="card-body">
                            <div className="d-flex justify-content-between mb-3">
                              <span className="badge bg-warning bg-opacity-25 text-warning px-2 py-1 rounded-pill">{p.project_code}</span>
                              <span className={`small fw-bold ${daysUntil <= 7 ? 'text-danger' : 'text-warning'}`}>
                                <i className="bi bi-clock-history me-1"></i> 
                                {daysUntil > 0 ? `Starts in ${daysUntil} days` : 'Starts very soon'}
                              </span>
                            </div>
                            <h5 className="fw-bold mb-2">{p.title}</h5>
                            <p className="small text-muted mb-3" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {p.description || "No specific details provided yet. Awaiting full project brief."}
                            </p>
                            <hr className="border-secondary opacity-25" />
                            <div className="d-flex align-items-center justify-content-between small">
                              <span className="text-muted"><i className="bi bi-building me-1"></i> {p.principal_agency}</span>
                              <span className="fw-bold text-white">₹{p.budget_amount} {p.budget_unit}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="col-12 text-center py-5 text-muted">
                      <div className="bg-dark bg-opacity-25 rounded-circle d-inline-flex p-4 mb-3">
                        <i className="bi bi-calendar-x fs-1 opacity-50"></i>
                      </div>
                      <h5>No Upcoming Projects</h5>
                      <p className="small">Your schedule is clear. Check back later for new assignments.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Past Tasks - Unique Trophy/Certificate Design */}
              {investigatorTab === 'past' && (
                <div className="row g-4 mb-4">
                  <div className="col-12">
                    <h4 className="fw-bold mb-1"><i className="bi bi-trophy-fill text-success me-2"></i> Achieved Milestones</h4>
                    <p className="text-muted small">Successfully completed projects and final reports.</p>
                  </div>
                  {pastTasks.length > 0 ? pastTasks.map(p => (
                    <div className="col-md-6" key={p.id}>
                      <div 
                        className={`card card-glass h-100 position-relative overflow-hidden ${selectedProject?.id === p.id ? 'border-success' : ''}`} 
                        style={{ cursor: 'pointer', border: '1px solid rgba(16, 185, 129, 0.3)' }} 
                        onClick={() => fetchProjectDetail(p.id)}
                      >
                        <div className="position-absolute" style={{ top: '-15px', right: '-15px', opacity: 0.05, transform: 'rotate(15deg)' }}>
                          <i className="bi bi-award-fill text-success" style={{ fontSize: '120px' }}></i>
                        </div>
                        <div className="card-body position-relative z-index-1 d-flex flex-column">
                          <div className="mb-auto">
                            <div className="d-flex justify-content-between mb-2">
                              <span className="text-success small fw-bold"><i className="bi bi-check-circle-fill me-1"></i> Completed</span>
                              <span className="badge bg-dark border border-secondary text-light">{p.project_code}</span>
                            </div>
                            <h5 className="fw-bold text-white mb-3">{p.title}</h5>
                          </div>
                          
                          <div className="bg-black bg-opacity-25 rounded p-3 mt-3">
                            <div className="d-flex justify-content-between mb-2 small">
                              <span className="text-muted"><i className="bi bi-calendar-check me-1"></i> Ended:</span>
                              <span className="text-white">{p.actual_completion || p.scheduled_completion}</span>
                            </div>
                            <div className="d-flex justify-content-between mb-2 small">
                              <span className="text-muted"><i className="bi bi-file-earmark-check me-1"></i> Report:</span>
                              <span className={p.report_status === 'approved' ? 'text-success fw-bold' : 'text-warning fw-bold'}>{p.report_status}</span>
                            </div>
                            <div className="d-flex justify-content-between small pt-2 border-top border-secondary border-opacity-25">
                              <span className="text-muted">Budget Utilized:</span>
                              <span className="fw-bold text-success">₹{p.budget_amount} {p.budget_unit}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="col-12 text-center py-5 text-muted">
                      <div className="bg-dark bg-opacity-25 rounded-circle d-inline-flex p-4 mb-3">
                        <i className="bi bi-inbox fs-1 opacity-50"></i>
                      </div>
                      <h5>No Completed Projects Yet</h5>
                      <p className="small">Finish your current active tasks to see them appear here.</p>
                    </div>
                  )}
                </div>
              )}

              {/* View: Notifications tab */}
              {investigatorTab === 'notifications' && (
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

              {/* View: Investigator Live Chats Tab */}
              {investigatorTab === 'live-chats' && (
                <div className="card card-glass mb-4">
                  <div className="card-header card-glass-header py-3">
                    <h5 className="mb-0 fw-bold"><i className="bi bi-chat-dots-fill"></i> Secure Chat Center (Live)</h5>
                  </div>
                  <div className="card-body p-0">
                    <div className="row g-0" style={{ minHeight: '400px' }}>
                      {/* Left: Available Managers threads */}
                      <div className="col-md-4 chat-thread-list" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        <div className="chat-active-header p-2 text-center small fw-bold">Active Threads</div>
                        <div className="list-group list-group-flush">
                          {chatThreads.map((m) => (
                            <button
                              key={m.user_id}
                              type="button"
                              className={`list-group-item list-group-item-action border-0 d-flex justify-content-between align-items-center text-start ${activeThreadUser?.id === m.user_id ? 'bg-primary bg-opacity-25 text-white' : 'text-muted'}`}
                              onClick={() => {
                                setActiveThreadUser({ id: m.user_id, username: m.username });
                                fetchChatMessages(m.user_id);
                              }}
                            >
                              <div className="text-truncate" style={{ maxWidth: '80%' }}>
                                <strong className="d-block text-white">{m.username}</strong>
                                <span className="small text-muted text-truncate d-block">
                                  {m.latest_message || (m.is_staff ? 'Manager Account' : 'Investigator Account')}
                                </span>
                              </div>
                              {m.unread_count > 0 && (
                                <span className="badge bg-danger rounded-circle">{m.unread_count}</span>
                              )}
                            </button>
                          ))}
                          {chatThreads.length === 0 && (
                            <div className="list-group-item text-center py-4 text-muted small">No active users found.</div>
                          )}
                        </div>
                      </div>

                      {/* Right: Message Window */}
                      <div className="col-md-8 d-flex flex-column" style={{ height: '500px' }}>
                        {activeThreadUser ? (
                          <>
                            {/* Thread header */}
                            <div className="chat-active-header p-3 d-flex justify-content-between align-items-center">
                              <span className="fw-bold"><i className="bi bi-person-fill"></i> {activeThreadUser.username}</span>
                              <div className="d-flex align-items-center gap-3">
                                <span className="badge bg-success">Online & Encrypted</span>
                                <button className="btn btn-sm btn-outline-danger py-0 px-2" title="Clear Conversation" onClick={() => handleClearConversation(activeThreadUser.id)}>
                                  <i className="bi bi-trash3"></i>
                                </button>
                              </div>
                            </div>

                            {/* Chat history */}
                            <div className="flex-fill p-3 chat-history-pane" style={{ overflowY: 'auto' }}>
                              {chatMessages.map((msg, idx) => (
                                <div key={idx} className={`d-flex mb-2 align-items-center ${msg.sender_username === username ? 'justify-content-end' : 'justify-content-start'}`}>
                                  {msg.sender_username === username && (
                                    <button type="button" className="btn btn-link text-danger p-0 me-2" style={{ fontSize: '12px', border: 'none', background: 'none' }} title="Delete Message" onClick={() => handleDeleteLiveMessage(msg.id)}>
                                      <i className="bi bi-trash"></i>
                                    </button>
                                  )}
                                  <div
                                    className={`p-2 rounded small ${msg.sender_username === username ? 'chat-bubble-outgoing' : 'chat-bubble-incoming'}`}
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
                            <form onSubmit={handleSendLiveMessage} className="p-3 chat-input-bar d-flex gap-2">
                              <input
                                type="text"
                                className="form-control"
                                placeholder={`Type your message to ${activeThreadUser.username}...`}
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                required
                              />
                              <button type="submit" className="btn btn-cyan-glow">
                                <i className="bi bi-send"></i>
                              </button>
                            </form>
                          </>
                        ) : (
                          <div className="d-flex flex-column align-items-center justify-content-center flex-fill text-muted">
                            <i className="bi bi-chat-left-dots fs-1 mb-2 text-purple" style={{ color: 'var(--accent-purple)' }}></i>
                            <span className="small">Select a coordinator manager from the left list to start live chat.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {investigatorTab === 'ekta' && (
                <div style={{ height: 'calc(100vh - 140px)', minHeight: '600px' }}>
                  <EktaTab 
                    isStaff={isStaff} 
                    projects={projects} 
                    selectedProject={selectedProject} 
                    onSelectProject={setSelectedProject} 
                    token={token} 
                  />
                </div>
              )}

              {investigatorTab === 'profile' && (
                <ProfileTab token={token} />
              )}

            </div>

            {/* Investigator Sidebar Detail Card */}
            {!['ekta', 'live-chats', 'profile'].includes(investigatorTab) && (
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
                      {selectedProject.supporting_documents && selectedProject.supporting_documents.length > 0 && (
                        <li className="list-group-item ps-0">
                          <strong>Supporting Documents:</strong>
                          <div className="mt-2 d-flex flex-wrap gap-2">
                            {selectedProject.supporting_documents.map(doc => (
                              <a 
                                key={doc.id}
                                href={`${API_BASE}${doc.url}`} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="btn btn-sm btn-cyan-glow"
                              >
                                <i className="bi bi-file-earmark-arrow-down"></i> {doc.filename}
                              </a>
                            ))}
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
                  </div>
                </div>
              ) : (
                <div className="card card-glass text-center py-5 text-muted">
                  <i className="bi bi-card-checklist fs-2 mb-2 d-block text-purple" style={{ color: 'var(--accent-purple)' }}></i>
                  <p className="mb-3">Select any task from the category list to review metadata details or submit compliance reports.</p>
                  <div className="px-4">
                    <select 
                      className="form-select" 
                      onChange={(e) => {
                        if (e.target.value) fetchProjectDetail(e.target.value);
                      }}
                      style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <option value="" style={{ color: '#000' }}>-- Or quickly select a task here --</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id} style={{ color: '#000' }}>
                          {p.project_code} - {p.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
            )}

          </div>
        )}

      </div>
    </div>
    
      {/* Manager's Assignment Quick View Popup & FAB */}
      {isStaff && (
        <>
          <button 
            className="btn btn-primary rounded-circle shadow position-fixed d-flex align-items-center justify-content-center" 
            style={{ bottom: '30px', right: '30px', width: '60px', height: '60px', zIndex: 1050, background: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)', border: 'none', transition: 'transform 0.2s' }}
            type="button" 
            onClick={() => setShowAssignmentsPopup(!showAssignmentsPopup)}
            title="Quick View Assignments"
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <i className={showAssignmentsPopup ? "bi bi-x-lg fs-5 text-white" : "bi bi-person-lines-fill fs-4 text-white"}></i>
          </button>

          {showAssignmentsPopup && (
            <div 
              className="position-fixed shadow-lg rounded-4 overflow-hidden assignments-popup" 
              style={{ 
                bottom: '100px', right: '30px', width: '380px', maxHeight: '75vh', zIndex: 1040, 
                backgroundColor: 'rgba(15, 17, 26, 0.65)', 
                backdropFilter: 'blur(24px)', 
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)'
              }}
            >
              <style>{`
                @keyframes popIn {
                  0% { opacity: 0; transform: scale(0.95) translateY(20px); }
                  100% { opacity: 1; transform: scale(1) translateY(0); }
                }
                .assignments-popup {
                  animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                }
                .task-card-hover {
                  transition: all 0.2s ease;
                }
                .task-card-hover:hover {
                  transform: translateY(-2px);
                  background-color: rgba(255,255,255,0.08) !important;
                  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
                  border-color: rgba(139, 92, 246, 0.4) !important;
                }
                .custom-scroll::-webkit-scrollbar {
                  width: 4px;
                }
                .custom-scroll::-webkit-scrollbar-track {
                  background: transparent;
                }
                .custom-scroll::-webkit-scrollbar-thumb {
                  background: rgba(255,255,255,0.1);
                  border-radius: 10px;
                }
              `}</style>
              
              <div className="p-3 border-bottom border-white border-opacity-10 d-flex justify-content-between align-items-center" style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)' }}>
                <h6 className="fw-bold mb-0 text-white d-flex align-items-center">
                  <div className="bg-primary bg-opacity-25 rounded p-1 me-2 d-flex align-items-center justify-content-center" style={{ width: '28px', height: '28px' }}>
                    <i className="bi bi-card-checklist text-primary" style={{ fontSize: '14px' }}></i>
                  </div>
                  Delegated Tasks
                </h6>
                <span className="badge rounded-pill" style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)', boxShadow: '0 2px 10px rgba(139, 92, 246, 0.3)' }}>{projects.length} Total</span>
              </div>
              
              <div className="p-0 custom-scroll" style={{ overflowY: 'auto', maxHeight: 'calc(75vh - 65px)' }}>
                {/* Small Table: Tasks per Investigator */}
                <div className="p-3 border-bottom border-white border-opacity-10" style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <h6 className="small fw-bold text-white-50 mb-3 text-uppercase" style={{ letterSpacing: '1px', fontSize: '10px' }}>Distribution Summary</h6>
                  <table className="table table-sm table-borderless mb-0" style={{ backgroundColor: 'transparent' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <th className="text-white-50 fw-semibold px-0 pb-2" style={{ fontSize: '11px' }}>Investigator</th>
                        <th className="text-end text-white-50 fw-semibold px-0 pb-2" style={{ fontSize: '11px' }}>Tasks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const counts = projects.reduce((acc, p) => {
                          const inv = p.assigned_investigator || p.assigned_email || 'Unassigned';
                          acc[inv] = (acc[inv] || 0) + 1;
                          return acc;
                        }, {});
                        return Object.entries(counts).map(([inv, count]) => (
                          <tr key={inv}>
                            <td className="text-white px-0 py-2 d-flex align-items-center" style={{ fontSize: '12px' }}>
                              <div className="bg-white bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center me-2" style={{ width: '20px', height: '20px', fontSize: '10px' }}>
                                {inv.charAt(0).toUpperCase()}
                              </div>
                              {inv}
                            </td>
                            <td className="text-end px-0 py-2 align-middle">
                              <span className="badge bg-white bg-opacity-10 text-white rounded-pill px-2">{count}</span>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Individual Tasks List */}
                <div className="p-3">
                  <h6 className="small fw-bold text-white-50 mb-3 text-uppercase" style={{ letterSpacing: '1px', fontSize: '10px' }}>Recent Assignments</h6>
                  {projects.length > 0 ? projects.map(p => (
                    <div key={p.id} className="task-card-hover bg-white bg-opacity-5 border border-white border-opacity-10 mb-3 rounded p-3" style={{ cursor: 'default' }}>
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 rounded-pill px-2">{p.project_code}</span>
                        <button 
                          className="btn btn-sm btn-outline-light py-0 px-2 d-flex align-items-center gap-1 rounded-pill transition-all" 
                          style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#fff'; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = ''; }}
                          onClick={() => {
                            setShowAssignmentsPopup(false);
                            setManagerTab('projects');
                            handleEditProjectClick(p);
                          }}
                        >
                          <i className="bi bi-pencil-square" style={{ fontSize: '10px' }}></i> Edit
                        </button>
                      </div>
                      <h6 className="fw-bold text-white mb-1" style={{ fontSize: '13px', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.title}</h6>
                      <div className="text-white-50 mb-3 d-flex align-items-center" style={{ fontSize: '11px' }}>
                        <i className="bi bi-building me-1 opacity-75"></i> {p.principal_agency}
                      </div>
                      
                      <div className="d-flex align-items-center bg-black bg-opacity-25 p-2 rounded border border-white border-opacity-5">
                        <div className="bg-primary bg-opacity-25 rounded-circle d-flex align-items-center justify-content-center me-2" style={{ width: '24px', height: '24px', flexShrink: 0 }}>
                          <i className="bi bi-person text-primary" style={{ fontSize: '12px' }}></i>
                        </div>
                        <div className="overflow-hidden">
                          <div className="small text-white fw-medium text-truncate" style={{ fontSize: '11px' }}>{p.assigned_investigator || p.assigned_email || 'Unassigned'}</div>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-4 text-white-50">
                      <div className="bg-white bg-opacity-5 rounded-circle d-inline-flex p-3 mb-2 border border-white border-opacity-10">
                        <i className="bi bi-inbox fs-4 opacity-50"></i>
                      </div>
                      <p className="small mb-0" style={{ fontSize: '12px' }}>No tasks assigned yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
