create policy application_documents_owner_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'application-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
