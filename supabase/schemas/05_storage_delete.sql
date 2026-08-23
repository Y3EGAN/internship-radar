create policy application_documents_owner_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'application-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
