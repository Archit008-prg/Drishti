"""
WSGI config for Drishti project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/
"""

import os
import sys

venv_site = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'myenv', 'Lib', 'site-packages'))
if os.path.exists(venv_site) and venv_site not in sys.path:
    sys.path.insert(0, venv_site)

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Drishti.settings')

application = get_wsgi_application()
