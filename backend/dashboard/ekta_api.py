"""
ekta_api.py  —  REST API endpoints for Ekta
"""

import io
import logging
from pathlib import Path

from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from django.shortcuts import get_object_or_404
from django.utils import timezone

from .models import Project
from .ekta_models import SupportingDocument, EktaQueryLog
from . import ekta_rag

logger = logging.getLogger(__name__)


def _extract_text_from_file(file_obj, filename: str) -> str:
    """
    Extract plain text from an uploaded file.
    Supports: PDF, TXT.
    Returns empty string if unsupported or extraction fails.
    """
    ext = Path(filename).suffix.lower()

    if ext == ".pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(file_obj.read()))
            pages = [page.extract_text() or "" for page in reader.pages]
            return "\n".join(pages)
        except Exception as e:
            logger.error(f"PDF extraction failed for {filename}: {e}")
            return ""

    if ext in (".txt", ".md"):
        try:
            return file_obj.read().decode("utf-8", errors="ignore")
        except Exception as e:
            logger.error(f"Text extraction failed for {filename}: {e}")
            return ""

    if ext == ".docx":
        try:
            import docx
            doc = docx.Document(io.BytesIO(file_obj.read()))
            full_text = []
            for para in doc.paragraphs:
                full_text.append(para.text)
            return "\n".join(full_text)
        except Exception as e:
            logger.error(f"DOCX extraction failed for {filename}: {e}")
            return ""

    return ""  # unsupported type


# ─── Upload supporting document (manager only) ────────────────────────────────
@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def api_ekta_upload(request):
    """
    Manager uploads a supporting document for a project.
    Extracts text, chunks and indexes into ChromaDB.
    """
    if not request.user.is_staff:
        return Response({"error": "Only managers can upload supporting documents."}, status=403)

    project_id = request.data.get("project_id")
    if not project_id:
        return Response({"error": "project_id is required."}, status=400)

    project = get_object_or_404(Project, id=project_id)
    file_obj = request.FILES.get("file")
    if not file_obj:
        return Response({"error": "No file provided."}, status=400)

    allowed_types = [".pdf", ".txt", ".md"]
    ext = Path(file_obj.name).suffix.lower()
    if ext not in allowed_types:
        return Response(
            {"error": f"Unsupported file type '{ext}'. Allowed: {', '.join(allowed_types)}"},
            status=400
        )

    # Save the DB record first to get an ID
    doc = SupportingDocument.objects.create(
        project=project,
        uploaded_by=request.user,
        file=file_obj,
        filename=file_obj.name,
        file_type=ext.lstrip("."),
        is_indexed=False,
    )

    # Re-open saved file for text extraction
    try:
        doc.file.open("rb")
        text = _extract_text_from_file(doc.file, doc.filename)
        doc.file.close()
    except Exception as e:
        logger.error(f"Could not read saved file {doc.filename}: {e}")
        text = ""

    if not text.strip():
        doc.indexing_error = "No text could be extracted from this file."
        doc.save()
        return Response({
            "id": doc.id,
            "filename": doc.filename,
            "is_indexed": False,
            "warning": "File saved but no text could be extracted. Ekta cannot answer questions about this file."
        }, status=201)

    # Index into ChromaDB
    try:
        chunk_count = ekta_rag.index_document(doc.id, project_id, text, doc.filename)
        doc.is_indexed = True
        doc.chunk_count = chunk_count
        doc.save()
        return Response({
            "id": doc.id,
            "filename": doc.filename,
            "is_indexed": True,
            "chunks_indexed": chunk_count,
            "message": f"Indexed {chunk_count} chunks. Ekta is ready to answer questions about this document."
        }, status=201)
    except Exception as e:
        logger.error(f"ChromaDB indexing failed for doc {doc.id}: {e}")
        doc.indexing_error = str(e)
        doc.save()
        return Response({
            "id": doc.id,
            "filename": doc.filename,
            "is_indexed": False,
            "error": f"Indexing failed: {e}"
        }, status=500)


