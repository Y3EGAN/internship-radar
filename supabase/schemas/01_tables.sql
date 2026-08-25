create table public.profiles (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  targeting_criteria jsonb not null default '{}'::jsonb,
  contact_preferences jsonb not null default '{}'::jsonb,
  alert_settings jsonb not null default '{}'::jsonb,
  non_contact_preferences jsonb not null default '{}'::jsonb,
  daily_email_cap smallint not null default 50,
  monthly_email_cap smallint not null default 2500,
  database_soft_limit_mb integer not null default 400,
  storage_soft_limit_mb integer not null default 800,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_targeting_object check (jsonb_typeof(targeting_criteria) = 'object'),
  constraint profiles_contact_object check (jsonb_typeof(contact_preferences) = 'object'),
  constraint profiles_alert_object check (jsonb_typeof(alert_settings) = 'object'),
  constraint profiles_non_contact_object check (jsonb_typeof(non_contact_preferences) = 'object'),
  constraint profiles_email_caps check (
    daily_email_cap between 1 and 50
    and monthly_email_cap between 1 and 2500
    and daily_email_cap <= monthly_email_cap
  ),
  constraint profiles_resource_limits check (
    database_soft_limit_mb between 1 and 400
    and storage_soft_limit_mb between 1 and 800
  )
);

create table public.profile_evidence (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  evidence_type text not null,
  label text not null,
  fact text not null,
  source_reference text not null,
  verified_at timestamptz not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_evidence_nonempty check (
    btrim(evidence_type) <> '' and btrim(label) <> '' and btrim(fact) <> '' and btrim(source_reference) <> ''
  ),
  constraint profile_evidence_expiry_order check (expires_at is null or expires_at > verified_at),
  unique (owner_id, source_reference, fact)
);

create table public.companies (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  tier text not null,
  priority smallint not null default 0,
  is_active boolean not null default true,
  career_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_name_nonempty check (btrim(name) <> ''),
  constraint companies_tier check (tier in ('A', 'B', 'C')),
  constraint companies_priority check (priority between 0 and 100),
  constraint companies_career_url_https check (career_url ~ '^https://'),
  unique (owner_id, name)
);

create table public.source_endpoints (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  company_id bigint references public.companies (id) on delete cascade,
  ats public.ats_type not null,
  board_identifier text not null,
  endpoint_url text not null,
  interval_seconds integer not null,
  next_due_at timestamptz not null default now(),
  last_checked_at timestamptz,
  last_success_at timestamptz,
  failure_count integer not null default 0,
  state public.source_state not null default 'healthy',
  disabled_reason text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_endpoints_board_nonempty check (btrim(board_identifier) <> ''),
  constraint source_endpoints_https check (endpoint_url ~ '^https://'),
  constraint source_endpoints_interval check (interval_seconds between 300 and 86400),
  constraint source_endpoints_failure_count check (failure_count >= 0),
  constraint source_endpoints_disabled_reason check (
    (state = 'disabled' and nullif(btrim(disabled_reason), '') is not null)
    or (state <> 'disabled' and disabled_reason is null)
  ),
  unique (owner_id, ats, board_identifier)
);

create table public.source_runs (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  workflow_run_id text,
  partition_key text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  attempted_count integer not null default 0,
  succeeded_count integer not null default 0,
  failed_count integer not null default 0,
  discovered_count integer not null default 0,
  changed_count integer not null default 0,
  outcome public.run_outcome not null default 'running',
  sanitized_error text,
  created_at timestamptz not null default now(),
  constraint source_runs_counts check (
    attempted_count >= 0 and succeeded_count >= 0 and failed_count >= 0
    and discovered_count >= 0 and changed_count >= 0
    and succeeded_count + failed_count <= attempted_count
  ),
  constraint source_runs_duration check (duration_ms is null or duration_ms >= 0),
  constraint source_runs_finish_order check (finished_at is null or finished_at >= started_at),
  constraint source_runs_finished_state check (
    (outcome = 'running' and finished_at is null)
    or (outcome <> 'running' and finished_at is not null)
  ),
  unique (owner_id, workflow_run_id, partition_key)
);

