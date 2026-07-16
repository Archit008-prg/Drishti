from django.apps import AppConfig


class DashboardConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'dashboard'

    def ready(self):
        import dashboard.signals  # Import signals from your dashboard app

        # Index Drishti system help KB into ChromaDB on first startup
        # Wrapped in try/except so a missing HF token or network issue
        # doesn't crash the entire server.
        try:
            from django.conf import settings
            if getattr(settings, 'HF_API_TOKEN', ''):
                import threading
                def _index_help():
                    try:
                        from dashboard.ekta_rag import load_system_help_kb
                        load_system_help_kb()
                    except Exception as e:
                        import logging
                        logging.getLogger(__name__).warning(
                            f"Ekta system help KB indexing deferred: {e}"
                        )
                # Run in background thread so it doesn't block server start
                t = threading.Thread(target=_index_help, daemon=True)
                t.start()
        except Exception:
            pass
