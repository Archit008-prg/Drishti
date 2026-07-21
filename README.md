# 🌟 Drishti: A Next-Gen Project Management & AI System

Welcome to **Drishti**! This is a high-end, centralized platform built to streamline project monitoring, intelligent AI-driven insights, and secure collaboration between Project Managers and Investigators. 

We completely overhauled the interface to feature a modern **Glassmorphism UI** and separated the architecture into a powerful decoupled full-stack application.

---

## ✨ What's New?

- 🎨 **Glassmorphism Aesthetic**: A sleek, dark-themed UI featuring frosted glass components, dynamic gradients, and smooth micro-animations. 
- 🤖 **Ekta AI (RAG Assistant)**: A highly intelligent, context-aware AI assistant built with HuggingFace (Mistral) and ChromaDB. Ekta can read project documents (PDF, DOCX) and answer precise questions, explain project rejections, and even converse natively in Indian languages (like Hindi and Tamil).
- 💬 **Live Chat & Teams**: Secure, real-time messaging between Managers and Investigators, complete with team grouping functionality.
- ☁️ **AWS EC2 Ready**: fully decoupled and optimized for deployment on AWS Ubuntu instances!

---

## 🏗️ The Tech Stack

We moved away from legacy setups and adopted a robust, modern decoupled stack:

- **Frontend**: React + Vite + TailwindCSS (for lightning-fast builds and stunning UI components)
- **Backend**: Python + Django REST Framework (for secure, scalable API architecture)
- **AI/ML Layer**: ChromaDB (Vector Database) + HuggingFace Inference API + SentenceTransformers
- **Database**: SQLite (built-in, easy to migrate)
- **Deployment**: AWS EC2 (Ubuntu Linux)

---

## 🚀 How to Run Locally

Because Drishti is a decoupled app, you need to run the backend and frontend separately. 

### 1. Start the Backend (Django)
Open a terminal and navigate to the `backend` folder:
```bash
cd backend
python -m venv venv
source venv/bin/activate      # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```
*The backend API will run on `http://localhost:8000`*

### 2. Start the Frontend (React/Vite)
Open a **new** terminal and navigate to the `frontend` folder:
```bash
cd frontend
npm install
npm run dev
```
*The gorgeous frontend will pop up at `http://localhost:5173`*

---

## ☁️ How to Deploy to AWS EC2 (Production)

Deploying to AWS means setting up your own bare-metal server. Here is the exact playbook to get Drishti live:

1. **Spin up an EC2 Instance**: Launch an Ubuntu server and open Ports `80` (HTTP) and `22` (SSH) in your Security Group.
2. **SSH into the Server**: Connect from your local terminal using your `.pem` key.
3. **Install Dependencies**: 
   `sudo apt update && sudo apt install python3-venv nodejs npm -y`
4. **Clone the Repo**: 
   `git clone https://github.com/Archit008-prg/Drishti.git`
5. **Run the Backend (Background)**:
   Navigate to the backend, install `requirements.txt`, apply migrations, and use `nohup` to keep it alive:
   `nohup python3 manage.py runserver 0.0.0.0:8000 &`
6. **Run the Frontend (Background)**:
   Navigate to the frontend, install npm packages, link it to your AWS Public IP, and start it on port 80:
   `echo "VITE_API_BASE_URL=http://<YOUR_AWS_IP>:8000" > .env.production`
   `sudo nohup npm run dev -- --host 0.0.0.0 --port 80 &`

That's it! Your site will be live at your public IP address.
