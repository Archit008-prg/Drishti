

from django.contrib import admin
from django.http import HttpResponse
from django.utils import timezone
from django.utils.html import format_html
from .models import Project
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
        'days_remaining'
    )
    
    list_filter = (
        'status',
        'project_type',
        'principal_agency'
    )
    
    search_fields = (
        'project_code',
        'title',
        'principal_agency',
        'project_investigator'
    )
    
    fieldsets = (
        ('Basic Information', {
            'fields': (
                'project_code',
                'title',
                'description',
                'principal_agency',
                'project_type'
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
            'Start Date',
            'Scheduled Completion',
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
                project.start_date.strftime('%Y-%m-%d'),
                project.scheduled_completion.strftime('%Y-%m-%d'),
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
    