create table public.jobs (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  company_id bigint references public.companies (id) on delete set null,
  title text not null,
  normalized_title text not null,
  canonical_url text,
  description text,
  location_text text,
  normalized_location text,
  role_family text,
  state public.job_state not null default 'discovered',
  preliminary_score numeric(5, 2) not null default 0,
  posted_at timestamptz,
  closes_at timestamptz,
  discovered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  saved_at timestamptz,
  constraint jobs_title_nonempty check (btrim(title) <> '' and btrim(normalized_title) <> ''),
  constraint jobs_canonical_https check (canonical_url is null or canonical_url ~ '^https://'),
  constraint jobs_score_range check (preliminary_score between 0 and 100),
  constraint jobs_date_order check (closes_at is null or posted_at is null or closes_at >= posted_at),
  constraint jobs_seen_order check (last_seen_at >= discovered_at)
);

create table public.job_sources (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  job_id bigint not null references public.jobs (id) on delete cascade,
  source_endpoint_id bigint not null references public.source_endpoints (id) on delete cascade,
  external_job_id text not null,
  source_url text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  content_hash text not null,
  is_verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_sources_external_id_nonempty check (btrim(external_job_id) <> ''),
  constraint job_sources_url_https check (source_url ~ '^https://'),
  constraint job_sources_hash_format check (content_hash ~ '^[a-f0-9]{64}$'),
  constraint job_sources_seen_order check (last_seen_at >= first_seen_at),
  constraint job_sources_verification check ((not is_verified and verified_at is null) or (is_verified and verified_at is not null)),
  unique (source_endpoint_id, external_job_id)
);

create table public.job_snapshots (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  job_source_id bigint not null references public.job_sources (id) on delete cascade,
  content_hash text not null,
  normalized_content jsonb not null,
  captured_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  constraint job_snapshots_hash_format check (content_hash ~ '^[a-f0-9]{64}$'),
  constraint job_snapshots_content_object check (jsonb_typeof(normalized_content) = 'object'),
  constraint job_snapshots_expiry_order check (expires_at > captured_at),
  unique (job_source_id, content_hash)
);

create table public.job_scores (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  job_id bigint not null references public.jobs (id) on delete cascade,
  domain_fit smallint not null,
  skill_fit smallint not null,
  evidence_fit smallint not null,
  location_fit smallint not null,
  eligibility_freshness smallint not null,
  total_score smallint generated always as (
    domain_fit + skill_fit + evidence_fit + location_fit + eligibility_freshness
  ) stored,
  explanation_inputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_scores_domain_range check (domain_fit between 0 and 30),
  constraint job_scores_skill_range check (skill_fit between 0 and 30),
  constraint job_scores_evidence_range check (evidence_fit between 0 and 20),
  constraint job_scores_location_range check (location_fit between 0 and 10),
  constraint job_scores_eligibility_range check (eligibility_freshness between 0 and 10),
  constraint job_scores_explanation_object check (jsonb_typeof(explanation_inputs) = 'object'),
  unique (job_id)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  job_id bigint not null references public.jobs (id) on delete restrict,
  state public.application_state not null default 'not_started',
  notes text,
  queued_at timestamptz,
  submitted_at timestamptz,
  manual_submission_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_submission_confirmation check (
    (submitted_at is null and manual_submission_confirmed_at is null)
    or (submitted_at is not null and manual_submission_confirmed_at is not null)
  ),
  unique (owner_id, job_id)
);

create table public.application_packages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  state public.package_state not null default 'draft',
  resume_path text,
  cover_letter_path text,
  answer_manifest jsonb not null default '{}'::jsonb,
  evidence_manifest jsonb not null default '[]'::jsonb,
  verified_at timestamptz,
  superseded_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint application_packages_answer_object check (jsonb_typeof(answer_manifest) = 'object'),
  constraint application_packages_evidence_array check (jsonb_typeof(evidence_manifest) = 'array'),
  constraint application_packages_expiry_order check (expires_at > created_at)
);

