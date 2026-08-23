set local check_function_bodies = off;

alter default privileges for role "postgres" in schema "public" revoke all on sequences from "anon";

alter default privileges for role "postgres" in schema "public" revoke all on sequences from "authenticated";

alter default privileges for role "postgres" in schema "public" revoke all on tables from "anon";

alter default privileges for role "postgres" in schema "public" revoke all on tables from "authenticated";

create schema "private";

create table "public"."application_events" (
  "id"               bigint                   generated always as identity not null,
  "owner_id"         uuid                     not null,
  "application_id"   uuid                     not null,
  "event_type"       text                     not null,
  "sanitized_detail" jsonb                    not null default '{}'::jsonb,
  "actor_type"       text                     not null,
  "created_at"       timestamp with time zone not null default now(),
  constraint "application_events_detail_object" check ((jsonb_typeof(sanitized_detail) = 'object'::text)),
  constraint "application_events_pkey" primary key (id),
  constraint "application_events_type_nonempty" check (((btrim(event_type) <> ''::text) AND (btrim(actor_type) <> ''::text)))
);

alter table "public"."application_events"
  enable row level security;

alter table "public"."application_events"
  force row level security;

create table "public"."application_packages" (
  "id"                uuid                     not null default gen_random_uuid(),
  "owner_id"          uuid                     not null,
  "application_id"    uuid                     not null,
  "resume_path"       text,
  "cover_letter_path" text,
  "answer_manifest"   jsonb                    not null default '{}'::jsonb,
  "evidence_manifest" jsonb                    not null default '[]'::jsonb,
  "verified_at"       timestamp with time zone,
  "superseded_at"     timestamp with time zone,
  "expires_at"        timestamp with time zone not null default (now() + '30 days'::interval),
  "created_at"        timestamp with time zone not null default now(),
  "updated_at"        timestamp with time zone not null default now(),
  constraint "application_packages_answer_object" check ((jsonb_typeof(answer_manifest) = 'object'::text)),
  constraint "application_packages_evidence_array" check ((jsonb_typeof(evidence_manifest) = 'array'::text)),
  constraint "application_packages_expiry_order" check ((expires_at > created_at)),
  constraint "application_packages_pkey" primary key (id)
);

alter table "public"."application_packages"
  enable row level security;

alter table "public"."application_packages"
  force row level security;

create table "public"."applications" (
  "id"                             uuid                     not null default gen_random_uuid(),
  "owner_id"                       uuid                     not null,
  "job_id"                         bigint                   not null,
  "notes"                          text,
  "queued_at"                      timestamp with time zone,
  "submitted_at"                   timestamp with time zone,
  "manual_submission_confirmed_at" timestamp with time zone,
  "created_at"                     timestamp with time zone not null default now(),
  "updated_at"                     timestamp with time zone not null default now(),
  constraint "applications_owner_id_job_id_key" unique (owner_id, job_id),
  constraint "applications_pkey" primary key (id),
  constraint "applications_submission_confirmation" check ((((submitted_at IS NULL) AND (manual_submission_confirmed_at IS NULL)) OR ((submitted_at IS
    NOT NULL) AND (manual_submission_confirmed_at IS NOT NULL))))
);

alter table "public"."applications"
  enable row level security;

alter table "public"."applications"
  force row level security;

create table "public"."companies" (
  "id"         bigint                   generated always as identity not null,
  "owner_id"   uuid                     not null,
  "name"       text                     not null,
  "tier"       text                     not null,
  "priority"   smallint                 not null default 0,
  "is_active"  boolean                  not null default true,
  "career_url" text                     not null,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  constraint "companies_career_url_https" check ((career_url ~ '^https://'::text)),
  constraint "companies_name_nonempty" check ((btrim(name) <> ''::text)),
  constraint "companies_owner_id_name_key" unique (owner_id, name),
  constraint "companies_pkey" primary key (id),
  constraint "companies_priority" check (((priority >= 0) AND (priority <= 100))),
  constraint "companies_tier" check ((tier = ANY (ARRAY['A'::text, 'B'::text, 'C'::text])))
);

alter table "public"."companies"
  enable row level security;

alter table "public"."companies"
  force row level security;

create table "public"."device_pairings" (
  "id"                bigint                   generated always as identity not null,
  "owner_id"          uuid                     not null,
  "pairing_code_hash" text                     not null,
  "device_label"      text                     not null,
  "expires_at"        timestamp with time zone not null,
  "consumed_at"       timestamp with time zone,
  "created_at"        timestamp with time zone not null default now(),
  constraint "device_pairings_consumed_order" check (((consumed_at IS NULL) OR (consumed_at >= created_at))),
  constraint "device_pairings_expiry_order" check (((expires_at > created_at) AND (expires_at <= (created_at + '00:10:00'::interval)))),
  constraint "device_pairings_hash_format" check ((pairing_code_hash ~ '^[a-f0-9]{64}$'::text)),
  constraint "device_pairings_label_nonempty" check ((btrim(device_label) <> ''::text)),
  constraint "device_pairings_pairing_code_hash_key" unique (pairing_code_hash),
  constraint "device_pairings_pkey" primary key (id)
);

alter table "public"."device_pairings"
  enable row level security;

alter table "public"."device_pairings"
  force row level security;

create table "public"."device_tokens" (
  "id"           bigint                   generated always as identity not null,
  "owner_id"     uuid                     not null,
  "token_hash"   text                     not null,
  "device_label" text                     not null,
  "last_used_at" timestamp with time zone,
  "expires_at"   timestamp with time zone not null,
  "revoked_at"   timestamp with time zone,
  "created_at"   timestamp with time zone not null default now(),
  "updated_at"   timestamp with time zone not null default now(),
  constraint "device_tokens_expiry_order" check ((expires_at > created_at)),
  constraint "device_tokens_hash_format" check ((token_hash ~ '^[a-f0-9]{64}$'::text)),
  constraint "device_tokens_label_nonempty" check ((btrim(device_label) <> ''::text)),
  constraint "device_tokens_last_used_order" check (((last_used_at IS NULL) OR (last_used_at >= created_at))),
  constraint "device_tokens_pkey" primary key (id),
  constraint "device_tokens_revoked_order" check (((revoked_at IS NULL) OR (revoked_at >= created_at))),
  constraint "device_tokens_token_hash_key" unique (token_hash)
);

