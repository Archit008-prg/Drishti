"""
ekta_rag.py  —  Ekta Context-Aware RAG Engine
────────────────────────────────────────────────────────────────────────
Features:
  • Embeddings  : Local ChromaDB ONNX all-MiniLM-L6-v2 (fast, offline, no credits required)
  • Vector DB   : ChromaDB (embedded, local disk store)
  • Generation  : Multi-tiered routing (Gemini -> Groq -> HuggingFace -> Smart Targeted Local Synthesizer)
  • Precision   : Answers strictly the question asked; role, budget, timeline, technical or out-of-scope!
"""

from __future__ import annotations

import os
import re
import time
import logging
import threading
import requests
from pathlib import Path

# Disable ChromaDB Telemetry globally
os.environ["ANONYMIZED_TELEMETRY"] = "False"

import chromadb
from chromadb.config import Settings
import chromadb.utils.embedding_functions as ef

logger = logging.getLogger(__name__)

CHROMA_PATH   = Path(__file__).resolve().parent.parent.parent / "chromadb_store"
CHUNK_SIZE    = 500
CHUNK_OVERLAP = 80
TOP_K         = 5

# ─── API Token Helpers ────────────────────────────────────────────────────────
def _load_env_if_needed():
    try:
        from dotenv import load_dotenv
        env_path = Path(__file__).resolve().parent.parent.parent / ".env"
        if env_path.exists():
            load_dotenv(env_path)
    except Exception:
        pass

def get_hf_token() -> str:
    _load_env_if_needed()
    return os.environ.get("HF_API_TOKEN", "")

def get_gemini_key() -> str:
    _load_env_if_needed()
    return os.environ.get("GEMINI_API_KEY", "") or os.environ.get("GOOGLE_API_KEY", "")

def get_groq_key() -> str:
    _load_env_if_needed()
    return os.environ.get("GROQ_API_KEY", "")


# ─── ChromaDB Client & Embedding Function ─────────────────────────────────────
_chroma_client = None
_embedding_fn = None
_chroma_lock = threading.Lock()

def get_chroma_client():
    global _chroma_client
    with _chroma_lock:
        if _chroma_client is None:
            CHROMA_PATH.mkdir(parents=True, exist_ok=True)
            _chroma_client = chromadb.PersistentClient(
                path=str(CHROMA_PATH),
                settings=Settings(anonymized_telemetry=False)
            )
        return _chroma_client

def get_embedding_function():
    global _embedding_fn
    if _embedding_fn is None:
        _embedding_fn = ef.DefaultEmbeddingFunction()
    return _embedding_fn

def _collection_name(project_id: int) -> str:
    return f"project_{project_id}"

def _system_collection_name() -> str:
    return "ekta_system_help"


# ─── Text Chunking ────────────────────────────────────────────────────────────
def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
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


