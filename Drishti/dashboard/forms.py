from django import forms
from .models import Project

class ProjectForm(forms.ModelForm):
    class Meta:
        model = Project
        fields = '__all__'
        widgets = {
            'budget_amount': forms.NumberInput(attrs={'step': '0.01'}),
            'budget_unit': forms.Select(attrs={'class': 'form-control'}),
        }