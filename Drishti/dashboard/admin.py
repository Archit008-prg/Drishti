from django.contrib import admin
from django import forms
from django.http import HttpResponse
from django.utils import timezone
from django.utils.html import format_html
from django.core.exceptions import ValidationError
from .models import Project, Report
import csv

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = (
        'project_code',
        'title',
        'principal_agency',
        'start_date',
        'scheduled_completion',
        'status',
        'formatted_budget',
        'days_remaining',
        'assigned_investigator'
    )
    
    list_filter = (
        'status',
        'project_type',
        'principal_agency',
        'assigned_investigator'
    )
    
    search_fields = (
        'project_code',
        'title',
        'principal_agency',
        'project_investigator',
        'assigned_investigator__username'
    )
    
    fieldsets = (
        ('Basic Information', {
            'fields': (
                'project_code',
                'title',
                'description',
                'principal_agency',
                'project_type',
                'assigned_investigator'
            )
        }),
        ('Budget Information', {
            'fields': (
                'budget_amount',
                'budget_unit'
            )
        }),
        ('Timeline', {
            'fields': (
                'start_date',
                'scheduled_completion',
                'actual_completion',
                'status'
            )
        }),
        ('Personnel', {
            'fields': (
                'project_investigator',
                'project_coordinator'
            ),
            'classes': ('collapse',)
        }),
        ('Additional Information', {
            'fields': ('implementing_agencies',),
            'classes': ('collapse',)
        })
    )
    
    date_hierarchy = 'start_date'
    ordering = ('-start_date',)
    list_per_page = 20
    list_select_related = ('assigned_investigator',)
    
    actions = ['mark_as_completed', 'export_as_csv']
    
    def formatted_budget(self, obj):
        return obj.get_budget_display()
    formatted_budget.short_description = 'Budget'
    formatted_budget.admin_order_field = 'budget_amount'
    
    def days_remaining(self, obj):
        if obj.status == 'completed':
            return "Completed"
        if not obj.scheduled_completion:
            return "Not set"
            
        delta = (obj.scheduled_completion - timezone.now().date()).days
        color = 'red' if delta < 0 else 'green'
        return format_html(
            '<span style="color: {};">{} days</span>',
            color,
            abs(delta)
        )
    days_remaining.short_description = 'Days Remaining'
    
    def mark_as_completed(self, request, queryset):
        updated = queryset.update(
            status='completed',
            actual_completion=timezone.now().date()
        )
        self.message_user(
            request,
            f"Successfully marked {updated} project(s) as completed."
        )
    mark_as_completed.short_description = "Mark selected projects as completed"
    
    def export_as_csv(self, request, queryset):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="projects_export.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'Project Code',
            'Title',
            'Principal Agency',
            'Assigned Investigator',
            'Start Date',
            'Scheduled Completion',
            'Actual Completion',
            'Status',
            'Budget Amount',
            'Budget Unit',
            'Budget in ₹'
        ])
        
        for project in queryset:
            writer.writerow([
                project.project_code,
                project.title,
                project.principal_agency,
                project.assigned_investigator.username if project.assigned_investigator else '',
                project.start_date.strftime('%Y-%m-%d'),
                project.scheduled_completion.strftime('%Y-%m-%d'),
                project.actual_completion.strftime('%Y-%m-%d') if project.actual_completion else '',
                project.get_status_display(),
                project.budget_amount,
                project.get_budget_unit_display(),
                project.budget_in_rupees
            ])
        
        return response
    export_as_csv.short_description = "Export selected projects to CSV"
    
    def get_readonly_fields(self, request, obj=None):
        if obj:  # Editing an existing object
            return ['project_code', 'start_date']
        return []

class ReportForm(forms.ModelForm):
    class Meta:
        model = Report
        fields = '__all__'

    def clean_report_file(self):
        report_file = self.cleaned_data.get('report_file')
        if report_file:
            if not report_file.name.lower().endswith('.pdf'):
                raise ValidationError("Only PDF files are allowed for reports.")
            if report_file.size > 10*1024*1024:  # 10MB limit
                raise ValidationError("File size must be under 10MB.")
        return report_file

@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    form = ReportForm
    list_display = (
        'project',
        'investigator',
        'submitted_at',
        'formatted_notes',
        'pdf_actions'
    )
    list_filter = (
        'submitted_at',
        'project__status',
        'investigator'
    )
    search_fields = (
        'project__title',
        'project__project_code',
        'investigator__username',
        'notes'
    )
    date_hierarchy = 'submitted_at'
    raw_id_fields = ('project',)
    readonly_fields = ('submitted_at', 'pdf_preview')
    fieldsets = (
        (None, {
            'fields': ('project', 'investigator', 'submitted_at')
        }),
        ('Report Content', {
            'fields': ('notes', 'report_file', 'pdf_preview'),
            'description': 'Upload PDF reports only. Max size 10MB.'
        }),
    )

    def formatted_notes(self, obj):
        return obj.notes[:50] + "..." if obj.notes and len(obj.notes) > 50 else obj.notes or "—"
    formatted_notes.short_description = 'Notes Preview'

    def pdf_actions(self, obj):
        if obj.report_file:
            return format_html(
                '<div class="pdf-actions">'
                '<a class="button view-pdf" href="{}" target="_blank">View</a>'
                '<a class="button download-pdf" href="{}" download>Download</a>'
                '</div>',
                obj.report_file.url,
                obj.report_file.url
            )
        return format_html('<span class="quiet">No PDF</span>')
    pdf_actions.short_description = 'PDF Actions'
    pdf_actions.allow_tags = True

    def pdf_preview(self, obj):
        if obj.report_file:
            return format_html(
                '<div class="pdf-preview-container">'
                '<iframe src="{}#toolbar=0&navpanes=0" class="pdf-preview"></iframe>'
                '<div class="pdf-actions">'
                '<a href="{}" target="_blank" class="button">Open Full</a>'
                '<a href="{}" download class="button">Download</a>'
                '</div>'
                '</div>',
                obj.report_file.url,
                obj.report_file.url,
                obj.report_file.url
            )
        return "No PDF uploaded yet"
    pdf_preview.short_description = 'PDF Preview'
    pdf_preview.allow_tags = True

    class Media:
        css = {
            'all': ['admin/css/report_admin.css']
        }

