import re

with open(r'f:\Drishti\Drishti\backend\dashboard\api.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace synchronous indexing with background threading
old_block = r'''                saved_doc\.file\.seek\(0\)
                text = ekta_api\._extract_text_from_file\(saved_doc\.file, saved_doc\.file\.name\)
                if text\.strip\(\):
                    # index_document\(doc_id, project_id, text, doc_name\)
                    chunks = ekta_rag\.index_document\(saved_doc\.id, project\.id, text, saved_doc\.file\.name\)
                    saved_doc\.is_indexed = True
                    saved_doc\.chunk_count = chunks
                    saved_doc\.save\(\)'''

new_block = '''                import threading
                def index_background(doc_id, proj_id, doc_name):
                    try:
                        from dashboard.ekta_models import SupportingDocument
                        doc_obj = SupportingDocument.objects.get(id=doc_id)
                        doc_obj.file.seek(0)
                        extracted_text = ekta_api._extract_text_from_file(doc_obj.file, doc_name)
                        if extracted_text.strip():
                            chunks_created = ekta_rag.index_document(doc_id, proj_id, extracted_text, doc_name)
                            doc_obj.is_indexed = True
                            doc_obj.chunk_count = chunks_created
                            doc_obj.save()
                    except Exception as ex:
                        print(f"Background indexing failed: {ex}")
                
                t = threading.Thread(target=index_background, args=(saved_doc.id, project.id, saved_doc.file.name))
                t.start()'''

# Fix any indentation mismatch using regex search
content = re.sub(old_block, new_block, content, flags=re.MULTILINE)

# Also fix the `send_mail` being synchronous.
# This causes massive delays as well.
mail_old = r'''        try:
            send_mail\(
                subject,
                message,
                settings\.DEFAULT_FROM_EMAIL,
                \[assigned_email\],
                fail_silently=False,
                html_message=html_message
            \)
        except Exception as e:
            print\(f"Email failed: \{e\}"\)'''

mail_new = '''        def send_email_bg():
            try:
                send_mail(
                    subject,
                    message,
                    settings.DEFAULT_FROM_EMAIL,
                    [assigned_email],
                    fail_silently=False,
                    html_message=html_message
                )
            except Exception as e:
                print(f"Email failed: {e}")
        import threading
        threading.Thread(target=send_email_bg).start()'''

content = re.sub(mail_old, mail_new, content)

with open(r'f:\Drishti\Drishti\backend\dashboard\api.py', 'w', encoding='utf-8') as f:
    f.write(content)