alter table "public"."device_tokens"
  enable row level security;

alter table "public"."device_tokens"
  force row level security;

create table "public"."email_deliveries" (
  "id"                bigint                   generated always as identity not null,
  "owner_id"          uuid                     not null,
  "outbox_id"         bigint                   not null,
  "resend_message_id" text                     not null,
  "last_event_at"     timestamp with time zone not null default now(),
  "created_at"        timestamp with time zone not null default now(),
  "updated_at"        timestamp with time zone not null default now(),
  constraint "email_deliveries_message_nonempty" check ((btrim(resend_message_id) <> ''::text)),
  constraint "email_deliveries_outbox_id_key" unique (outbox_id),
  constraint "email_deliveries_pkey" primary key (id),
  constraint "email_deliveries_resend_message_id_key" unique (resend_message_id)
);

alter table "public"."email_deliveries"
  enable row level security;

alter table "public"."email_deliveries"
  force row level security;

create table "public"."email_outbox" (
  "id"                bigint                   generated always as identity not null,
  "owner_id"          uuid                     not null,
  "logical_event_key" text                     not null,
  "message_type"      text                     not null,
  "recipient"         text                     not null,
  "payload"           jsonb                    not null,
  "attempts"          smallint                 not null default 0,
  "max_attempts"      smallint                 not null default 5,
  "next_attempt_at"   timestamp with time zone not null default now(),
  "sent_at"           timestamp with time zone,
  "expires_at"        timestamp with time zone not null default (now() + '30 days'::interval),
  "last_error_code"   text,
  "created_at"        timestamp with time zone not null default now(),
  "updated_at"        timestamp with time zone not null default now(),
  constraint "email_outbox_attempts" check (((attempts >= 0) AND ((max_attempts >= 1) AND (max_attempts <= 10)) AND (attempts <= max_attempts))),
  constraint "email_outbox_expiry_order" check ((expires_at > created_at)),
  constraint "email_outbox_nonempty" check (((btrim(logical_event_key) <> ''::text) AND (btrim(message_type) <> ''::text) AND (btrim(recipient) <> ''::text))),
  constraint "email_outbox_owner_id_logical_event_key_key" unique (owner_id, logical_event_key),
  constraint "email_outbox_payload_object" check ((jsonb_typeof(payload) = 'object'::text)),
  constraint "email_outbox_pkey" primary key (id)
);

alter table "public"."email_outbox"
  enable row level security;

alter table "public"."email_outbox"
  force row level security;

create table "public"."email_suppressions" (
  "id"                bigint                   generated always as identity not null,
  "owner_id"          uuid                     not null,
  "recipient"         text                     not null,
  "reason"            text                     not null,
  "source_message_id" text,
  "created_at"        timestamp with time zone not null default now(),
  constraint "email_suppressions_nonempty" check (((btrim(recipient) <> ''::text) AND (btrim(reason) <> ''::text))),
  constraint "email_suppressions_owner_id_recipient_key" unique (owner_id, recipient),
  constraint "email_suppressions_pkey" primary key (id)
);

alter table "public"."email_suppressions"
  enable row level security;

alter table "public"."email_suppressions"
  force row level security;

create table "public"."job_scores" (
  "id"                    bigint                   generated always as identity not null,
  "owner_id"              uuid                     not null,
  "job_id"                bigint                   not null,
  "domain_fit"            smallint                 not null,
  "skill_fit"             smallint                 not null,
  "evidence_fit"          smallint                 not null,
  "location_fit"          smallint                 not null,
  "eligibility_freshness" smallint                 not null,
  "explanation_inputs"    jsonb                    not null default '{}'::jsonb,
  "created_at"            timestamp with time zone not null default now(),
  "updated_at"            timestamp with time zone not null default now(),
  constraint "job_scores_domain_range" check (((domain_fit >= 0) AND (domain_fit <= 30))),
  constraint "job_scores_eligibility_range" check (((eligibility_freshness >= 0) AND (eligibility_freshness <= 10))),
  constraint "job_scores_evidence_range" check (((evidence_fit >= 0) AND (evidence_fit <= 20))),
  constraint "job_scores_explanation_object" check ((jsonb_typeof(explanation_inputs) = 'object'::text)),
  constraint "job_scores_job_id_key" unique (job_id),
  constraint "job_scores_location_range" check (((location_fit >= 0) AND (location_fit <= 10))),
  constraint "job_scores_pkey" primary key (id),
  constraint "job_scores_skill_range" check (((skill_fit >= 0) AND (skill_fit <= 30)))
);

alter table "public"."job_scores"
  enable row level security;

alter table "public"."job_scores"
  force row level security;

create table "public"."job_snapshots" (
  "id"                 bigint                   generated always as identity not null,
  "owner_id"           uuid                     not null,
  "job_source_id"      bigint                   not null,
  "content_hash"       text                     not null,
  "normalized_content" jsonb                    not null,
  "captured_at"        timestamp with time zone not null default now(),
  "expires_at"         timestamp with time zone not null default (now() + '90 days'::interval),
  constraint "job_snapshots_content_object" check ((jsonb_typeof(normalized_content) = 'object'::text)),
  constraint "job_snapshots_expiry_order" check ((expires_at > captured_at)),
  constraint "job_snapshots_hash_format" check ((content_hash ~ '^[a-f0-9]{64}$'::text)),
  constraint "job_snapshots_job_source_id_content_hash_key" unique (job_source_id, content_hash),
  constraint "job_snapshots_pkey" primary key (id)
);