# ─── Also index investigator-submitted report ─────────────────────────────────
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def api_ekta_index_report(request, report_id):
    """
    Index an investigator-submitted report PDF into the project's ChromaDB collection.
    Can be called by manager (to enable Ekta to answer about the report) or auto-triggered.
    """
    from .models import Report
    report = get_object_or_404(Report, id=report_id)

    if not request.user.is_staff and request.user != report.investigator:
        return Response({"error": "Unauthorized"}, status=403)

    try:
        report.report_file.open("rb")
        text = _extract_text_from_file(report.report_file, report.filename)
        report.report_file.close()
    except Exception as e:
        return Response({"error": f"Could not read report file: {e}"}, status=500)

    if not text.strip():
        return Response({"warning": "No text extracted from report PDF."}, status=200)

    try:
        doc_name = f"Investigator Report — {report.project.title}"
        chunk_count = ekta_rag.index_document(
            doc_id=-(report.id),            # Negative ID to distinguish from supporting docs
            project_id=report.project_id,
            text=text,
            doc_name=doc_name
        )
        return Response({
            "message": f"Report indexed: {chunk_count} chunks. Ekta can now answer questions about this report.",
            "chunks_indexed": chunk_count
        })
    except Exception as e:
        return Response({"error": f"Indexing failed: {e}"}, status=500)


# ─── List supporting documents for a project ─────────────────────────────────
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def api_ekta_documents(request, project_id):
    """List all supporting documents for a project."""
    project = get_object_or_404(Project, id=project_id)

    # Investigators can only view their own project docs
    if not request.user.is_staff and project.assigned_investigator != request.user:
        return Response({"error": "Unauthorized"}, status=403)

    docs = SupportingDocument.objects.filter(project=project).order_by("-uploaded_at")
    data = [{
        "id": d.id,
        "filename": d.filename,
        "file_type": d.file_type,
        "uploaded_by": d.uploaded_by.username if d.uploaded_by else "Unknown",
        "uploaded_at": d.uploaded_at.isoformat(),
        "is_indexed": d.is_indexed,
        "chunk_count": d.chunk_count,
        "indexing_error": d.indexing_error or None,
    } for d in docs]
    return Response(data)


# ─── Delete a supporting document ─────────────────────────────────────────────
@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def api_ekta_delete_document(request, doc_id):
    """Manager deletes a supporting document and removes it from ChromaDB."""
    if not request.user.is_staff:
        return Response({"error": "Only managers can delete documents."}, status=403)

    doc = get_object_or_404(SupportingDocument, id=doc_id)
    project_id = doc.project_id

    # Remove from ChromaDB
    try:
        ekta_rag.delete_document(doc.id, project_id)
    except Exception as e:
        logger.warning(f"ChromaDB delete warning for doc {doc_id}: {e}")

    # Remove file from disk + DB record
    try:
        doc.file.delete(save=False)
    except Exception:
        pass
    doc.delete()

    return Response({"message": "Document deleted successfully."})


# ─── Query Ekta ───────────────────────────────────────────────────────────────
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def api_ekta_query(request):
    """
    Main Ekta Q&A endpoint.
    Body: { "question": "...", "project_id": 42 }
    Returns: { "answer": "...", "sources": [...], "in_scope": true/false }
    """
    question   = (request.data.get("question") or "").strip()
    project_id = request.data.get("project_id")

    if not question:
        return Response({"error": "question is required."}, status=400)

    if len(question) > 1000:
        return Response({"error": "Question too long (max 1000 characters)."}, status=400)

    # Authorization: investigators can only query their own project
    if project_id and not request.user.is_staff:
        project = get_object_or_404(Project, id=project_id, assigned_investigator=request.user)

    try:
        result = ekta_rag.query_ekta(
            question=question,
            project_id=int(project_id) if project_id else None
        )
    except Exception as e:
        logger.error(f"Ekta query error: {e}")
        return Response({"error": f"Ekta encountered an error: {e}"}, status=500)

    # Log query
    try:
        EktaQueryLog.objects.create(
            project_id=project_id if project_id else None,
            asked_by=request.user,
            question=question,
            answer=result["answer"],
            in_scope=result["in_scope"],
            sources=", ".join(result.get("sources", []))
        )
    except Exception as e:
        logger.warning(f"Could not save query log: {e}")

    return Response(result)


# ─── Query log (manager only) ─────────────────────────────────────────────────
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def api_ekta_query_log(request, project_id):
    """Return last 50 Ekta queries for a project (manager only)."""
    if not request.user.is_staff:
        return Response({"error": "Unauthorized"}, status=403)

    logs = EktaQueryLog.objects.filter(project_id=project_id).order_by("-asked_at")[:50]
    data = [{
        "id": l.id,
        "asked_by": l.asked_by.username if l.asked_by else "Unknown",
        "question": l.question,
        "answer": l.answer,
        "in_scope": l.in_scope,
        "sources": l.sources,
        "asked_at": l.asked_at.isoformat(),
    } for l in logs]
    return Response(data)
