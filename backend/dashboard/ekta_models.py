"""
ekta_models.py  —  Django models for Ekta document store and query log.
"""

from django.db import models
from django.conf import settings
from django.core.validators import FileExtensionValidator
from .models import Project


class SupportingDocument(models.Model):
    """
    A file uploaded by a manager as a reference/supporting material for a project.
    The text content is chunked and embedded into ChromaDB for RAG queries.
    """
    project     = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="supporting_documents"
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="uploaded_ekta_docs"
    )
    file        = models.FileField(
        upload_to="ekta_docs/%Y/%m/%d/",
        validators=[FileExtensionValidator(allowed_extensions=["pdf", "txt", "md"])]
    )
    filename    = models.CharField(max_length=255)
    file_type   = models.CharField(max_length=10)   # 'pdf', 'txt', 'md'
    is_indexed  = models.BooleanField(default=False)
    chunk_count = models.IntegerField(default=0)
    indexing_error = models.TextField(blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]
        verbose_name = "Supporting Document"
        verbose_name_plural = "Supporting Documents"

    def __str__(self):
        status = "indexed" if self.is_indexed else "not indexed"
        return f"{self.filename} [{self.project.project_code}] ({status})"


class EktaQueryLog(models.Model):
    """
    Audit log of all questions asked to Ekta.
    Visible only in Django Admin — not exposed in any UI.
    """
    project     = models.ForeignKey(
        Project, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="ekta_queries"
    )
    asked_by    = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="ekta_questions"
    )
    question    = models.TextField()
    answer      = models.TextField()
    in_scope    = models.BooleanField(default=True)
    sources     = models.TextField(blank=True)   # comma-separated document names
    asked_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-asked_at"]
        verbose_name = "Ekta Query Log"
        verbose_name_plural = "Ekta Query Logs"

    def __str__(self):
        scope = "✓" if self.in_scope else "✗"
        user = self.asked_by.username if self.asked_by else "?"
        return f"[{scope}] {user}: {self.question[:60]}"