# ─── Embedding Generation ─────────────────────────────────────────────────────
def get_embeddings(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    try:
        fn = get_embedding_function()
        res = fn(texts)
        return [[float(x) for x in vec] for vec in res]
    except Exception as e:
        logger.error(f"Local embedding failed: {e}")
        return [[0.0] * 384 for _ in texts]


# ─── Indexing ─────────────────────────────────────────────────────────────────
def index_document(doc_id: int, project_id: int, text: str, doc_name: str) -> int:
    chunks = chunk_text(text)
    if not chunks:
        logger.warning(f"No chunks extracted from doc {doc_id}")
        return 0

    embeddings = get_embeddings(chunks)
    client = get_chroma_client()
    col = client.get_or_create_collection(
        name=_collection_name(project_id),
        metadata={"hnsw:space": "cosine"}
    )

    ids = [f"doc{doc_id}_chunk{i}" for i in range(len(chunks))]
    metadatas = [{"doc_id": doc_id, "doc_name": doc_name, "chunk_idx": i} for i in range(len(chunks))]

    col.upsert(ids=ids, embeddings=embeddings, documents=chunks, metadatas=metadatas)
    logger.info(f"Indexed {len(chunks)} chunks for doc {doc_id} in project {project_id}")
    return len(chunks)


def delete_document(doc_id: int, project_id: int):
    client = get_chroma_client()
    try:
        col = client.get_collection(_collection_name(project_id))
        col.delete(where={"doc_id": doc_id})
        logger.info(f"Deleted doc {doc_id} chunks from project {project_id}")
    except Exception as e:
        logger.warning(f"Could not delete doc {doc_id}: {e}")


def load_system_help_kb():
    """No-op stub for compatibility with apps.py."""
    pass
OUT_OF_SCOPE_RESPONSE = (
    "I'm sorry, but this question is out of scope. "
    "As Ekta AI, I can only assist with inquiries directly related to this project, "
    "its uploaded reference documents, technical guidelines, budget, deliverables, and Drishti system operations."
)

IRRELEVANT_PATTERNS = [
    r"\b(cricket|football|fifa|ipl|world cup|score|match)\b",
    r"\b(movie|cinema|actor|actress|bollywood|hollywood|song)\b",
    r"\b(recipe|cook|pasta|cake|biryani|dish|food|pizza)\b",
    r"\b(weather|temperature|forecast|rain|climate today)\b",
    r"\b(president of|prime minister of|politics|election|party vote)\b",
    r"\b(joke|riddle|poem|love story|horoscope|zodiac)\b",
    r"\b(bitcoin price|crypto market|stock price of)\b"
]

def is_query_irrelevant(q: str) -> bool:
    q_low = q.lower()
    for pat in IRRELEVANT_PATTERNS:
        if re.search(pat, q_low):
            return True
    return False


# ─── Multi-Provider LLM Caller ────────────────────────────────────────────────
def _call_external_llm(messages: list[dict]) -> str | None:
    # 1. Try Google Gemini
    gemini_key = get_gemini_key()
    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            full_prompt = "\n\n".join([f"{m['role'].upper()}: {m['content']}" for m in messages])
            resp = model.generate_content(full_prompt)
            if resp and resp.text and resp.text.strip():
                return resp.text.strip()
        except Exception as e:
            logger.warning(f"Gemini LLM call failed: {e}")

    # 2. Try Groq API
    groq_key = get_groq_key()
    if groq_key:
        try:
            r = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": messages,
                    "max_tokens": 600,
                    "temperature": 0.1
                },
                timeout=10
            )
            if r.status_code == 200:
                data = r.json()
                content = data["choices"][0]["message"]["content"]
                if content and content.strip():
                    return content.strip()
        except Exception as e:
            logger.warning(f"Groq LLM call failed: {e}")

    # 3. Try HuggingFace Inference API (HF_API_TOKEN in .env)
    hf_token = get_hf_token()
    if hf_token:
        # Try Hugging Face Router Chat Endpoint
        try:
            r = requests.post(
                "https://router.huggingface.co/hf-inference/v1/chat/completions",
                headers={"Authorization": f"Bearer {hf_token}", "Content-Type": "application/json"},
                json={
                    "model": "meta-llama/Llama-3.2-3B-Instruct",
                    "messages": messages,
                    "max_tokens": 500,
                    "temperature": 0.2
                },
                timeout=12
            )
            if r.status_code == 200:
                data = r.json()
                content = data["choices"][0]["message"]["content"]
                if content and content.strip():
                    return content.strip()
        except Exception as e:
            logger.debug(f"HF Router LLM call notice: {e}")

        # Fallback Hugging Face standard endpoint
        try:
            prompt = "\n\n".join([f"[{m['role'].upper()}]: {m['content']}" for m in messages]) + "\n\n[ASSISTANT]:"
            r = requests.post(
                "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3",
                headers={"Authorization": f"Bearer {hf_token}", "Content-Type": "application/json"},
                json={"inputs": prompt, "parameters": {"max_new_tokens": 400, "temperature": 0.2}},
                timeout=12
            )
            if r.status_code == 200:
                data = r.json()
                if isinstance(data, list) and len(data) > 0 and "generated_text" in data[0]:
                    gen_text = data[0]["generated_text"]
                    if "[ASSISTANT]:" in gen_text:
                        gen_text = gen_text.split("[ASSISTANT]:")[-1]
                    if gen_text.strip():
                        return gen_text.strip()
        except Exception as e:
            logger.debug(f"HF standard endpoint call notice: {e}")

    return None


