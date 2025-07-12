# Drishti: A Real-Time Project Monitoring System

**A Django-based centralized monitoring platform for CMPDI projects, enabling streamlined communication, intelligent tracking, and timely decision-making throughout the project lifecycle.**

---

## 🚀 Overview

**Drishti** is a full-stack web application developed to facilitate **real-time monitoring and management of projects** undertaken by CMPDI (Central Mine Planning and Design Institute). It bridges the gap between project administrators and investigators, ensuring that progress is tracked effectively, submissions are evaluated intelligently, and delays are mitigated early on.

Whether it's assigning new projects, tracking deliverables, or validating final submissions using AI — **Drishti** aims to be a single source of truth and collaboration for all stakeholders involved in the lifecycle of a project.

---

## 📌 Key Features

- 🛠️ **Admin Interface**
  - Assign projects to investigators.
  - Set deadlines, deliverables, funding, and guidelines.
  - Send automated notifications.

- 📤 **Investigator Dashboard**
  - View assigned projects and timelines.
  - Submit reports and utilization/audit statements.
  - Request raw material replacement and project clarifications.

- 🤖 **Smart Validation Engine**
  - AI-powered checks to ensure submitted documents align with guidelines and timelines.
  - Final submission evaluation system.

- 📬 **Notification System**
  - Email alerts for project assignments, deadlines, submission acknowledgments, and rejections.

- 📈 **Progress Tracking**
  - Visual status tracking of each project phase.

---

## 🧱 Tech Stack

| Layer        | Technologies Used                                  |
|--------------|----------------------------------------------------|
| Backend      | Python, Django, SQLite                             |
| Frontend     | HTML, CSS, JavaScript, Bootstrap                   |
| AI Layer     | Scikit-learn, custom rule-based models             |
| Notification | Django Email backend (SMTP)                        |

---

## 🔧 Installation & Setup

### Prerequisites

- Python 3.8+
- pip
- virtualenv (recommended)
- Git

### Steps

```bash
# Clone the repository
git clone https://github.com/Archit008-prg/Drishti.git
cd drishti

# Create a virtual environment
python -m venv myenv
source venv/bin/activate    # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r req.txt

# Apply migrations
python manage.py makemigrations
python manage.py migrate

# Create a superuser for admin access
python manage.py createsuperuser

# Run the development server
python manage.py runserver
