create policy application_documents_owner_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'application-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'application-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