alter table "public"."job_snapshots"
  enable row level security;

alter table "public"."job_snapshots"
  force row level security;

create table "public"."job_sources" (
  "id"                 bigint                   generated always as identity not null,
  "owner_id"           uuid                     not null,
  "job_id"             bigint                   not null,
  "source_endpoint_id" bigint                   not null,
  "external_job_id"    text                     not null,
  "source_url"         text                     not null,
  "first_seen_at"      timestamp with time zone not null default now(),
  "last_seen_at"       timestamp with time zone not null default now(),
  "content_hash"       text                     not null,
  "is_verified"        boolean                  not null default false,
  "verified_at"        timestamp with time zone,
  "created_at"         timestamp with time zone not null default now(),
  "updated_at"         timestamp with time zone not null default now(),
  constraint "job_sources_external_id_nonempty" check ((btrim(external_job_id) <> ''::text)),
  constraint "job_sources_hash_format" check ((content_hash ~ '^[a-f0-9]{64}$'::text)),
  constraint "job_sources_pkey" primary key (id),
  constraint "job_sources_seen_order" check ((last_seen_at >= first_seen_at)),
  constraint "job_sources_source_endpoint_id_external_job_id_key" unique (source_endpoint_id, external_job_id),
  constraint "job_sources_url_https" check ((source_url ~ '^https://'::text)),
  constraint "job_sources_verification" check ((((NOT is_verified) AND (verified_at IS NULL)) OR (is_verified AND (verified_at IS NOT NULL))))
);

alter table "public"."job_sources"
  enable row level security;

alter table "public"."job_sources"
  force row level security;

create table "public"."jobs" (
  "id"                  bigint                   generated always as identity not null,
  "owner_id"            uuid                     not null,
  "company_id"          bigint,
  "title"               text                     not null,
  "normalized_title"    text                     not null,
  "canonical_url"       text,
  "description"         text,
  "location_text"       text,
  "normalized_location" text,
  "role_family"         text,
  "preliminary_score"   numeric(5,2)             not null default 0,
  "posted_at"           timestamp with time zone,
  "closes_at"           timestamp with time zone,
  "discovered_at"       timestamp with time zone not null default now(),
  "last_seen_at"        timestamp with time zone not null default now(),
  "created_at"          timestamp with time zone not null default now(),
  "updated_at"          timestamp with time zone not null default now(),
  constraint "jobs_canonical_https" check (((canonical_url IS NULL) OR (canonical_url ~ '^https://'::text))),
  constraint "jobs_date_order" check (((closes_at IS NULL) OR (posted_at IS NULL) OR (closes_at >= posted_at))),
  constraint "jobs_pkey" primary key (id),
  constraint "jobs_score_range" check (((preliminary_score >= (0)::numeric) AND (preliminary_score <= (100)::numeric))),
  constraint "jobs_seen_order" check ((last_seen_at >= discovered_at)),
  constraint "jobs_title_nonempty" check (((btrim(title) <> ''::text) AND (btrim(normalized_title) <> ''::text)))
);

alter table "public"."jobs"
  enable row level security;

alter table "public"."jobs"
  force row level security;

create table "public"."profile_evidence" (
  "id"               bigint                   generated always as identity not null,
  "owner_id"         uuid                     not null,
  "evidence_type"    text                     not null,
  "label"            text                     not null,
  "fact"             text                     not null,
  "source_reference" text                     not null,
  "verified_at"      timestamp with time zone not null,
  "expires_at"       timestamp with time zone,
  "created_at"       timestamp with time zone not null default now(),
  "updated_at"       timestamp with time zone not null default now(),
  constraint "profile_evidence_expiry_order" check (((expires_at IS NULL) OR (expires_at > verified_at))),
  constraint "profile_evidence_nonempty"
    check (((btrim(evidence_type) <> ''::text) AND (btrim(label) <> ''::text) AND (btrim(fact) <> ''::text) AND (btrim(source_reference) <> ''::text))),
  constraint "profile_evidence_owner_id_source_reference_fact_key" unique (owner_id, source_reference, fact),
  constraint "profile_evidence_pkey" primary key (id)
);

alter table "public"."profile_evidence"
  enable row level security;

alter table "public"."profile_evidence"
  force row level security;

create table "public"."profiles" (
  "owner_id"                uuid                     not null,
  "targeting_criteria"      jsonb                    not null default '{}'::jsonb,
  "contact_preferences"     jsonb                    not null default '{}'::jsonb,
  "alert_settings"          jsonb                    not null default '{}'::jsonb,
  "non_contact_preferences" jsonb                    not null default '{}'::jsonb,
  "daily_email_cap"         smallint                 not null default 50,
  "monthly_email_cap"       smallint                 not null default 2500,
  "database_soft_limit_mb"  integer                  not null default 400,
  "storage_soft_limit_mb"   integer                  not null default 800,
  "created_at"              timestamp with time zone not null default now(),
  "updated_at"              timestamp with time zone not null default now(),
  constraint "profiles_alert_object" check ((jsonb_typeof(alert_settings) = 'object'::text)),
  constraint "profiles_contact_object" check ((jsonb_typeof(contact_preferences) = 'object'::text)),
  constraint "profiles_email_caps"
    check ((((daily_email_cap >= 1) AND (daily_email_cap <= 50)) AND ((monthly_email_cap >= 1) AND (monthly_email_cap <= 2500)) AND (daily_email_cap <= monthly_email_cap))),
  constraint "profiles_non_contact_object" check ((jsonb_typeof(non_contact_preferences) = 'object'::text)),
  constraint "profiles_pkey" primary key (owner_id),
  constraint "profiles_resource_limits"
    check ((((database_soft_limit_mb >= 1) AND (database_soft_limit_mb <= 400)) AND ((storage_soft_limit_mb >= 1) AND (storage_soft_limit_mb <= 800)))),
  constraint "profiles_targeting_object" check ((jsonb_typeof(targeting_criteria) = 'object'::text))
);

