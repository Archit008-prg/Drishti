from django.contrib import admin
from django import forms
from django.http import HttpResponse
from django.utils import timezone
from django.utils.html import format_html
from django.core.exceptions import ValidationError
from .models import Project, Report, Notification
import csv
from django.http import HttpResponse, HttpResponseRedirect
from django.urls import reverse
from django.contrib import messages


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
        'assigned_investigator',
        'get_report_status',
        'status'
    )
    
    list_filter = (
        'status',
        'project_type',
        'principal_agency',
        'assigned_investigator',
        'status', 
        'report_submitted', 
        'report_approved'
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
    
    actions = ['mark_as_completed', 'export_as_csv', 'request_resubmission', 'approve_reports']

    
    @admin.action(description='Approve selected reports')
    def approve_reports(self, request, queryset):
        queryset.update(
            report_approved=True,
            report_resubmit_requested=False,
            report_submitted=True
        )
        Report.objects.filter(project__in=queryset).update(status='approved')
        
        # Create notifications
        for project in queryset:
            if project.assigned_investigator:
                Notification.objects.create(
                    user=project.assigned_investigator,
                    message=f"Your report for project {project.title} has been approved.",
                    report=project.report_set.first()  # Assuming one report per project
                )
        
        self.message_user(request, f"Approved {queryset.count()} reports.")
    
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
            abs(delta))
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

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'message', 'notification_type', 'created_at')
    list_filter = ('notification_type', 'is_read', 'user')
    search_fields = ('user__username', 'message')
    readonly_fields = ('created_at',)
    
    def has_add_permission(self, request):
        """Prevent manual creation of notifications in admin"""
        return False
        
    def get_queryset(self, request):
        """Only show admin-related notifications in admin panel"""
        qs = super().get_queryset(request)
        if not request.user.is_superuser:
            return qs.none()
        return qs.filter(notification_type__in=['admin_alert'])  # Different type for admin

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
        'pdf_actions',  
        'status', 
        'admin_actions',
    )
    list_filter = (
        'submitted_at',
        'project__status',
        'investigator',
        'status'
    )
    search_fields = (
        'project__title',
        'project__project_code',
        'investigator__username',
        'notes' 
    )
    date_hierarchy = 'submitted_at'
    raw_id_fields = ('project',)
    readonly_fields = ('submitted_at', 'pdf_preview', 'updated_at')
    actions = ['approve_selected_reports', 'reject_selected_reports', 'request_resubmission']
    fieldsets = (
        (None, {
            'fields': ('project', 'investigator', 'submitted_at', 'status')
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

    def admin_actions(self, obj):
        return format_html(
            '<div class="admin-actions">'
            '<a class="button approve-button" href="{}">Approve</a>'
            '<a class="button reject-button" href="{}">Reject</a>'
            '<a class="button resubmit-button" href="{}">Request Resubmit</a>'
            '</div>',
            f"{obj.id}/approve/",
            f"{obj.id}/reject/",
            f"{obj.id}/resubmit/"
        )
    admin_actions.short_description = 'Actions'
    admin_actions.allow_tags = True

    def get_urls(self):
        from django.urls import path
        urls = super().get_urls()
        custom_urls = [
            path('<path:object_id>/approve/',
                 self.admin_site.admin_view(self.approve_report)),
            path('<path:object_id>/reject/',
                 self.admin_site.admin_view(self.reject_report)),
            path('<path:object_id>/resubmit/',
                 self.admin_site.admin_view(self.request_resubmit)),
        ]
        return custom_urls + urls

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        
        # Only create notifications for status changes
        if change and 'status' in form.changed_data:
            self.create_notification(obj)

    def create_notification(self, report):
        message = ""
        if report.status == 'approved':
            message = f"Your report for project {report.project.title} has been approved."
        elif report.status == 'rejected':
            message = f"Your report for project {report.project.title} has been rejected."
        elif report.status == 'resubmit_requested':
            message = f"Resubmission requested for your report on project {report.project.title}."
        
        if message:
            Notification.objects.create(
                user=report.investigator,
                message=message,
                report=report
            )

    def approve_report(self, request, object_id, *args, **kwargs):
        report = self.get_object(request, object_id)
        report.status = 'approved'
        report.save()
        
        # Create notification
        Notification.objects.create(
            user=report.investigator,
            message=f"Your report for project {report.project.title} has been approved.",
            report=report
        )
        
        report.project.report_approved = True
        report.project.report_resubmit_requested = False
        report.project.save()
        self.message_user(request, 'The report has been approved.')
        return HttpResponseRedirect(request.META.get('HTTP_REFERER', '../'))

    def reject_report(self, request, object_id, *args, **kwargs):
        report = self.get_object(request, object_id)
        report.status = 'rejected'
        report.save()
        
        # Create notification
        Notification.objects.create(
            user=report.investigator,
            message=f"Your report for project {report.project.title} has been rejected.",
            report=report
        )
        
        report.project.report_approved = False
        report.project.save()
        self.message_user(request, 'The report has been rejected.')
        return HttpResponseRedirect(request.META.get('HTTP_REFERER', '../'))

    def request_resubmit(self, request, object_id, *args, **kwargs):
        report = self.get_object(request, object_id)
        report.status = 'resubmit_requested'
        report.save()
        
        # Create notification
        Notification.objects.create(
            user=report.investigator,
            message=f"Resubmission requested for your report on project {report.project.title}.",
            report=report
        )
        
        report.project.report_resubmit_requested = True
        report.project.report_submitted = False
        report.project.report_approved = False
        report.project.save()
        self.message_user(request, 'Resubmission requested for the report.')
        return HttpResponseRedirect(request.META.get('HTTP_REFERER', '../'))

    @admin.action(description='Approve selected reports')
    def approve_selected_reports(self, request, queryset):
        updated = queryset.update(status='approved')
        
        # Create notifications for all approved reports
        for report in queryset:
            Notification.objects.create(
                user=report.investigator,
                message=f"Your report for project {report.project.title} has been approved.",
                report=report
            )
        
        Project.objects.filter(report__in=queryset).update(
            report_approved=True,
            report_resubmit_requested=False
        )
        self.message_user(request, f'{updated} reports were successfully approved.')

    @admin.action(description='Reject selected reports')
    def reject_selected_reports(self, request, queryset):
        updated = queryset.update(status='rejected')
        
        # Create notifications for all rejected reports
        for report in queryset:
            Notification.objects.create(
                user=report.investigator,
                message=f"Your report for project {report.project.title} has been rejected.",
                report=report
            )
        
        Project.objects.filter(report__in=queryset).update(
            report_approved=False
        )
        self.message_user(request, f'{updated} reports were rejected.')

        
        Project.objects.filter(report__in=queryset).update(
            report_resubmit_requested=True,
            report_submitted=False,
            report_approved=False
        )
        self.message_user(request, f'Resubmission requested for {updated} reports.')

    class Media:
        css = {
            'all': ['admin/css/report_admin.css']
        }
        js = ['admin/js/report_actions.js']


@admin.action(description='Reject selected reports')
def reject_reports(self, request, queryset):
    queryset.update(status='rejected')
    for report in queryset:
        Notification.objects.create(
            user=report.investigator,
            message=f"Your report for {report.project.title} was rejected. Reason: {report.admin_comments}",
            report=report,
            notification_type='report_rejected'
        )
    self.message_user(request, f"{queryset.count()} reports rejected")

@admin.action(description='Request resubmission')
def request_resubmission(self, request, queryset):
    queryset.update(status='resubmit_requested')
    for report in queryset:
        Notification.objects.create(
            user=report.investigator,
            message=f"Resubmission requested for {report.project.title}. Comments: {report.admin_comments}",
            report=report,
            notification_type='resubmit_request'
        )
    self.message_user(request, f"Resubmission requested for {queryset.count()} reports")