# ─── Precision Local Synthesizer ──────────────────────────────────────────────
def _synthesize_local_response(
    question: str,
    project_metadata: dict | None,
    candidate_chunks: list[tuple[str, dict, float]],  # (doc_text, metadata, distance)
    sources: list[str],
    user_role: str = "Principal Investigator",
    username: str = ""
) -> tuple[str, bool]:
    """
    Precision RAG response generator.
    Directly answers WHAT THE USER ASKED instead of dumping generic project overviews.
    Returns: (answer_string, in_scope_bool)
    """
    q_low = question.lower().strip()
    is_hindi = any(word in q_low for word in ["kya", "kaise", "samjhao", "batao", "hai", "karein", "bhai", "bata", "mera", "meri"])

    # 1. Immediate rejection for recognized irrelevant topics
    if is_query_irrelevant(q_low):
        return OUT_OF_SCOPE_RESPONSE, False

    clean_sources = [os.path.basename(s) for s in sources] if sources else []
    primary_doc = clean_sources[0] if clean_sources else "Project Document"
    all_docs_str = ", ".join(clean_sources) if clean_sources else "None"
    title = project_metadata.get("title", "") if project_metadata else ""
    code = project_metadata.get("code", "") if project_metadata else ""
    agency = project_metadata.get("agency", "") if project_metadata else ""
    budget = project_metadata.get("budget", "") if project_metadata else ""
    status = project_metadata.get("status", "") if project_metadata else ""
    description = project_metadata.get("description", "") if project_metadata else ""
    rejection_comment = project_metadata.get("rejection_comment", "") if project_metadata else ""
    start_date = project_metadata.get("start_date", "") if project_metadata else ""
    completion_date = project_metadata.get("completion_date", "") if project_metadata else ""

    # Calculate best distance score from vector store
    min_dist = min([c[2] for c in candidate_chunks]) if candidate_chunks else 1.0
    valid_chunks = [c for c in candidate_chunks if c[2] <= 0.65]

    # Clean sentence extractor
    all_chunks_text = "\n\n".join([c[0] for c in candidate_chunks[:3]]) if candidate_chunks else ""
    raw_sentences = [s.strip() for s in re.split(r'[.\n]+', all_chunks_text) if len(s.strip()) > 35]

    # ── INTENT 0: GREETINGS & CAPABILITY INQUIRY ────────────────────────────────
    if q_low in ["hi", "hello", "hey", "namaste", "greetings", "hii", "helo"] or any(k in q_low for k in ["who are you", "what can you do", "help me", "kya kar sakte ho"]):
        role_label = "Principal Investigator" if "investigator" in user_role.lower() else "Manager"
        greeting = f"👋 **Hello {username or ''}! I am Ekta AI, your intelligent assistant for Drishti.**\n\n"
        if title:
            greeting += f"I am connected to project **{title}** (`{code}`). Here is how I can assist you as **{role_label}**:\n\n"
            greeting += f"• 📄 **Uploaded Documents:** Ask *\"Explain what the manager uploaded for my reference\"* to get a summary of `{primary_doc}`.\n"
            greeting += f"• 👤 **Your Role & Duties:** Ask *\"Explain my role in this project\"* for your key milestone deliverables.\n"
            greeting += f"• 🔬 **Technical Guidance:** Ask specific questions about algorithms, architectures, or methodologies from the uploaded PDF.\n"
            greeting += f"• 💰 **Budget & Deadlines:** Ask about allocated funding or milestone schedule.\n"
        else:
            greeting += "Please select a project from the context dropdown to explore its uploaded documents and specifications.\n"
        return greeting, True

    # ── INTENT 1: UPLOADED REFERENCE DOCUMENTS & MANAGER MATERIALS ──────────────
    # Matches queries asking about uploaded docs, reference PDFs, files, or manager-shared materials
    is_doc_or_upload_query = (
        any(k in q_low for k in ["upload", "uplod", "reference", "refe", "document", "doc", "pdf", "file", "attachment", "material"]) or
        ("manager" in q_low and any(k in q_low for k in ["upload", "uplod", "give", "gave", "share", "shared", "sent", "send", "put", "provid", "attach", "guid", "instruct", "detail", "note", "say", "said"]))
    )

    if is_doc_or_upload_query:
        if not candidate_chunks:
            msg = f"📌 **No reference document has been uploaded for this project yet.**\n\n"
            msg += f"Official project details provided by the Manager:\n"
            msg += f"• **Project Title:** {title} (`{code}`)\n"
            msg += f"• **Principal Agency:** {agency} | **Budget:** {budget}\n"
            msg += f"• **Current Status:** {status}\n"
            if description and description.upper() != "NA":
                msg += f"• **Manager Directives:** {description}\n"
            return msg, True

        doc_summary = ""
        if raw_sentences:
            doc_summary = "\n".join([f"• {s}." if not s.endswith('.') else f"• {s}" for s in raw_sentences[:2]])

        msg = f"📄 **Uploaded Reference Material for {title} ({code}):**\n\n"
        msg += f"• **Available Reference Documents:** `{all_docs_str}`\n"
        msg += f"• **Knowledge Base Index:** Successfully indexed into vector store ({len(candidate_chunks)} contextual segments available).\n"
        if doc_summary:
            msg += f"• **Document Technical Summary:**\n{doc_summary}\n\n"

        msg += f"📋 **Manager's Project Specifications:**\n"
        msg += f"• **Funding Agency:** {agency}\n"
        msg += f"• **Allocated Budget:** {budget}\n"
        msg += f"• **Operational Stage:** {status}\n"
        if description and description.upper() != "NA":
            msg += f"• **Manager Notes:** {description}\n"
        
        msg += f"\n💡 **Next Step for Investigator:** Review the technical methodologies in the uploaded reference materials to guide your research and prepare your milestone PDF report for audit submission."
        return msg, True

    # ── INTENT 2: ROLE & RESPONSIBILITY ─────────────────────────────────────────
    if any(k in q_low for k in [
        "role", "responsibility", "responsibilities", "my task", "my job",
        "what should i do", "what do i do", "mera role", "mera kaam", "who am i",
        "what is my role", "explain my role"
    ]):
        role_name = "Principal Investigator (PI)" if "investigator" in user_role.lower() else "Manager (Project Coordinator)"
        
        # Extract technical domain focus from the project document
        domain_scope = ""
        if raw_sentences:
            domain_scope = raw_sentences[0]
            if not domain_scope.endswith('.'):
                domain_scope += '.'
        elif description and description.upper() != "NA":
            domain_scope = description

        if is_hindi:
            msg = f"👤 **इस प्रोजेक्ट में आपकी भूमिका: {role_name}**\n\n"
            msg += f"• **प्रोजेक्ट का विवरण:** {title} ({code}) — {agency}\n"
            if domain_scope:
                msg += f"• **तकनीकी शोध क्षेत्र:** {domain_scope}\n"
            msg += f"• **Drishti पोर्टल पर आपकी मुख्य जिम्मेदारियाँ:**\n"
            if "investigator" in user_role.lower():
                msg += f"  1. **शोध एवं विकास:** तकनीकी विनिर्देशों के अनुसार शोध कार्य संपन्न करना।\n"
                msg += f"  2. **प्रगति रिपोर्ट जमा करना:** Drishti पोर्टल पर निर्धारित समयसीमा में औपचारिक PDF रिपोर्ट अपलोड करना।\n"
                msg += f"  3. **बजट अनुपालन:** आवंटित बजट ({budget}) की सीमा के भीतर कार्य करना।\n"
                if rejection_comment:
                    msg += f"  4. **मैनेजर फीडबैक समाधान:** हालिया समीक्षा टिप्पणी को ठीक करना: \"{rejection_comment}\"।\n"
            else:
                msg += f"  1. **प्रोजेक्ट निगरानी:** शोधकर्ताओं की प्रगति और मील के पत्थर ट्रैक करना।\n"
                msg += f"  2. **रिपोर्ट ऑडिट:** सबमिट की गई PDF रिपोर्ट की समीक्षा व अनुमोदन करना।\n"
                msg += f"  3. **बजट वितरण:** मील के पत्थरों के आधार पर फंड निर्गमन नियंत्रित करना।\n"
            return msg, True

        msg = f"👤 **Your Role in this Project: {role_name}**\n\n"
        msg += f"• **Project Context:** Designated to **{title}** (`{code}`) under **{agency}**.\n"
        if domain_scope:
            msg += f"• **Technical Domain Scope:** {domain_scope}\n"
        msg += f"• **Core Responsibilities in Drishti:**\n"
        if "investigator" in user_role.lower():
            msg += f"  1. **Research & Development:** Lead investigation and implementation aligned with project specifications.\n"
            msg += f"  2. **Milestone PDF Reporting:** Prepare and submit verified compliance reports through your dashboard for manager audit.\n"
            msg += f"  3. **Financial & Schedule Governance:** Adhere strictly to the allocated funding limit of **{budget}** and completion deadlines.\n"
            if rejection_comment:
                msg += f"  4. **Audit Action Item:** Address active manager feedback: *\"{rejection_comment}\"* before resubmitting.\n"
        else:
            msg += f"  1. **Project Oversight:** Monitor technical progress and deliverable adherence across assigned investigators.\n"
            msg += f"  2. **Milestone Review & Audit:** Review, approve, or request revisions on submitted technical PDF reports.\n"
            msg += f"  3. **Financial Governance:** Oversee budget disbursement against verified project milestones (**{budget}**).\n"
        return msg, True

    # ── INTENT 3: BUDGET & FINANCIALS ───────────────────────────────────────────
    if any(k in q_low for k in ["budget", "cost", "funds", "funding", "how much money", "financial", "allocated money", "paisa", "kharcha"]):
        msg = f"💰 **Budget Allocation for {title} ({code}):**\n\n"
        msg += f"• **Total Allocated Funding:** **{budget}**\n"
        msg += f"• **Funding Agency:** {agency}\n"
        msg += f"• **Current Operational Status:** {status}\n"
        return msg, True

    # ── INTENT 4: TIMELINE & DEADLINES ──────────────────────────────────────────
    if any(k in q_low for k in ["timeline", "deadline", "date", "submission date", "schedule", "completion", "when to submit", "kab"]):
        msg = f"📅 **Project Timeline & Milestones:**\n\n"
        msg += f"• **Project Code:** {code}\n"
        msg += f"• **Commencement Date:** {start_date or 'Not specified'}\n"
        msg += f"• **Scheduled Completion:** {completion_date or 'Not specified'}\n"
        msg += f"• **Current Stage:** {status}\n"
        return msg, True

    # ── INTENT 5: REJECTION / AUDIT COMMENTS ─────────────────────────────────────
    if any(k in q_low for k in ["reject", "rejected", "rejection", "feedback", "resubmit", "audit", "comment", "why was my report", "manager review"]):
        if rejection_comment:
            msg = f"⚠️ **Manager Audit Feedback for {title}:**\n\n"
            msg += f"• **Current Stage:** {status}\n"
            msg += f"• **Manager Review Observation:** \"{rejection_comment}\"\n\n"
            msg += f"**Action Required:** Please revise your report addressing the observation above and re-upload via the Submit Report panel."
            return msg, True
        else:
            return f"There are currently no rejection observations or audit flags for this project. Status: **{status}**.", True

    # ── INTENT 6: GENERAL OVERVIEW / PROJECT SCOPE ──────────────────────────────
    is_overview_query = any(phrase in q_low for phrase in [
        "what is this project", "explain this project", "project overview", "overview of the project",
        "project summary", "summarize the project", "project ke bare me samjhao", "what is this document about",
        "overview of this document", "document overview", "tell me about this project", "summary of this project",
        "scope of the project", "what are we doing", "what is the goal", "aim of the project"
    ])

    if is_overview_query:
        if not candidate_chunks:
            msg = f"📌 **No reference document has been uploaded for this project yet.**\n\n"
            msg += f"Official project parameters provided by the Project Manager:\n"
            msg += f"• **Project Title:** {title} (`{code}`)\n"
            msg += f"• **Principal Agency:** {agency}\n"
            msg += f"• **Allocated Budget:** {budget}\n"
            msg += f"• **Operational Status:** {status}\n"
            if description and description.upper() != "NA":
                msg += f"• **Manager Notes:** {description}\n"
            return msg, True

        msg = f"📄 **Project Overview (from {primary_doc}):**\n\n"
        if raw_sentences:
            msg += f"{raw_sentences[0]}.\n\n"
        msg += f"📋 **Project Parameters:**\n"
        msg += f"• **Title & Code:** {title} (`{code}`)\n"
        msg += f"• **Principal Agency:** {agency} | **Budget:** {budget}\n"
        msg += f"• **Current Status:** {status}\n"
        if len(raw_sentences) > 1:
            msg += f"\n💡 **Key Technical Highlights:**\n"
            for s in raw_sentences[1:4]:
                s_clean = s.strip()
                if not s_clean.endswith('.'):
                    s_clean += '.'
                msg += f"• {s_clean}\n"
        return msg, True

    # ── INTENT 7: SPECIFIC TECHNICAL QUESTIONS FROM DOCUMENT ────────────────────
    # Only answer technical questions if vector distance proves genuine document relevance (<= 0.65)
    if valid_chunks:
        matched = []
        q_words = set(re.findall(r'\w+', q_low)) - {
            "what", "is", "the", "in", "this", "about", "how", "does", "do",
            "for", "and", "to", "explain", "tell", "me", "a", "an", "of", "on", "with"
        }
        
        for s in raw_sentences:
            s_words = set(re.findall(r'\w+', s.lower()))
            overlap = len(q_words & s_words)
            if overlap > 0:
                matched.append((overlap, s))
        matched.sort(key=lambda x: x[0], reverse=True)

        if matched:
            clean_q = question.rstrip('?').strip()
            ans = f"📄 **Regarding \"{clean_q}\" (from {primary_doc}):**\n\n"
            for _, p in matched[:3]:
                p_clean = p.strip()
                if not p_clean.endswith('.'):
                    p_clean += '.'
                ans += f"• {p_clean}\n"
            return ans, True

        # If semantic distance is close (<= 0.55), supply the top relevant excerpt
        if min_dist <= 0.55:
            top_snippet = valid_chunks[0][0].strip()
            if len(top_snippet) > 300:
                top_snippet = top_snippet[:300].rsplit('.', 1)[0] + '.'
            return f"📄 **From {primary_doc}:**\n\n{top_snippet}", True

    # ── INTENT 8: STRICT OUT OF SCOPE ───────────────────────────────────────────
    # If the question does not match project intents and has no close document vector match
    return OUT_OF_SCOPE_RESPONSE, False