alter table "public"."profiles"
  enable row level security;

alter table "public"."profiles"
  force row level security;

create table "public"."resend_webhook_events" (
  "id"                 bigint                   generated always as identity not null,
  "owner_id"           uuid                     not null,
  "event_id"           text                     not null,
  "event_type"         text                     not null,
  "delivery_id"        bigint,
  "sanitized_metadata" jsonb                    not null default '{}'::jsonb,
  "processed_at"       timestamp with time zone not null default now(),
  constraint "resend_webhook_events_event_id_key" unique (event_id),
  constraint "resend_webhook_events_metadata_object" check ((jsonb_typeof(sanitized_metadata) = 'object'::text)),
  constraint "resend_webhook_events_nonempty" check (((btrim(event_id) <> ''::text) AND (btrim(event_type) <> ''::text))),
  constraint "resend_webhook_events_pkey" primary key (id)
);

alter table "public"."resend_webhook_events"
  enable row level security;

alter table "public"."resend_webhook_events"
  force row level security;

create table "public"."screening_answers" (
  "id"                   bigint                   generated always as identity not null,
  "owner_id"             uuid                     not null,
  "question_fingerprint" text                     not null,
  "normalized_question"  text                     not null,
  "approved_answer"      text                     not null,
  "scope"                text                     not null,
  "confirmed_at"         timestamp with time zone not null,
  "expires_at"           timestamp with time zone,
  "created_at"           timestamp with time zone not null default now(),
  "updated_at"           timestamp with time zone not null default now(),
  constraint "screening_answers_expiry_order" check (((expires_at IS NULL) OR (expires_at > confirmed_at))),
  constraint "screening_answers_nonempty"
    check (((question_fingerprint ~ '^[a-f0-9]{64}$'::text) AND (btrim(normalized_question) <> ''::text) AND (btrim(approved_answer) <> ''::text) AND (btrim(scope) <> ''::text))),
  constraint "screening_answers_owner_id_question_fingerprint_scope_key" unique (owner_id, question_fingerprint, scope),
  constraint "screening_answers_pkey" primary key (id)
);

alter table "public"."screening_answers"
  enable row level security;

alter table "public"."screening_answers"
  force row level security;

create table "public"."source_endpoints" (
  "id"               bigint                   generated always as identity not null,
  "owner_id"         uuid                     not null,
  "company_id"       bigint,
  "board_identifier" text                     not null,
  "endpoint_url"     text                     not null,
  "interval_seconds" integer                  not null,
  "next_due_at"      timestamp with time zone not null default now(),
  "last_checked_at"  timestamp with time zone,
  "last_success_at"  timestamp with time zone,
  "failure_count"    integer                  not null default 0,
  "disabled_reason"  text,
  "verified_at"      timestamp with time zone,
  "created_at"       timestamp with time zone not null default now(),
  "updated_at"       timestamp with time zone not null default now(),
  constraint "source_endpoints_board_nonempty" check ((btrim(board_identifier) <> ''::text)),
  constraint "source_endpoints_failure_count" check ((failure_count >= 0)),
  constraint "source_endpoints_https" check ((endpoint_url ~ '^https://'::text)),
  constraint "source_endpoints_interval" check (((interval_seconds >= 300) AND (interval_seconds <= 86400))),
  constraint "source_endpoints_pkey" primary key (id)
);

alter table "public"."source_endpoints"
  enable row level security;

alter table "public"."source_endpoints"
  force row level security;

create table "public"."source_runs" (
  "id"               bigint                   generated always as identity not null,
  "owner_id"         uuid                     not null,
  "workflow_run_id"  text,
  "partition_key"    text                     not null,
  "started_at"       timestamp with time zone not null default now(),
  "finished_at"      timestamp with time zone,
  "duration_ms"      integer,
  "attempted_count"  integer                  not null default 0,
  "succeeded_count"  integer                  not null default 0,
  "failed_count"     integer                  not null default 0,
  "discovered_count" integer                  not null default 0,
  "changed_count"    integer                  not null default 0,
  "sanitized_error"  text,
  "created_at"       timestamp with time zone not null default now(),
  constraint "source_runs_counts"
    check
    (((attempted_count >= 0) AND (succeeded_count >= 0) AND (failed_count >= 0) AND (discovered_count >= 0) AND (changed_count >= 0) AND ((succeeded_count + failed_count) <=
    attempted_count))),
  constraint "source_runs_duration" check (((duration_ms IS NULL) OR (duration_ms >= 0))),
  constraint "source_runs_finish_order" check (((finished_at IS NULL) OR (finished_at >= started_at))),
  constraint "source_runs_owner_id_workflow_run_id_partition_key_key" unique (owner_id, workflow_run_id, partition_key),
  constraint "source_runs_pkey" primary key (id)
);

alter table "public"."source_runs"
  enable row level security;

alter table "public"."source_runs"
  force row level security;

alter table "public"."job_scores"
  add column "total_score" smallint generated always as (((((domain_fit + skill_fit) + evidence_fit) + location_fit) + eligibility_freshness)) stored;

create type "public"."answer_sensitivity" as enum (
  'safe_reuse',
  'contextual',
  'never_infer'
);

alter table "public"."screening_answers"
  add column "sensitivity" public.answer_sensitivity not null;

create type "public"."application_state" as enum (
  'not_started',
  'queued_for_codex',
  'preparing',
  'needs_input',
  'package_ready',
  'filling',
  'ready_for_review',
  'submitted',
  'interviewing',
  'rejected',
  'withdrawn',
  'offer',
  'failed'
);

