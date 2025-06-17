from django.db import models
from django.urls import reverse
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()

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
        return f"₹{self.budget_amount:,.2f} {self.get_budget_unit_display()}"

    def is_overdue(self):
        """Check if project is overdue"""
        if self.status == 'completed':
            return False
        return timezone.now().date() > self.scheduled_completion


class Report(models.Model):
    project = models.ForeignKey(
        Project, 
        on_delete=models.CASCADE,
        related_name='reports'
    )
    investigator = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='submitted_reports'
    )
    report_file = models.FileField(upload_to='reports/%Y/%m/%d/')
    notes = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-submitted_at']
        verbose_name = "Report"
        verbose_name_plural = "Reports"

    def __str__(self):
        return f"Report for {self.project} by {self.investigator}"

    def get_absolute_url(self):
        return reverse('report_detail', kwargs={'pk': self.pk})

    @property
    def filename(self):
        return self.report_file.name.split('/')[-1]