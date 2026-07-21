# 👁️ Drishti — Enterprise Operations, Audit & Compliance Platform

**Drishti** is an enterprise-grade, centralized operations monitoring, audit management, and AI intelligence platform built to streamline complex multi-project lifecycles, compliance audits, and real-time collaboration between Executive Managers (Coordinators) and Principal Investigators across large-scale organizations.

Engineered to operate seamlessly across high-concurrency enterprise environments, Drishti combines robust role-based governance with cutting-edge Retrieval-Augmented Generation (RAG) to transform static project documentation into actionable operational intelligence.

---

## 🌟 Key Capabilities & Core Value

### 🧠 Autonomous AI-Powered RAG Engine (Ekta AI)
What sets Drishti apart from traditional project management platforms is **Ekta AI**, an integrated context-aware intelligence core. 
- **Context-Grounded RAG**: Ekta ingests project proposals, technical blueprints, and compliance documents (PDFs/DOCX) into an embedded vector database (ChromaDB), delivering zero-hallucination answers backed strictly by uploaded project evidence.
- **Explainable Rejection & Audit Analysis**: When a compliance report is flagged or rejected, Ekta analyzes manager audit feedback against project guidelines, explaining exact deficiency areas and offering guidance for resubmission.
- **Native Multilingual Support**: Capable of understanding and responding in native Indian languages (such as Hindi, Kannada, Bengali, Telugu, Tamil, and English) matching the exact script and language of the inquirer.

### 📋 Enterprise Project Lifecycle & Audit Management
- **4-Stage Lifecycle Canvas**: Real-time visual tracking through key operational stages—*Task Initiated*, *Report Submitted*, *Under Review*, and *Final Decision*.
- **Smart Unit Financial Tracking**: Dynamic budget visualization supporting enterprise-scale financial units (Crores `Cr`, Lakhs `L`, Thousands `K`, and Rupees `₹`).
- **Comprehensive Document Auditing**: Centralized portal for investigators to submit formal project reports and for managers to conduct rigorous line-item reviews, approvals, or structured resubmission requests.

### ⚡ High-Throughput & Scale Ready (500+ Concurrent Tasks)
- Built on a decoupled, asynchronous micro-architecture designed to support **500+ concurrent project workflows**, live workspace interactions, and real-time status syncing across multiple enterprise divisions without performance bottlenecks.

### 🔔 Instant Multi-Channel Alerts & Email Notifications
- **Automated Email Notifications**: Powered by a background notification engine that triggers instant email alerts for critical operational events—task assignments, report submissions, audit reviews, and manager decisions.
- **Live Alerts Feed**: In-app real-time notification hub keeping team members immediately informed of workspace actions.

### 💬 Secure Live Messaging & Team Management
- Integrated real-time messaging system allowing instant, project-scoped collaboration between Managers and Investigators, complete with team grouping functionality and workspace event auditing.

### 🛡️ Enterprise Security & Data Governance
- **JWT & Role-Based Access Control (RBAC)**: Secure authentication token architecture enforcing strict boundary isolation between Manager (Staff) and Investigator permissions.
- **Isolated Session Handling**: Tab-level session isolation ensuring multi-role sessions never bleed or contaminate workspace state.
- **Secure File Storage**: Sandboxed document storage with strict file-type verification (PDF compliance validation).

---

## 🏗️ Architecture & Technology Stack

Drishti utilizes a decoupled, cloud-ready architecture:

- **Core Application Backend**: Python 3, Django, Django REST Framework (DRF)
- **Frontend Presentation Layer**: React, Vite, Vanilla CSS
- **AI & RAG Intelligence**: ChromaDB (Vector Search), HuggingFace Inference API, SentenceTransformers (`all-MiniLM-L6-v2`)
- **Authentication & Security**: SimpleJWT, Django RBAC, Session Management
- **Cloud Deployment**: Deployed and operational on **AWS EC2 (Ubuntu Linux)** infrastructure

---

## 🚀 Getting Started (Local Development Setup)

To run Drishti locally on your machine, launch the backend and frontend services in separate terminal sessions.

### Prerequisites
- Python 3.9+
- Node.js 18+ and `npm`
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/Archit008-prg/Drishti.git
cd Drishti
```

### 2. Launch Backend API Server (Django)
```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate       # On Windows: venv\Scripts\activate

# Install dependencies and setup database
pip install -r requirements.txt
python manage.py migrate

# Start the backend server
python manage.py runserver
```
*The Django REST API will run at `http://localhost:8000`*

### 3. Launch Frontend Web App (React)
Open a new terminal window:
```bash
cd Drishti/frontend

# Install dependencies and start development server
npm install
npm run dev
```
*The web interface will launch at `http://localhost:5173`*

---

## 🔮 Strategic Roadmap & Future Vision

- 🤖 **Automated AI Report Verification & Reconciliation**: Machine-learning algorithms to auto-verify submitted investigator reports against manager baseline specifications prior to human review.
- ⚡ **Dynamic Workload Allocation & Team Optimization**: AI-driven task rebalancing based on real-time investigator capacity, project urgency, and historical completion metrics.
- 📈 **Predictive Risk & Compliance Scoring**: Proactive detection of potential budget overruns, timeline slippages, and audit non-compliance risks before milestone deadlines.