alter table "public"."application_events"
  add column "from_state" public.application_state;

alter table "public"."application_events"
  add column "to_state" public.application_state;

alter table "public"."applications"
  add column "state" public.application_state not null default 'not_started'::public.application_state;

create type "public"."ats_type" as enum (
  'greenhouse',
  'lever',
  'ashby',
  'workday',
  'smartrecruiters',
  'hosted_json',
  'simplify',
  'secondary'
);

alter table "public"."source_endpoints"
  add column "ats" public.ats_type not null;

create type "public"."delivery_state" as enum (
  'sent',
  'delivered',
  'delivery_delayed',
  'bounced',
  'complained',
  'suppressed'
);

alter table "public"."email_deliveries"
  add column "state" public.delivery_state not null default 'sent'::public.delivery_state;

create type "public"."email_outbox_state" as enum (
  'pending',
  'sending',
  'sent',
  'delivered',
  'retry_wait',
  'suppressed',
  'failed'
);

alter table "public"."email_outbox"
  add column "state" public.email_outbox_state not null default 'pending'::public.email_outbox_state;

create type "public"."job_state" as enum (
  'discovered',
  'needs_verification',
  'verified',
  'shortlisted',
  'dismissed',
  'closed'
);

alter table "public"."jobs"
  add column "state" public.job_state not null default 'discovered'::public.job_state;

create type "public"."package_state" as enum (
  'draft',
  'needs_input',
  'rendering',
  'verified',
  'superseded'
);

alter table "public"."application_packages"
  add column "state" public.package_state not null default 'draft'::public.package_state;

create type "public"."run_outcome" as enum (
  'running',
  'succeeded',
  'partial',
  'failed',
  'skipped'
);

alter table "public"."source_runs"
  add column "outcome" public.run_outcome not null default 'running'::public.run_outcome;

create type "public"."source_state" as enum (
  'healthy',
  'degraded',
  'failing',
  'disabled'
);

alter table "public"."source_endpoints"
  add column "state" public.source_state not null default 'healthy'::public.source_state;

create or replace function private.delete_expired_data (
  reference_time timestamp with time zone default now()
)
  returns jsonb
  language plpgsql
  set search_path to ''
  AS $function$
declare
  snapshot_count integer;
  package_count integer;
  payload_count integer;
  delivery_count integer;
  webhook_count integer;
  pairing_count integer;
  token_count integer;
begin
  delete from public.job_snapshots where expires_at <= reference_time;
  get diagnostics snapshot_count = row_count;

  delete from public.application_packages package
  using public.applications application
  where package.application_id = application.id
    and package.expires_at <= reference_time
    and application.submitted_at is null;
  get diagnostics package_count = row_count;

  update public.email_outbox
  set payload = '{}'::jsonb, updated_at = reference_time
  where created_at <= reference_time - interval '30 days'
    and payload <> '{}'::jsonb;
  get diagnostics payload_count = row_count;

  delete from public.email_deliveries
  where created_at <= reference_time - interval '90 days';
  get diagnostics delivery_count = row_count;

  delete from public.resend_webhook_events
  where processed_at <= reference_time - interval '90 days';
  get diagnostics webhook_count = row_count;

  delete from public.device_pairings
  where expires_at <= reference_time;
  get diagnostics pairing_count = row_count;

  delete from public.device_tokens
  where (expires_at <= reference_time or revoked_at <= reference_time - interval '30 days');
  get diagnostics token_count = row_count;

  return jsonb_build_object(
    'job_snapshots', snapshot_count,
    'application_packages', package_count,
    'email_payloads_cleared', payload_count,
    'email_deliveries', delivery_count,
    'webhook_events', webhook_count,
    'device_pairings', pairing_count,
    'device_tokens', token_count
  );
end;
$function$;

create or replace function private.record_application_state_event()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if new.state <> old.state then
    insert into public.application_events (
      owner_id,
      application_id,
      event_type,
      from_state,
      to_state,
      actor_type
    ) values (
      new.owner_id,
      new.id,
      'state_changed',
      old.state,
      new.state,
      current_user
    );
  end if;
  return new;
end;
$function$;

create or replace function private.reject_application_event_mutation()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  raise exception 'application events are append-only' using errcode = '55000';
end;
$function$;

create or replace function private.set_updated_at()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function private.validate_application_state_transition()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if new.state = old.state then
    return new;
  end if;

  if not (
    (old.state = 'not_started' and new.state in ('queued_for_codex', 'withdrawn'))
    or (old.state = 'queued_for_codex' and new.state in ('preparing', 'needs_input', 'failed', 'withdrawn'))
    or (old.state = 'preparing' and new.state in ('needs_input', 'package_ready', 'failed', 'withdrawn'))
    or (old.state = 'needs_input' and new.state in ('queued_for_codex', 'preparing', 'failed', 'withdrawn'))
    or (old.state = 'package_ready' and new.state in ('filling', 'failed', 'withdrawn'))
    or (old.state = 'filling' and new.state in ('needs_input', 'ready_for_review', 'failed', 'withdrawn'))
    or (old.state = 'ready_for_review' and new.state in ('submitted', 'filling', 'needs_input', 'failed', 'withdrawn'))
    or (old.state = 'submitted' and new.state in ('interviewing', 'rejected', 'withdrawn', 'offer'))
    or (old.state = 'interviewing' and new.state in ('rejected', 'withdrawn', 'offer'))
    or (old.state = 'failed' and new.state in ('queued_for_codex', 'filling', 'withdrawn'))
  ) then
    raise exception 'invalid application state transition from % to %', old.state, new.state
      using errcode = '23514';
  end if;

  if new.state = 'submitted'
    and (new.submitted_at is null or new.manual_submission_confirmed_at is null)
  then
    raise exception 'submitted state requires explicit manual submission confirmation'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