# ─── Main Query Entry Point ───────────────────────────────────────────────────
def query_ekta(question: str, project_id=None, history=None, user_role: str = "Principal Investigator", username: str = "") -> dict:
    if not question or not question.strip():
        return {"answer": "Please ask a question.", "sources": [], "in_scope": True}

    question = question.strip()

    # Pre-check obvious out of scope
    if is_query_irrelevant(question):
        return {
            "answer": OUT_OF_SCOPE_RESPONSE,
            "sources": [],
            "in_scope": False
        }

    # 1. Fetch Project Metadata
    project_metadata = None
    has_uploaded_docs = False

    if project_id is not None:
        try:
            from dashboard.models import Project
            proj = Project.objects.filter(id=project_id).first()
            if proj:
                latest_report = proj.project_reports.first()
                budget_str = f"{proj.budget_amount} {proj.get_budget_unit_display()}" if proj.budget_amount else "Not specified"
                project_metadata = {
                    "id": proj.id,
                    "title": proj.title,
                    "code": proj.project_code,
                    "agency": proj.principal_agency,
                    "budget": budget_str,
                    "status": proj.get_status_display(),
                    "description": proj.description or "",
                    "start_date": str(proj.start_date) if proj.start_date else "",
                    "completion_date": str(proj.scheduled_completion) if proj.scheduled_completion else "",
                    "rejection_comment": (latest_report.admin_comment if latest_report and latest_report.status in ['rejected', 'resubmit_requested'] else "")
                }
                has_uploaded_docs = proj.supporting_documents.filter(is_indexed=True).exists()
        except Exception as e:
            logger.warning(f"Could not load project metadata: {e}")

    # 2. Retrieve relevant chunks from ChromaDB
    q_embedding = get_embeddings([question])[0]
    candidate_chunks = []
    sources = set()

    client = get_chroma_client()

    if project_id is not None and has_uploaded_docs:
        try:
            proj_col = client.get_collection(_collection_name(project_id))
            if proj_col.count() > 0:
                res = proj_col.query(
                    query_embeddings=[q_embedding],
                    n_results=min(TOP_K, proj_col.count()),
                    include=["documents", "metadatas", "distances"]
                )
                for doc, meta, dist in zip(res["documents"][0], res["metadatas"][0], res["distances"][0]):
                    candidate_chunks.append((doc, meta, dist))
                    sources.add(meta.get("doc_name", "Document"))
        except Exception as e:
            logger.warning(f"Project collection query notice: {e}")

    # Query system help KB if no project context
    if project_id is None:
        try:
            help_col = client.get_collection(_system_collection_name())
            if help_col.count() > 0:
                res = help_col.query(
                    query_embeddings=[q_embedding],
                    n_results=min(3, help_col.count()),
                    include=["documents", "metadatas", "distances"]
                )
                for doc, meta, dist in zip(res["documents"][0], res["metadatas"][0], res["distances"][0]):
                    candidate_chunks.append((doc, meta, dist))
                    sources.add("Drishti Help")
        except Exception:
            pass

    # Sort chunks by distance score
    candidate_chunks.sort(key=lambda x: x[2])
    top_chunks = [(doc, meta) for doc, meta, dist in candidate_chunks[:TOP_K]]

    # 3. Attempt External LLM generation if available
    llm_answer = None
    if get_gemini_key() or get_groq_key() or get_hf_token():
        context_str = "\n\n---\n\n".join([f"[From: {meta.get('doc_name', 'Doc')}]\n{doc}" for doc, meta in top_chunks])
        meta_prompt = ""
        if project_metadata:
            meta_prompt = (
                f"\n\n[PROJECT METADATA]\n"
                f"Title: {project_metadata['title']} ({project_metadata['code']})\n"
                f"Principal Agency: {project_metadata['agency']}\n"
                f"Budget: {project_metadata['budget']}\n"
                f"Status: {project_metadata['status']}\n"
                f"Manager Description: {project_metadata['description']}\n"
                f"User Inquiring: {username} ({user_role})\n"
            )

        system_prompt = (
            "You are Ekta, an AI Assistant for the Drishti Project Management Platform.\n"
            "STRICT RULES:\n"
            "1. Answer ONLY what the user asks based strictly on the provided documents and project metadata.\n"
            "2. If the user asks about their role, explain their role as Principal Investigator or Manager on this specific project.\n"
            "3. If the user asks something completely outside this project (sports, food, movies, general trivia), reply with:\n"
            "'I'm sorry, but this question is out of scope. I can only assist with inquiries directly related to this project and its documents.'\n"
            "4. Format your output cleanly with bullet points and clear headings."
        )

        llm_messages = [{"role": "system", "content": system_prompt}]
        if history:
            for h in history[-4:]:
                llm_messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
        llm_messages.append({"role": "user", "content": f"CONTEXT:\n{context_str}{meta_prompt}\n\nUSER QUESTION: {question}"})

        llm_answer = _call_external_llm(llm_messages)

    # 4. Use precision local synthesizer if external LLM not used or returned None
    if not llm_answer or not llm_answer.strip():
        final_answer, in_scope = _synthesize_local_response(
            question=question,
            project_metadata=project_metadata,
            candidate_chunks=candidate_chunks[:TOP_K],
            sources=list(sources),
            user_role=user_role,
            username=username
        )
    else:
        final_answer = llm_answer
        in_scope = "out of scope" not in final_answer.lower() and "unable to answer" not in final_answer.lower()

    clean_sources = [os.path.basename(s) for s in sources]
    return {
        "answer": final_answer,
        "sources": clean_sources if in_scope and clean_sources else ([] if not in_scope else ["Project Metadata"]),
        "in_scope": in_scope
    }
