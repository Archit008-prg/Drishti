from django.db.models.signals import post_save
from django.dispatch import receiver
from dashboard.models import Project, Notification

@receiver(post_save, sender=Project)
def handle_project_assignment(sender, instance, created, **kwargs):
    """
    Creates a dashboard notification when a project is assigned to an investigator.
    """
    if not instance.assigned_investigator:
        return

    if not created:
        try:
            original = Project.objects.get(pk=instance.pk)
            if original.assigned_investigator == instance.assigned_investigator:
                return  # No change in investigator
        except Project.DoesNotExist:
            pass

    # Create local dashboard notification
    Notification.objects.create(
        user=instance.assigned_investigator,
        message=f"You have been assigned to project: {instance.title} ({instance.project_code})",
        project=instance,
        notification_type='assignment'
    )