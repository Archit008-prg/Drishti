from django.db.models.signals import post_save, m2m_changed
from django.dispatch import receiver
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from dashboard.models import Project

@receiver(post_save, sender=Project)
def handle_project_assignment(sender, instance, created, **kwargs):
    """
    Sends email notification when:
    1. New project is created with an investigator, OR
    2. Existing project's investigator is changed
    """
    # Skip if no investigator assigned
    if not instance.assigned_investigator:
        return

    # For updates, check if investigator actually changed
    if not created:
        try:
            original = Project.objects.get(pk=instance.pk)
            if original.assigned_investigator == instance.assigned_investigator:
                return  # No change in investigator
        except Project.DoesNotExist:
            pass

    # Prepare email context
    context = {
        'project': instance,
        'investigator': instance.assigned_investigator,
        'project_url': f"{settings.BASE_URL}{instance.get_absolute_url()}",
        'admin_contact': settings.ADMIN_EMAIL,
    }

    # Send email
    send_mail(
        subject=f"New Project Assignment: {instance.title}",
        message=render_to_string('dashboard/emails/project_assignment.txt', context),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[instance.assigned_investigator.email],
        html_message=render_to_string('dashboard/emails/project_assignment.html', context),
        fail_silently=False,
    )