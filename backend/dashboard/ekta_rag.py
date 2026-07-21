"""
ekta_rag.py  —  Ekta RAG pipeline
───────────────────────────────────────────────────────────────────
All intelligence is via external APIs (no local model weights):
  • Embeddings  : HuggingFace Inference API  (all-MiniLM-L6-v2, 384-dim)
  • Generation  : HuggingFace Inference API  (Mistral-7B-Instruct-v0.3)
  • Vector DB   : ChromaDB (embedded, local disk)
"""

import os
import re
import time
import logging
import requests
from pathlib import Path
from huggingface_hub import InferenceClient
import os
os.environ["ANONYMIZED_TELEMETRY"] = "False"

import chromadb
from chromadb.config import Settings

logger = logging.getLogger(__name__)

# ─── Config ───────────────────────────────────────────────────────────────────
HF_API_TOKEN = os.environ.get("HF_API_TOKEN", "")
HF_HEADERS   = {"Authorization": f"Bearer {HF_API_TOKEN}"}

EMBED_URL = "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2"
LLM_URL   = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3"

CHROMA_PATH  = Path(__file__).resolve().parent.parent.parent / "chromadb_store"
CHUNK_SIZE   = 500   # characters per chunk
CHUNK_OVERLAP = 80
TOP_K        = 5
MIN_SCORE    = 0.15   # cosine distance threshold (lower = more similar in ChromaDB)


# ─── ChromaDB client (singleton) ───────────────────────────────────────────────
_chroma_client = None

