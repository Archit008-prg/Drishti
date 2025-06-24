from django import forms
from .models import Project, Report

class ProjectForm(forms.ModelForm):
    class Meta:
        model = Project
        fields = '__all__'
        widgets = {
            'budget_amount': forms.NumberInput(attrs={'step': '0.01'}),
            'budget_unit': forms.Select(attrs={'class': 'form-control'}),
        }


class ReportForm(forms.ModelForm):
    class Meta:
        model = Report
        fields = ['report_file', 'notes']
        widgets = {
            'notes': forms.Textarea(attrs={
                'rows': 4,
                'class': 'form-control',
                'placeholder': 'Explain any changes made...'
            }),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['report_file'].widget.attrs.update({
            'class': 'form-control',
            'accept': '.pdf',
            'required': 'required'
        })
    
    def clean_report_file(self):
        report_file = self.cleaned_data.get('report_file')
        if report_file:
            if report_file.size > 10*1024*1024:  # 10MB limit
                raise forms.ValidationError("File size must be under 10MB")
            if not report_file.name.lower().endswith('.pdf'):
                raise forms.ValidationError("Only PDF files are allowed")
        return report_file