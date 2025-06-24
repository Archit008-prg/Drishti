"""
URL configuration for Drishti project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
# drishti/urls.py (project-level)
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.auth.views import LogoutView, LoginView
from django.views.generic.base import RedirectView
from dashboard import views

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),
    
    # Authentication
    path('login/', LoginView.as_view(template_name='dashboard/investigator_login.html'), name='login'),
    path('logout/', LogoutView.as_view(next_page='login'), name='logout'),
    
    # Dashboard app
    path('', include('dashboard.urls')),
    
    # Investigator specific views
    path('investigator/login/', views.investigator_login, name='investigator_login'),
    path('investigator/signup/', views.investigator_signup, name='investigator_signup'),
    path('investigator/dashboard/', views.investigator_dashboard, name='investigator_dashboard'),
    
    # Redirect root to dashboard
    path('', RedirectView.as_view(url='investigator/dashboard/')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
