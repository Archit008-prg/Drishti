# Generated by Django 5.2.3 on 2025-06-15 08:56

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('dashboard', '0005_alter_project_options_remove_project_budget_amount_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='project',
            name='budget',
        ),
        migrations.AddField(
            model_name='project',
            name='budget_amount',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=15, null=True, verbose_name='Budget Amount'),
        ),
        migrations.AddField(
            model_name='project',
            name='budget_unit',
            field=models.CharField(choices=[('rupees', 'Rupees'), ('thousands', 'Thousands (₹)'), ('lakhs', 'Lakhs (₹)'), ('crores', 'Crores (₹)')], default='lakhs', max_length=10, verbose_name='Budget Unit'),
        ),
    ]
