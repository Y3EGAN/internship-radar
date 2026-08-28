create unique index jobs_owner_canonical_url_key
  on public.jobs (owner_id, canonical_url)
  where canonical_url is not null;

create index jobs_owner_state_cursor_idx
  on public.jobs (owner_id, state, discovered_at desc, id desc);
create index jobs_company_id_idx on public.jobs (company_id);
create index jobs_fingerprint_idx
  on public.jobs (owner_id, company_id, normalized_title, normalized_location);
create index jobs_owner_saved_idx
  on public.jobs (owner_id, saved_at desc, id desc)
  where saved_at is not null;
create index jobs_owner_applied_idx
  on public.jobs (owner_id, applied_at desc, id desc)
  where applied_at is not null;

create index applications_owner_state_cursor_idx
  on public.applications (owner_id, state, updated_at desc, id desc);
create index applications_job_id_idx on public.applications (job_id);

create index source_endpoints_company_id_idx on public.source_endpoints (company_id);
create index source_endpoints_due_idx
  on public.source_endpoints (next_due_at, id)
  where state <> 'disabled';

create index source_runs_owner_cursor_idx
  on public.source_runs (owner_id, started_at desc, id desc);

create unique index source_runs_one_running_per_owner_idx
  on public.source_runs (owner_id)
  where outcome = 'running';

create index job_sources_owner_id_idx on public.job_sources (owner_id);
create index job_sources_job_id_idx on public.job_sources (job_id);

create index job_snapshots_owner_id_idx on public.job_snapshots (owner_id);
create index job_snapshots_expiry_idx on public.job_snapshots (expires_at, id);

create index job_scores_owner_id_idx on public.job_scores (owner_id);

create index application_packages_owner_id_idx on public.application_packages (owner_id);
create index application_packages_application_id_idx on public.application_packages (application_id);
create index application_packages_expiry_idx on public.application_packages (expires_at, id);

create index application_events_owner_cursor_idx
  on public.application_events (owner_id, created_at desc, id desc);
create index application_events_application_id_idx on public.application_events (application_id);

create index email_outbox_due_idx
  on public.email_outbox (next_attempt_at, id)
  where state in ('pending', 'retry_wait');

create index email_deliveries_owner_id_idx on public.email_deliveries (owner_id);
create index resend_webhook_events_owner_id_idx on public.resend_webhook_events (owner_id);
create index resend_webhook_events_delivery_id_idx on public.resend_webhook_events (delivery_id);
create index resend_webhook_events_processed_idx on public.resend_webhook_events (processed_at, id);

create index device_pairings_owner_id_idx on public.device_pairings (owner_id);
create index device_pairings_expiry_idx on public.device_pairings (expires_at, id)
  where consumed_at is null;
create index device_tokens_owner_id_idx on public.device_tokens (owner_id);
create index device_tokens_active_idx on public.device_tokens (owner_id, expires_at, id)
  where revoked_at is null;