create or replace function private.validate_job_state_transition()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if new.state = old.state then
    return new;
  end if;

  if not (
    (old.state = 'discovered' and new.state in ('needs_verification', 'verified', 'dismissed', 'closed'))
    or (old.state = 'needs_verification' and new.state in ('verified', 'dismissed', 'closed'))
    or (old.state = 'verified' and new.state in ('needs_verification', 'shortlisted', 'dismissed', 'closed'))
    or (old.state = 'shortlisted' and new.state in ('verified', 'dismissed', 'closed'))
    or (old.state = 'dismissed' and new.state in ('verified', 'closed'))
    or (old.state = 'closed' and new.state = 'verified')
  ) then
    raise exception 'invalid job state transition from % to %', old.state, new.state
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

alter table "public"."application_events"
  add constraint "application_events_owner_id_fkey" foreign key (owner_id) references auth.users(id) on delete cascade;

alter table "public"."application_packages"
  add constraint "application_packages_owner_id_fkey" foreign key (owner_id) references auth.users(id) on delete cascade;

alter table "public"."applications"
  add constraint "applications_owner_id_fkey" foreign key (owner_id) references auth.users(id) on delete cascade;

alter table "public"."application_events"
  add constraint "application_events_application_id_fkey" foreign key (application_id) references public.applications(id) on delete cascade;

alter table "public"."application_packages"
  add constraint "application_packages_application_id_fkey" foreign key (application_id) references public.applications(id) on delete cascade;

alter table "public"."companies"
  add constraint "companies_owner_id_fkey" foreign key (owner_id) references auth.users(id) on delete cascade;

alter table "public"."device_pairings"
  add constraint "device_pairings_owner_id_fkey" foreign key (owner_id) references auth.users(id) on delete cascade;

alter table "public"."device_tokens"
  add constraint "device_tokens_owner_id_fkey" foreign key (owner_id) references auth.users(id) on delete cascade;

alter table "public"."email_deliveries"
  add constraint "email_deliveries_owner_id_fkey" foreign key (owner_id) references auth.users(id) on delete cascade;

alter table "public"."email_outbox"
  add constraint "email_outbox_owner_id_fkey" foreign key (owner_id) references auth.users(id) on delete cascade;

alter table "public"."email_deliveries"
  add constraint "email_deliveries_outbox_id_fkey" foreign key (outbox_id) references public.email_outbox(id) on delete cascade;

alter table "public"."email_suppressions"
  add constraint "email_suppressions_owner_id_fkey" foreign key (owner_id) references auth.users(id) on delete cascade;

alter table "public"."job_scores"
  add constraint "job_scores_owner_id_fkey" foreign key (owner_id) references auth.users(id) on delete cascade;

alter table "public"."job_snapshots"
  add constraint "job_snapshots_owner_id_fkey" foreign key (owner_id) references auth.users(id) on delete cascade;

alter table "public"."job_sources"
  add constraint "job_sources_owner_id_fkey" foreign key (owner_id) references auth.users(id) on delete cascade;

alter table "public"."job_snapshots"
  add constraint "job_snapshots_job_source_id_fkey" foreign key (job_source_id) references public.job_sources(id) on delete cascade;

alter table "public"."jobs"
  add constraint "jobs_company_id_fkey" foreign key (company_id) references public.companies(id) on delete set null;

alter table "public"."jobs"
  add constraint "jobs_owner_id_fkey" foreign key (owner_id) references auth.users(id) on delete cascade;

alter table "public"."applications"
  add constraint "applications_job_id_fkey" foreign key (job_id) references public.jobs(id) on delete restrict;

alter table "public"."job_scores"
  add constraint "job_scores_job_id_fkey" foreign key (job_id) references public.jobs(id) on delete cascade;

alter table "public"."job_sources"
  add constraint "job_sources_job_id_fkey" foreign key (job_id) references public.jobs(id) on delete cascade;

alter table "public"."profile_evidence"
  add constraint "profile_evidence_owner_id_fkey" foreign key (owner_id) references auth.users(id) on delete cascade;

alter table "public"."profiles"
  add constraint "profiles_owner_id_fkey" foreign key (owner_id) references auth.users(id) on delete cascade;

alter table "public"."resend_webhook_events"
  add constraint "resend_webhook_events_delivery_id_fkey" foreign key (delivery_id) references public.email_deliveries(id) on delete set null;

alter table "public"."resend_webhook_events"
  add constraint "resend_webhook_events_owner_id_fkey" foreign key (owner_id) references auth.users(id) on delete cascade;

alter table "public"."screening_answers"
  add constraint "screening_answers_owner_id_fkey" foreign key (owner_id) references auth.users(id) on delete cascade;

alter table "public"."source_endpoints"
  add constraint "source_endpoints_company_id_fkey" foreign key (company_id) references public.companies(id) on delete cascade;

alter table "public"."source_endpoints"
  add constraint "source_endpoints_disabled_reason" check ((((state = 'disabled'::public.source_state) AND (NULLIF(btrim(disabled_reason), ''::text) IS
    NOT NULL)) OR ((state <> 'disabled'::public.source_state) AND (disabled_reason IS NULL))));

alter table "public"."source_endpoints"
  add constraint "source_endpoints_owner_id_ats_board_identifier_key" unique (owner_id, ats, board_identifier);

alter table "public"."source_endpoints"
  add constraint "source_endpoints_owner_id_fkey" foreign key (owner_id) references auth.users(id) on delete cascade;

alter table "public"."job_sources"
  add constraint "job_sources_source_endpoint_id_fkey" foreign key (source_endpoint_id) references public.source_endpoints(id) on delete cascade;