def get_chroma_client():
    global _chroma_client
    if _chroma_client is None:
        CHROMA_PATH.mkdir(parents=True, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(
            path=str(CHROMA_PATH),
            settings=Settings(anonymized_telemetry=False)
        )
    return _chroma_client


def _collection_name(project_id: int) -> str:
    return f"project_{project_id}"


def _system_collection_name() -> str:
    return "ekta_system_help"


# ─── Text chunking ────────────────────────────────────────────────────────────
def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks by character count."""
    text = re.sub(r'\s+', ' ', text).strip()
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk.strip())
        start += chunk_size - overlap
    return chunks


# ─── HuggingFace Embedding API ────────────────────────────────────────────────
def get_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Call HF feature-extraction endpoint via InferenceClient.
    Returns a list of 384-dim float vectors (one per text).
    """
    if not texts:
        return []

    client = InferenceClient(token=HF_API_TOKEN)
    for attempt in range(3):
        try:
            result = client.feature_extraction(texts, model="sentence-transformers/all-MiniLM-L6-v2")
            if hasattr(result, "tolist"):
                result = result.tolist()
            if isinstance(result, list) and isinstance(result[0], list) and isinstance(result[0][0], list):
                result = [r[0] for r in result]
            return result
        except Exception as e:
            logger.error(f"Embedding attempt {attempt+1} failed: {e}")
            time.sleep(5)

    raise RuntimeError("HuggingFace embedding API failed after retries")


# ─── Index a document into ChromaDB ──────────────────────────────────────────
def index_document(doc_id: int, project_id: int, text: str, doc_name: str):
    """
    Chunk text → embed → upsert into project's ChromaDB collection.
    doc_id is used as a namespace prefix so chunks from one doc can be deleted cleanly.
    """
    chunks = chunk_text(text)
    if not chunks:
        logger.warning(f"No chunks extracted from doc {doc_id}")
        return 0

    embeddings = get_embeddings(chunks)
    if len(embeddings) != len(chunks):
        raise RuntimeError("Embedding count mismatch")

    client = get_chroma_client()
    col    = client.get_or_create_collection(
        name=_collection_name(project_id),
        metadata={"hnsw:space": "cosine"}
    )

    ids        = [f"doc{doc_id}_chunk{i}" for i in range(len(chunks))]
    metadatas  = [{"doc_id": doc_id, "doc_name": doc_name, "chunk_idx": i} for i in range(len(chunks))]

    col.upsert(ids=ids, embeddings=embeddings, documents=chunks, metadatas=metadatas)
    logger.info(f"Indexed {len(chunks)} chunks for doc {doc_id} in project {project_id}")
    return len(chunks)


def delete_document(doc_id: int, project_id: int):
    """Remove all chunks belonging to a specific document from ChromaDB."""
    client = get_chroma_client()
    try:
        col = client.get_collection(_collection_name(project_id))
        col.delete(where={"doc_id": doc_id})
        logger.info(f"Deleted doc {doc_id} chunks from project {project_id}")
    except Exception as e:
        logger.warning(f"Could not delete doc {doc_id}: {e}")


# ─── System help knowledge base ───────────────────────────────────────────────
SYSTEM_HELP_TEXT = """
Drishti is a high-end, secure project management system designed for government research and scientific projects, featuring a glassmorphism UI aesthetic.

ACCOUNT CREATION & SIGN UP:
- To create an account, navigate to the Drishti Signup page.
- Enter a unique username, your email address, and a secure password.
- You will be asked to select your role: either Manager (Staff) or Investigator.
- If you sign up as an Investigator with an email address that a Manager has already assigned a project to, those projects will automatically be claimed and added to your dashboard.

ROLES:
- Managers (Principal Coordinators) oversee projects, assign tasks to investigators, and review submitted reports.
- Investigators (Principal Investigators) receive project assignments, conduct the tasks, and submit compliance reports.

HOW TO LOG IN:
- Navigate to the Drishti login page. Enter your username and password.
- Managers (staff) log in at /manager/login/. Investigators log in at /investigator/login/.
- If you forgot your password, contact your system administrator.

SIDEBAR FEATURES & NAVIGATION:
- Running Tasks: Projects currently active and assigned.
- Upcoming Tasks: Projects assigned but work has not formally started.
- Completed Tasks / Past Tasks: Projects that have been fully approved and closed.
- Alerts Feed: Real-time notifications for report submissions, approvals, or rejections.
- Live Chats: Secure, project-independent direct messaging between Managers and Investigators.
- Ekta AI: Your personal RAG Assistant for querying project documents or Drishti system help.
- Encrypted Desk: A secure environment for tracking live workspace actions and securely handling files.

HOW TO SUBMIT A REPORT (INVESTIGATOR):
- Log in to your investigator dashboard.
- Click on a running project in your task list to open the Project Details panel.
- Go to the "Submit Report" section.
- Upload your report as a PDF file (only PDFs are accepted).
- Add any notes/comments about your submission.
- Click Submit. Your report will be sent to the manager for review.

HOW MANAGERS REVIEW REPORTS:
- Log in to the manager dashboard.
- Go to the "Reviews" tab or click on a project that has a submitted report.
- You can Approve, Reject, or Request Resubmission.
- Add comments to explain your decision. The investigator will be notified automatically.

WHAT HAPPENS AFTER APPROVAL:
- When a manager approves a report, the project automatically moves to "Completed" status.
- The investigator receives a notification of the approval.
- The project appears in the "Past / Completed Tasks" section.

WHAT HAPPENS AFTER REJECTION OR RESUBMISSION REQUEST:
- If rejected or resubmission requested, the investigator is notified.
- The investigator can re-upload the report from their dashboard.
- The project remains in "Running" status until the report is approved.

PROJECT TIMELINE CANVAS:
- The Project Timeline Canvas visually tracks a project through 4 stages: Task Initiated, Report Submitted, Under Review, and Decision.
- The glowing dot shows the current active stage.
- A glowing line connects completed stages, while uncompleted stages remain dim.
- Colors on the final node: Green = approved, Red = rejected, Amber = resubmission requested.

BUDGET DISPLAY:
- Budget values are shown in smart units: Cr (crores), L (lakhs), K (thousands), or ₹ (rupees).
- The unit is set by the manager when creating the project.

EKTA AI ASSISTANT:
- Ekta (me) is an AI RAG Assistant integrated directly into Drishti.
- If you select a project from the context dropdown, I can answer highly specific questions based ONLY on the documents uploaded for that project.
- If no project is selected, I can act as a System Assistant and answer general questions about how to use Drishti, create accounts, or navigate the UI.
"""

def load_system_help_kb():
    """Index the static Drishti system help text into ChromaDB on first run."""
    client = get_chroma_client()
    col_name = _system_collection_name()

    # Check if already indexed
    try:
        col = client.get_collection(col_name)
        if col.count() > 0:
            logger.info("System help KB already indexed, skipping.")
            return
    except Exception:
        pass

    col = client.get_or_create_collection(
        name=col_name,
        metadata={"hnsw:space": "cosine"}
    )

    chunks     = chunk_text(SYSTEM_HELP_TEXT, chunk_size=400, overlap=60)
    embeddings = get_embeddings(chunks)
    ids        = [f"help_chunk_{i}" for i in range(len(chunks))]
    metadatas  = [{"doc_name": "Drishti System Help", "doc_id": 0, "chunk_idx": i} for i in range(len(chunks))]

    col.upsert(ids=ids, embeddings=embeddings, documents=chunks, metadatas=metadatas)
    logger.info(f"System help KB indexed: {len(chunks)} chunks")


# ─── RAG Query ────────────────────────────────────────────────────────────────
OUT_OF_SCOPE_RESPONSE = (
    "I'm sorry, but it seems that your question is unrelated to the documents uploaded for this project. "
    "I'm here to help you derive context and insights from the project materials. "
    "Could you please ask a question specifically related to the provided documents?"
)

SYSTEM_PROMPT = (
    "You are Ekta, a highly intelligent and flexible AI assistant for the Drishti project management system.\n"
    "Your primary job is to answer questions related to the provided project documents, the manager's report denial reasons, steps to improve, and Drishti system-related issues.\n"
    "CRITICAL INSTRUCTION 1: You must refer to the provided document context and project metadata to answer the user's questions. If the user asks general questions about the project (e.g., 'explain about this project'), summarize the provided documents and metadata.\n"
    "CRITICAL INSTRUCTION 2: You MUST STRICTLY AVOID answering out-of-track, irrelevant questions (e.g., general sports, politics, science) UNLESS they are directly related to the provided documents. If a question is entirely irrelevant, politely decline to answer. However, apply genuine flexibility: if a question seems general but can be reasonably connected to the project's domain, answer it intelligently based on the context.\n"
    "CRITICAL INSTRUCTION 3: If asked to evaluate rejections or mismatches, actively cross-reference the documents and the manager's rejection comment. Explain the rejection clearly and provide actionable steps to improve the report.\n"
    "CRITICAL INSTRUCTION 4: You MUST natively understand and respond to Indian languages (such as Hindi, Kannada, Tamil, Bengali, etc.), EVEN IF they are written in English script (transliteration/Hinglish) or their native scripts. Read the English context documents and reply in the same language and script style the user asked in. Do NOT refuse to translate.\n"
    "CRITICAL INSTRUCTION 5: DO NOT HALLUCINATE facts outside the provided documents for project-specific queries.\n"
)


def _call_llm(messages: list[dict]) -> str:
    """Call Llama-3.1-8B-Instruct via HuggingFace InferenceClient."""
    client = InferenceClient(token=HF_API_TOKEN)
    
    for attempt in range(3):
        try:
            response = client.chat_completion(
                messages=messages,
                model="meta-llama/Llama-3.1-8B-Instruct",
                max_tokens=512,
                temperature=0.1
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"LLM call attempt {attempt+1} failed: {e}")
            time.sleep(5)

    return OUT_OF_SCOPE_RESPONSE


def query_ekta(question: str, project_id: int | None = None) -> dict:
    """
    Main entry point.
    1. Embed question
    2. Search ChromaDB (project collection + system help)
    3. If good chunks found → call LLM with strict prompt
    4. Else → return out-of-scope

    Returns: { "answer": str, "sources": [str], "in_scope": bool }
    """
    if not question or not question.strip():
        return {"answer": "Please ask a question.", "sources": [], "in_scope": True}

    q_embedding = get_embeddings([question])[0]

    # Collect candidate chunks from project + system help
    all_docs   = []
    all_meta   = []
    all_scores = []

    client = get_chroma_client()

    # Query project collection (if project_id given and collection exists)
    if project_id is not None:
        try:
            proj_col = client.get_collection(_collection_name(project_id))
            if proj_col.count() > 0:
                res = proj_col.query(
                    query_embeddings=[q_embedding],
                    n_results=min(TOP_K, proj_col.count()),
                    include=["documents", "metadatas", "distances"]
                )
                for doc, meta, dist in zip(
                    res["documents"][0], res["metadatas"][0], res["distances"][0]
                ):
                    all_docs.append(doc)
                    all_meta.append(meta)
                    all_scores.append(dist)
        except Exception as e:
            logger.warning(f"Project collection query failed: {e}")

    # Query system help
    try:
        help_col = client.get_collection(_system_collection_name())
        if help_col.count() > 0:
            res = help_col.query(
                query_embeddings=[q_embedding],
                n_results=min(3, help_col.count()),
                include=["documents", "metadatas", "distances"]
            )
            for doc, meta, dist in zip(
                res["documents"][0], res["metadatas"][0], res["distances"][0]
            ):
                all_docs.append(doc)
                all_meta.append(meta)
                all_scores.append(dist)
    except Exception as e:
        logger.warning(f"System help query failed: {e}")

    if not all_docs:
        return {"answer": OUT_OF_SCOPE_RESPONSE, "sources": [], "in_scope": False}

    # Sort by score (lower distance = more similar)
    combined = sorted(zip(all_scores, all_docs, all_meta), key=lambda x: x[0])
    best_score = combined[0][0]

    # Let the LLM decide if the context is sufficient, as strict vector distance might block generic questions like "explain this project".
    relevant = [(d, m) for s, d, m in combined][:TOP_K]

    context_parts = []
    sources = set()
    for doc, meta in relevant:
        doc_name = meta.get("doc_name", "Unknown Document")
        context_parts.append(f"[From: {doc_name}]\n{doc}")
        sources.add(doc_name)

    context = "\n\n---\n\n".join(context_parts)
    
    # Inject project and report status metadata
    project_metadata = ""
    if project_id is not None:
        try:
            from .models import Project
            proj = Project.objects.get(id=project_id)
            latest_report = proj.project_reports.first()
            status_text = f"Project Status: {proj.get_status_display()}\n"
            if latest_report:
                status_text += f"Report Status: {latest_report.get_status_display()}\n"
                if latest_report.status in ['rejected', 'resubmit_requested'] and latest_report.admin_comment:
                    status_text += f"Manager Rejection Comment: {latest_report.admin_comment}\n"
            project_metadata = f"\n\n[PROJECT METADATA]\n{status_text}\n(If the user asks why their report was rejected, explain based on the manager's comment. If no comment is given, analyze the report and manager's provided documents to hypothesize why it might have been rejected and help them improve.)\n"
        except Exception as e:
            logger.warning(f"Could not load project metadata for Ekta: {e}")

    user_message = f"CONTEXT:\n{context}{project_metadata}\n\nQUESTION: {question}"
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message}
    ]

    answer = _call_llm(messages)

    # Check if LLM itself said out-of-scope
    in_scope = "unrelated" not in answer.lower() and "unable to answer" not in answer.lower()

    return {
        "answer": answer,
        "sources": list(sources),
        "in_scope": in_scope
    }