create table public.screening_answers (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  question_fingerprint text not null,
  normalized_question text not null,
  approved_answer text not null,
  scope text not null,
  sensitivity public.answer_sensitivity not null,
  confirmed_at timestamptz not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint screening_answers_nonempty check (
    question_fingerprint ~ '^[a-f0-9]{64}$'
    and btrim(normalized_question) <> ''
    and btrim(approved_answer) <> ''
    and btrim(scope) <> ''
  ),
  constraint screening_answers_expiry_order check (expires_at is null or expires_at > confirmed_at),
  unique (owner_id, question_fingerprint, scope)
);

create table public.application_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  event_type text not null,
  from_state public.application_state,
  to_state public.application_state,
  sanitized_detail jsonb not null default '{}'::jsonb,
  actor_type text not null,
  created_at timestamptz not null default now(),
  constraint application_events_type_nonempty check (btrim(event_type) <> '' and btrim(actor_type) <> ''),
  constraint application_events_detail_object check (jsonb_typeof(sanitized_detail) = 'object')
);

create table public.email_outbox (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  logical_event_key text not null,
  message_type text not null,
  recipient text not null,
  payload jsonb not null,
  state public.email_outbox_state not null default 'pending',
  attempts smallint not null default 0,
  max_attempts smallint not null default 5,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_outbox_nonempty check (
    btrim(logical_event_key) <> '' and btrim(message_type) <> '' and btrim(recipient) <> ''
  ),
  constraint email_outbox_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint email_outbox_attempts check (attempts >= 0 and max_attempts between 1 and 10 and attempts <= max_attempts),
  constraint email_outbox_expiry_order check (expires_at > created_at),
  unique (owner_id, logical_event_key)
);

create table public.email_deliveries (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  outbox_id bigint not null references public.email_outbox (id) on delete cascade,
  resend_message_id text not null,
  state public.delivery_state not null default 'sent',
  last_event_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_deliveries_message_nonempty check (btrim(resend_message_id) <> ''),
  unique (resend_message_id),
  unique (outbox_id)
);

create table public.resend_webhook_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  event_id text not null,
  event_type text not null,
  delivery_id bigint references public.email_deliveries (id) on delete set null,
  sanitized_metadata jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  constraint resend_webhook_events_nonempty check (btrim(event_id) <> '' and btrim(event_type) <> ''),
  constraint resend_webhook_events_metadata_object check (jsonb_typeof(sanitized_metadata) = 'object'),
  unique (event_id)
);

create table public.email_suppressions (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  recipient text not null,
  reason text not null,
  source_message_id text,
  created_at timestamptz not null default now(),
  constraint email_suppressions_nonempty check (btrim(recipient) <> '' and btrim(reason) <> ''),
  unique (owner_id, recipient)
);

create table public.device_pairings (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  pairing_code_hash text not null,
  device_label text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint device_pairings_hash_format check (pairing_code_hash ~ '^[a-f0-9]{64}$'),
  constraint device_pairings_label_nonempty check (btrim(device_label) <> ''),
  constraint device_pairings_expiry_order check (expires_at > created_at and expires_at <= created_at + interval '10 minutes'),
  constraint device_pairings_consumed_order check (consumed_at is null or consumed_at >= created_at),
  unique (pairing_code_hash)
);

create table public.device_tokens (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null,
  device_label text not null,
  last_used_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint device_tokens_hash_format check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint device_tokens_label_nonempty check (btrim(device_label) <> ''),
  constraint device_tokens_expiry_order check (expires_at > created_at),
  constraint device_tokens_last_used_order check (last_used_at is null or last_used_at >= created_at),
  constraint device_tokens_revoked_order check (revoked_at is null or revoked_at >= created_at),
  unique (token_hash)
);