alter table "public"."source_runs"
  add constraint "source_runs_finished_state"
    check ((((outcome = 'running'::public.run_outcome) AND (finished_at IS NULL)) OR ((outcome <> 'running'::public.run_outcome) AND (finished_at IS NOT NULL))));

alter table "public"."source_runs"
  add constraint "source_runs_owner_id_fkey" foreign key (owner_id) references auth.users(id) on delete cascade;

create index application_events_application_id_idx on public.application_events using btree (application_id);

create index application_events_owner_cursor_idx on public.application_events using btree (owner_id, created_at desc, id desc);

create index application_packages_application_id_idx on public.application_packages using btree (application_id);

create index application_packages_expiry_idx on public.application_packages using btree (expires_at, id);

create index application_packages_owner_id_idx on public.application_packages using btree (owner_id);

create index applications_job_id_idx on public.applications using btree (job_id);

create index applications_owner_state_cursor_idx on public.applications using btree (owner_id, state, updated_at desc, id desc);

create index device_pairings_expiry_idx on public.device_pairings using btree (expires_at, id)
  where (consumed_at is null);

create index device_pairings_owner_id_idx on public.device_pairings using btree (owner_id);

create index device_tokens_active_idx on public.device_tokens using btree (owner_id, expires_at, id)
  where (revoked_at is null);

create index device_tokens_owner_id_idx on public.device_tokens using btree (owner_id);

create index email_deliveries_owner_id_idx on public.email_deliveries using btree (owner_id);

create index email_outbox_due_idx on public.email_outbox using btree (next_attempt_at, id)
  where (state = ANY (ARRAY['pending'::public.email_outbox_state, 'retry_wait'::public.email_outbox_state]));

create index job_scores_owner_id_idx on public.job_scores using btree (owner_id);

create index job_snapshots_expiry_idx on public.job_snapshots using btree (expires_at, id);

create index job_snapshots_owner_id_idx on public.job_snapshots using btree (owner_id);

create index job_sources_job_id_idx on public.job_sources using btree (job_id);

create index job_sources_owner_id_idx on public.job_sources using btree (owner_id);

create index jobs_company_id_idx on public.jobs using btree (company_id);

create index jobs_fingerprint_idx on public.jobs using btree (owner_id, company_id, normalized_title, normalized_location);

create unique index jobs_owner_canonical_url_key on public.jobs using btree (owner_id, canonical_url)
  where (canonical_url is not null);

create index jobs_owner_state_cursor_idx on public.jobs using btree (owner_id, state, discovered_at desc, id desc);

create index resend_webhook_events_delivery_id_idx on public.resend_webhook_events using btree (delivery_id);

create index resend_webhook_events_owner_id_idx on public.resend_webhook_events using btree (owner_id);

create index resend_webhook_events_processed_idx on public.resend_webhook_events using btree (processed_at, id);

create index source_endpoints_company_id_idx on public.source_endpoints using btree (company_id);

create index source_endpoints_due_idx on public.source_endpoints using btree (next_due_at, id)
  where (state <> 'disabled'::public.source_state);

create index source_runs_owner_cursor_idx on public.source_runs using btree (owner_id, started_at desc, id desc);

create trigger application_events_append_only
  before delete or update on public.application_events
  for each row
  execute function private.reject_application_event_mutation();

create trigger application_packages_set_updated_at
  before update on public.application_packages
  for each row
  execute function private.set_updated_at();

create trigger applications_record_state
  after update of state on public.applications
  for each row
  execute function private.record_application_state_event();

create trigger applications_set_updated_at
  before update on public.applications
  for each row
  execute function private.set_updated_at();

create trigger applications_validate_state
  before update of state on public.applications
  for each row
  execute function private.validate_application_state_transition();

create trigger companies_set_updated_at
  before update on public.companies
  for each row
  execute function private.set_updated_at();

create trigger device_tokens_set_updated_at
  before update on public.device_tokens
  for each row
  execute function private.set_updated_at();

create trigger email_deliveries_set_updated_at
  before update on public.email_deliveries
  for each row
  execute function private.set_updated_at();

create trigger email_outbox_set_updated_at
  before update on public.email_outbox
  for each row
  execute function private.set_updated_at();

create trigger job_scores_set_updated_at
  before update on public.job_scores
  for each row
  execute function private.set_updated_at();

create trigger job_sources_set_updated_at
  before update on public.job_sources
  for each row
  execute function private.set_updated_at();

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row
  execute function private.set_updated_at();

create trigger jobs_validate_state
  before update of state on public.jobs
  for each row
  execute function private.validate_job_state_transition();

create trigger profile_evidence_set_updated_at
  before update on public.profile_evidence
  for each row
  execute function private.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function private.set_updated_at();

create trigger screening_answers_set_updated_at
  before update on public.screening_answers
  for each row
  execute function private.set_updated_at();

create trigger source_endpoints_set_updated_at
  before update on public.source_endpoints
  for each row
  execute function private.set_updated_at();

create policy "application_events_owner_insert" on "public"."application_events"
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = owner_id));

create policy "application_events_owner_select" on "public"."application_events"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "application_packages_owner_delete" on "public"."application_packages"
  for delete
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "application_packages_owner_select" on "public"."application_packages"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "applications_owner_delete" on "public"."applications"
  for delete
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "applications_owner_insert" on "public"."applications"
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = owner_id));

create policy "applications_owner_select" on "public"."applications"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "applications_owner_update" on "public"."applications"
  for update
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id))
  with check ((( SELECT auth.uid() AS uid) = owner_id));

create policy "companies_owner_delete" on "public"."companies"
  for delete
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "companies_owner_insert" on "public"."companies"
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = owner_id));

create policy "companies_owner_select" on "public"."companies"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "companies_owner_update" on "public"."companies"
  for update
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id))
  with check ((( SELECT auth.uid() AS uid) = owner_id));

