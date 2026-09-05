create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create type public.job_state as enum (
  'discovered',
  'needs_verification',
  'verified',
  'shortlisted',
  'dismissed',
  'closed'
);

create type public.application_state as enum (
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

create type public.source_state as enum ('healthy', 'degraded', 'failing', 'disabled');
create type public.source_render_mode as enum ('http', 'browser');
create type public.answer_sensitivity as enum ('safe_reuse', 'contextual', 'never_infer');
create type public.email_outbox_state as enum (
  'pending',
  'sending',
  'sent',
  'delivered',
  'retry_wait',
  'suppressed',
  'failed'
);
create type public.run_outcome as enum ('running', 'succeeded', 'partial', 'failed', 'skipped');
create type public.ats_type as enum (
  'greenhouse',
  'lever',
  'ashby',
  'workday',
  'smartrecruiters',
  'hosted_json',
  'simplify',
  'secondary',
  'career_page'
);
create type public.package_state as enum ('draft', 'needs_input', 'rendering', 'verified', 'superseded');
create type public.delivery_state as enum (
  'sent',
  'delivered',
  'delivery_delayed',
  'bounced',
  'complained',
  'suppressed'
);
