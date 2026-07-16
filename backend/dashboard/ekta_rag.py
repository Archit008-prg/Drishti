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
MIN_SCORE    = 0.30   # cosine distance threshold (lower = more similar in ChromaDB)


# ─── ChromaDB client (singleton) ───────────────────────────────────────────────
_chroma_client = None

def get_chroma_client():
    global _chroma_client
    if _chroma_client is None:
        CHROMA_PATH.mkdir(parents=True, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(path=str(CHROMA_PATH))
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
    Call HF feature-extraction endpoint.
    Returns a list of 384-dim float vectors (one per text).
    Retries once on 503 (model loading).
    """
    if not texts:
        return []

    payload = {"inputs": texts, "options": {"wait_for_model": True}}

    for attempt in range(3):
        try:
            resp = requests.post(EMBED_URL, headers=HF_HEADERS, json=payload, timeout=60)
            if resp.status_code == 503:
                logger.warning("HF embedding model loading, retrying in 10s…")
                time.sleep(10)
                continue
            resp.raise_for_status()
            result = resp.json()
            # The API returns either [[vec], [vec], ...] or [[[[vec]]]]
            # Flatten to list of 1-D vectors
            if isinstance(result[0][0], list):
                # sentence-transformers returns [[[384-dim]]] for single token
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
Drishti is a project management system designed for government research and scientific projects.

HOW TO LOG IN:
- Navigate to the Drishti login page. Enter your username and password.
- Managers (staff) log in at /manager/login/. Investigators log in at /investigator/login/.
- If you forgot your password, contact your system administrator.

HOW TO SUBMIT A REPORT (INVESTIGATOR):
- Log in to your investigator dashboard.
- Click on a running project in your task list.
- Go to the "Submit Report" section.
- Upload your report as a PDF file (only PDFs are accepted).
- Add any notes/comments about your submission.
- Click Submit. Your report will be sent to the manager for review.

HOW MANAGERS REVIEW REPORTS:
- Log in to the manager dashboard.
- Go to the "Reviews" tab.
- Click on a pending report to view it.
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

PROJECT STATUSES:
- Ongoing: Project has been assigned and is active.
- Pending / Up Next: Project is assigned but work has not started.
- Completed: Project has been approved and is done.

BUDGET DISPLAY:
- Budget values are shown in smart units: Cr (crores), L (lakhs), K (thousands), or ₹ (rupees).
- The unit is set by the manager when creating the project.

NOTIFICATIONS:
- Notifications appear in the bell icon on the top right of the dashboard.
- Notifications are sent for: report submitted, report approved, report rejected, resubmission requested.

CHAT FEATURE:
- Use the chat icon in the top bar to message your manager (investigators) or investigators (managers).
- Chats are private and project-independent.

PROJECT TIMELINE:
- The Project Timeline Canvas shows 4 stages: Task Initiated, Report Submitted, Under Review, Decision.
- The glowing dot shows the current active stage.
- Colors: Green = approved, Red = rejected, Amber = resubmission requested.

EKTA AI ASSISTANT:
- Ekta can only answer questions about project documents uploaded by managers or submitted by investigators.
- Ekta cannot answer questions outside of these documents or outside of Drishti system help.
- Ask Ekta questions like "What are the objectives of this project?" or "What did the report say about outcomes?"
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
    "This question is outside my scope for this project. "
    "I can only answer questions based on the documents uploaded for this project "
    "or questions about how to use Drishti. Please ask something related to the project materials."
)

SYSTEM_PROMPT = (
    "You are Ekta, the AI assistant for the Drishti project management system.\n"
    "Your job is to answer questions ONLY based on the document context provided below.\n"
    "If the context does not contain enough information to answer the question, "
    "respond exactly with: \"This question is outside my scope for this project.\"\n"
    "Do NOT use any outside knowledge. Be concise, professional, and helpful.\n"
    "Cite the document name when relevant.\n\n"
)


def _call_llm(prompt: str) -> str:
    """Call Mistral-7B-Instruct via HuggingFace Inference API."""
    payload = {
        "inputs": prompt,
        "parameters": {
            "max_new_tokens": 512,
            "temperature": 0.1,
            "return_full_text": False,
            "do_sample": False,
        },
        "options": {"wait_for_model": True, "use_cache": False}
    }

    for attempt in range(3):
        try:
            resp = requests.post(LLM_URL, headers=HF_HEADERS, json=payload, timeout=120)
            if resp.status_code == 503:
                logger.warning(f"LLM loading, waiting 15s (attempt {attempt+1})…")
                time.sleep(15)
                continue
            resp.raise_for_status()
            result = resp.json()
            if isinstance(result, list) and result:
                return result[0].get("generated_text", "").strip()
            return str(result)
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

    if best_score > (1.0 - MIN_SCORE):  # ChromaDB cosine distance: 0=identical, 2=opposite
        return {"answer": OUT_OF_SCOPE_RESPONSE, "sources": [], "in_scope": False}

    # Take top chunks above threshold
    relevant = [(d, m) for s, d, m in combined if s <= (1.0 - MIN_SCORE)][:TOP_K]

    context_parts = []
    sources = set()
    for doc, meta in relevant:
        doc_name = meta.get("doc_name", "Unknown Document")
        context_parts.append(f"[From: {doc_name}]\n{doc}")
        sources.add(doc_name)

    context = "\n\n---\n\n".join(context_parts)

    prompt = (
        f"<s>[INST] {SYSTEM_PROMPT}"
        f"CONTEXT:\n{context}\n\n"
        f"QUESTION: {question} [/INST]"
    )

    answer = _call_llm(prompt)

    # Check if LLM itself said out-of-scope
    in_scope = "outside my scope" not in answer.lower()

    return {
        "answer": answer,
        "sources": list(sources),
        "in_scope": in_scope
    }