create policy "device_pairings_owner_select" on "public"."device_pairings"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "device_tokens_owner_select" on "public"."device_tokens"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "email_deliveries_owner_select" on "public"."email_deliveries"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "email_outbox_owner_select" on "public"."email_outbox"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "email_suppressions_owner_select" on "public"."email_suppressions"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "job_scores_owner_select" on "public"."job_scores"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "job_snapshots_owner_select" on "public"."job_snapshots"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "job_sources_owner_select" on "public"."job_sources"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "jobs_owner_delete" on "public"."jobs"
  for delete
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "jobs_owner_insert" on "public"."jobs"
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = owner_id));

create policy "jobs_owner_select" on "public"."jobs"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "jobs_owner_update" on "public"."jobs"
  for update
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id))
  with check ((( SELECT auth.uid() AS uid) = owner_id));

create policy "profile_evidence_owner_delete" on "public"."profile_evidence"
  for delete
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "profile_evidence_owner_insert" on "public"."profile_evidence"
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = owner_id));

create policy "profile_evidence_owner_select" on "public"."profile_evidence"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "profile_evidence_owner_update" on "public"."profile_evidence"
  for update
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id))
  with check ((( SELECT auth.uid() AS uid) = owner_id));

create policy "profiles_owner_delete" on "public"."profiles"
  for delete
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "profiles_owner_insert" on "public"."profiles"
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = owner_id));

create policy "profiles_owner_select" on "public"."profiles"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "profiles_owner_update" on "public"."profiles"
  for update
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id))
  with check ((( SELECT auth.uid() AS uid) = owner_id));

create policy "resend_webhook_events_owner_select" on "public"."resend_webhook_events"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "screening_answers_owner_delete" on "public"."screening_answers"
  for delete
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "screening_answers_owner_insert" on "public"."screening_answers"
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = owner_id));

create policy "screening_answers_owner_select" on "public"."screening_answers"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "screening_answers_owner_update" on "public"."screening_answers"
  for update
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id))
  with check ((( SELECT auth.uid() AS uid) = owner_id));

create policy "source_endpoints_owner_delete" on "public"."source_endpoints"
  for delete
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "source_endpoints_owner_insert" on "public"."source_endpoints"
  for insert
  to "authenticated"
  with check ((( SELECT auth.uid() AS uid) = owner_id));

create policy "source_endpoints_owner_select" on "public"."source_endpoints"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

create policy "source_endpoints_owner_update" on "public"."source_endpoints"
  for update
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id))
  with check ((( SELECT auth.uid() AS uid) = owner_id));

create policy "source_runs_owner_select" on "public"."source_runs"
  for select
  to "authenticated"
  using ((( select auth.uid() as uid) = owner_id));

revoke all on function "private"."delete_expired_data"(timestamp with time zone) from public;

grant execute on function "private"."delete_expired_data"(timestamp with time zone) to "postgres", "service_role";

revoke all on function "private"."record_application_state_event"() from public;

grant execute on function "private"."record_application_state_event"() to "postgres";

revoke all on function "private"."reject_application_event_mutation"() from public;

grant execute on function "private"."reject_application_event_mutation"() to "postgres";

revoke all on function "private"."set_updated_at"() from public;

grant execute on function "private"."set_updated_at"() to "postgres";

revoke all on function "private"."validate_application_state_transition"() from public;

grant execute on function "private"."validate_application_state_transition"() to "postgres";

revoke all on function "private"."validate_job_state_transition"() from public;

grant execute on function "private"."validate_job_state_transition"() to "postgres";

grant create, usage on schema "private" to "postgres";

grant usage on schema "private" to "service_role";

grant insert, select on table "public"."application_events" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."application_events" to "postgres", "service_role";

grant delete, select on table "public"."application_packages" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."application_packages" to "postgres", "service_role";

grant delete, insert, select, update on table "public"."applications" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."applications" to "postgres", "service_role";

grant delete, insert, select, update on table "public"."companies" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."companies" to "postgres", "service_role";

grant select on table "public"."device_pairings" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."device_pairings" to "postgres", "service_role";

grant select on table "public"."device_tokens" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."device_tokens" to "postgres", "service_role";

grant select on table "public"."email_deliveries" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."email_deliveries" to "postgres", "service_role";

grant select on table "public"."email_outbox" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."email_outbox" to "postgres", "service_role";

grant select on table "public"."email_suppressions" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."email_suppressions" to "postgres", "service_role";

grant select on table "public"."job_scores" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."job_scores" to "postgres", "service_role";

grant select on table "public"."job_snapshots" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."job_snapshots" to "postgres", "service_role";

grant select on table "public"."job_sources" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."job_sources" to "postgres", "service_role";

grant delete, insert, select, update on table "public"."jobs" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."jobs" to "postgres", "service_role";

grant delete, insert, select, update on table "public"."profile_evidence" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."profile_evidence" to "postgres", "service_role";

grant delete, insert, select, update on table "public"."profiles" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."profiles" to "postgres", "service_role";

grant select on table "public"."resend_webhook_events" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."resend_webhook_events" to "postgres", "service_role";

grant delete, insert, select, update on table "public"."screening_answers" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."screening_answers" to "postgres", "service_role";

grant delete, insert, select, update on table "public"."source_endpoints" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."source_endpoints" to "postgres", "service_role";

grant select on table "public"."source_runs" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."source_runs" to "postgres", "service_role";

grant usage on type "public"."answer_sensitivity" to "postgres";

grant usage on type "public"."application_state" to "postgres";

grant usage on type "public"."ats_type" to "postgres";

grant usage on type "public"."delivery_state" to "postgres";

grant usage on type "public"."email_outbox_state" to "postgres";

grant usage on type "public"."job_state" to "postgres";

grant usage on type "public"."package_state" to "postgres";

grant usage on type "public"."run_outcome" to "postgres";

grant usage on type "public"."source_state" to "postgres";
