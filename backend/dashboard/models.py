from django.db import models
from django.urls import reverse
from django.utils import timezone
from django.contrib.auth import get_user_model

# models.py (add these at the top)
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.core.validators import FileExtensionValidator

User = get_user_model()

class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    message = models.TextField()
    report = models.ForeignKey('Report', on_delete=models.CASCADE, null=True, blank=True)
    project = models.ForeignKey('Project', on_delete=models.CASCADE, null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    notification_type = models.CharField(
        max_length=20,
        choices=[
            ('report_submitted', 'Report Submitted'),
            ('report_approved', 'Report Approved'),
            ('report_rejected', 'Report Rejected'),
            ('resubmit_request', 'Resubmission Requested'),
            ('assignment', 'Project Assignment')
        ],
        default='report_submitted'
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Investigator Notification'
        verbose_name_plural = 'Investigator Notifications'

    def __str__(self):
        return f"{self.get_notification_type_display()} - {self.user.username}"
    

class Project(models.Model):
    PROJECT_TYPES = (
        ('S&T', 'Science & Technology'),
        ('R&D', 'Research & Development'),
    )
    STATUS_CHOICES = (
        ('ongoing', 'Ongoing'),
        ('completed', 'Completed'),
        ('pending', 'Pending'),
        ('up_next', 'Up Next'),  # Fixed capitalization for consistency
    )
    BUDGET_UNIT_CHOICES = [
        ('rupees', 'Rupees'),
        ('thousands', 'Thousands (₹)'),
        ('lakhs', 'Lakhs (₹)'),
        ('crores', 'Crores (₹)'),
    ]

    # Basic Information
    project_code = models.CharField(max_length=20, unique=True)
    project_type = models.CharField(max_length=3, choices=PROJECT_TYPES)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    principal_agency = models.CharField(max_length=100)
    
    # Budget Fields
    budget_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Budget Amount"
    )
    budget_unit = models.CharField(
        max_length=10,
        choices=BUDGET_UNIT_CHOICES,
        default='lakhs',
        verbose_name="Budget Unit"
    )

    report_submitted = models.BooleanField(default=False, verbose_name="Report Submitted")
    report_submission_date = models.DateTimeField(null=True, blank=True, verbose_name="Report Submission Date")
    report_approved = models.BooleanField(default=False, verbose_name="Report Approved")
    report_resubmit_requested = models.BooleanField(
        default=False,
        verbose_name="Resubmission Requested",
        help_text="Admin can request investigator to resubmit report"
    )



    def can_submit_report(self):
        """Check if report can be submitted for this project"""
        return (
            not self.report_submitted or 
            self.report_resubmit_requested
        ) and self.status == 'ongoing'
    
        

    def get_report_status(self):
        """Get human-readable report status"""
        if self.report_approved:
            return "Approved"
        if self.report_submitted and not self.report_resubmit_requested:
            return "Under Review"
        if self.report_resubmit_requested:
            return "Resubmission Requested"
        return "Not Submitted"
    
    # Other fields
    implementing_agencies = models.TextField(
        blank=True, 
        null=True, 
        help_text="Comma separated list of implementing agencies"
    )
    project_investigator = models.CharField(max_length=100, blank=True, null=True)
    project_coordinator = models.CharField(max_length=100, blank=True, null=True)
    start_date = models.DateField()
    scheduled_completion = models.DateField()
    actual_completion = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=10, 
        choices=STATUS_CHOICES, 
        default='ongoing'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    assigned_investigator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_projects',
        verbose_name="Assigned Investigator"
    )
    assigned_email = models.EmailField(
        max_length=254,
        null=True,
        blank=True,
        verbose_name="Assigned Email"
    )


  

    created_by = models.ForeignKey(  # The admin who created the project
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_projects'
    )

    class Meta:
        ordering = ['-start_date']
        verbose_name = "Project"
        verbose_name_plural = "Projects"

    def __str__(self):
        return f"{self.project_code} - {self.title}"

    def get_absolute_url(self):
        return reverse('project_detail', kwargs={'project_id': self.id})

    @property
    def budget_in_rupees(self):
        """Convert budget to rupees"""
        if not self.budget_amount:
            return 0
        conversion = {
            'rupees': 1,
            'thousands': 1000,
            'lakhs': 100000,
            'crores': 10000000,
        }
        return float(self.budget_amount) * conversion.get(self.budget_unit, 1)
    
    def get_budget_display(self):
        """Formatted budget display"""
        if not self.budget_amount:
            return "Not specified"
        from decimal import Decimal
        try:
            val = Decimal(str(self.budget_amount))
            return f"Rs. {val:,.2f} {self.get_budget_unit_display()}"
        except Exception:
            return f"Rs. {self.budget_amount} {self.get_budget_unit_display()}"

    def is_overdue(self):
        """Check if project is overdue"""
        if self.status == 'completed':
            return False
        return timezone.now().date() > self.scheduled_completion


