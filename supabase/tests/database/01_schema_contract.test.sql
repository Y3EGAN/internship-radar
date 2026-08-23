begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(15);

select is(
  (select count(*) from pg_tables where schemaname = 'public' and tablename in (
    'profiles', 'profile_evidence', 'companies', 'source_endpoints', 'source_runs',
    'jobs', 'job_sources', 'job_snapshots', 'job_scores', 'applications',
    'application_packages', 'screening_answers', 'application_events', 'email_outbox',
    'email_deliveries', 'resend_webhook_events', 'email_suppressions', 'device_pairings',
    'device_tokens'
  )),
  19::bigint,
  'all private application tables exist'
);

select is(
  (select count(*) from pg_class where relnamespace = 'public'::regnamespace
    and relname in (
      'profiles', 'profile_evidence', 'companies', 'source_endpoints', 'source_runs',
      'jobs', 'job_sources', 'job_snapshots', 'job_scores', 'applications',
      'application_packages', 'screening_answers', 'application_events', 'email_outbox',
      'email_deliveries', 'resend_webhook_events', 'email_suppressions', 'device_pairings',
      'device_tokens'
    ) and relrowsecurity),
  19::bigint,
  'RLS is enabled on every exposed application table'
);

select is(
  (select count(*) from pg_class where relnamespace = 'public'::regnamespace
    and relname in (
      'profiles', 'profile_evidence', 'companies', 'source_endpoints', 'source_runs',
      'jobs', 'job_sources', 'job_snapshots', 'job_scores', 'applications',
      'application_packages', 'screening_answers', 'application_events', 'email_outbox',
      'email_deliveries', 'resend_webhook_events', 'email_suppressions', 'device_pairings',
      'device_tokens'
    ) and relforcerowsecurity),
  19::bigint,
  'RLS is forced on every exposed application table'
);

select has_index('public', 'jobs', 'jobs_owner_state_cursor_idx', 'jobs cursor index exists');
select has_index('public', 'applications', 'applications_owner_state_cursor_idx', 'applications cursor index exists');
select has_index('public', 'source_endpoints', 'source_endpoints_due_idx', 'source due partial index exists');
select has_index('public', 'email_outbox', 'email_outbox_due_idx', 'outbox due partial index exists');
select has_index('public', 'job_sources', 'job_sources_source_endpoint_id_external_job_id_key', 'source external ID uniqueness exists');
select has_index('public', 'jobs', 'jobs_owner_canonical_url_key', 'canonical URL partial uniqueness exists');

select is(
  (select count(*) from pg_policies where schemaname = 'storage'
    and tablename = 'objects' and policyname like 'application_documents_owner_%'),
  4::bigint,
  'storage has separate select, insert, update, and delete policies'
);

select has_function('private', 'delete_expired_data', array['timestamp with time zone'], 'retention helper exists');
select has_trigger('public', 'applications', 'applications_validate_state', 'application state trigger exists');
select has_trigger('public', 'application_events', 'application_events_append_only', 'event append-only trigger exists');

select is(
  (select count(*) from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public'
    and table_name in ('profiles', 'jobs', 'applications', 'email_outbox')),
  0::bigint,
  'anonymous role has no application table grants'
);

select is(
  (select count(*) from pg_publication_tables where pubname = 'supabase_realtime'
    and schemaname = 'public' and tablename in ('jobs','applications','source_runs','source_endpoints','email_outbox','device_tokens')),
  6::bigint,
  'dashboard-owned tables are published for authenticated realtime refresh'
);

select * from finish();
rollback;
