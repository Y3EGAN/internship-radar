create policy application_documents_owner_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'application-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