class Report(models.Model):
    REPORT_STATUS = (
        ('submitted', 'Submitted'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('resubmitted', 'Resubmitted'),
        ('resubmit_requested', 'Resubmit Requested'),
    )
    
    project = models.ForeignKey(
        Project, 
        on_delete=models.CASCADE,
        related_name='project_reports'
    )
    investigator = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='investigator_reports'
    )
    report_file = models.FileField(
        upload_to='reports/%Y/%m/%d/',
        validators=[FileExtensionValidator(allowed_extensions=['pdf'])]
    )
    notes = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=REPORT_STATUS,
        default='submitted'
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    admin_comment = models.TextField(blank=True, null=True)
    
    class Meta:
        ordering = ['-submitted_at']
        get_latest_by = 'submitted_at'
        verbose_name = "Report"
        verbose_name_plural = "Reports"

    def __str__(self):
        return f"Report for {self.project} ({self.get_status_display()})"

    def get_absolute_url(self):
        return reverse('report_detail', kwargs={'pk': self.pk})

    @property
    def filename(self):
        return self.report_file.name.split('/')[-1]


# models.py (add at the bottom)
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model

@receiver(post_save, sender=Report)
def create_report_notifications(sender, instance, created, **kwargs):
    User = get_user_model()
    
    if created:
        # Notification for admin about new submission
        admin_recipient = None
        
        # Try different ways to find an admin to notify
        if hasattr(instance.project, 'created_by') and instance.project.created_by:
            admin_recipient = instance.project.created_by
        else:
            # Fallback: find first staff user
            admin_recipient = User.objects.filter(is_staff=True).first()
        
        if admin_recipient:
            Notification.objects.create(
                user=admin_recipient,
                message=f"New report submitted for {instance.project.title}",
                report=instance,
                notification_type='report_submitted'
            )

    elif instance.status == 'rejected':
        # Notification for investigator about rejection
        if instance.investigator:
            Notification.objects.create(
                user=instance.investigator,
                message=f"Your report for {instance.project.title} was rejected.",
                report=instance,
                notification_type='report_rejected'
            )

    elif instance.status == 'approved':
        # Notification for investigator about approval
        if instance.investigator:
            Notification.objects.create(
                user=instance.investigator,
                message=f"Your report for {instance.project.title} was approved!",
                report=instance,
                notification_type='report_approved'
            )

    elif instance.status == 'resubmit_requested':
        # Notification for investigator about resubmission requested
        if instance.investigator:
            Notification.objects.create(
                user=instance.investigator,
                message=f"Resubmission requested for your report on project {instance.project.title}.",
                report=instance,
                notification_type='resubmit_request'
            )



class Team(models.Model):
    name = models.CharField(max_length=255)
    manager = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='managed_teams')
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='teams')
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.name

class ChatMessage(models.Model):
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_chats')
    receiver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_chats', null=True, blank=True)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='messages', null=True, blank=True)
    message = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['timestamp']
        verbose_name = "Chat Message"
        verbose_name_plural = "Chat Messages"
        
    def __str__(self):
        if self.team:
            return f"{self.sender.username} -> {self.team.name}: {self.message[:30]}"
        return f"{self.sender.username} -> {self.receiver.username if self.receiver else 'None'}: {self.message[:30]}"


# ─── AuditLog (internal only — not exposed in any UI) ────────────────────────
class AuditLog(models.Model):
    ACTION_CHOICES = [
        ('project_created',      'Project Created'),
        ('report_submitted',     'Report Submitted'),
        ('report_resubmitted',   'Report Resubmitted'),
        ('report_approved',      'Report Approved'),
        ('report_rejected',      'Report Rejected'),
        ('resubmit_requested',   'Resubmission Requested'),
        ('project_completed',    'Project Completed'),
        ('status_changed',       'Project Status Changed'),
    ]

    project      = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='audit_logs')
    action       = models.CharField(max_length=30, choices=ACTION_CHOICES)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name='audit_actions'
    )
    notes        = models.TextField(blank=True)
    timestamp    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering  = ['-timestamp']
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'

    def __str__(self):
        return f"[{self.get_action_display()}] {self.project} @ {self.timestamp:%Y-%m-%d %H:%M}"


@receiver(post_save, sender=Report)
def audit_on_report_change(sender, instance, created, **kwargs):
    """Silently write an audit record whenever a report status changes."""
    action_map = {
        'submitted':         'report_submitted',
        'resubmitted':       'report_resubmitted',
        'approved':          'report_approved',
        'rejected':          'report_rejected',
        'resubmit_requested': 'resubmit_requested',
    }
    action = action_map.get(instance.status)
    if not action:
        return

    AuditLog.objects.create(
        project=instance.project,
        action=action,
        performed_by=instance.investigator if created else None,
        notes=f"Report ID {instance.id} — {instance.status}"
    )

    # Extra audit entry when project auto-completes on approval
    if instance.status == 'approved':
        AuditLog.objects.create(
            project=instance.project,
            action='project_completed',
            performed_by=None,
            notes='Auto-completed after report approval'
        )

# ─── User Profile ─────────────────────────────────────────────────────────────
class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    bio = models.TextField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    is_public = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.user.username}'s Profile"

@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)
    else:
        # Save profile if it exists, otherwise create it (e.g. for existing users)
        try:
            instance.profile.save()
        except UserProfile.DoesNotExist:
            UserProfile.objects.create(user=instance)


# ─── Import Ekta models so Django migration system discovers them ─────────────
# (Models live in ekta_models.py to keep files clean, imported here for discovery)
from dashboard.ekta_models import SupportingDocument, EktaQueryLog  # noqa: F401, E402

