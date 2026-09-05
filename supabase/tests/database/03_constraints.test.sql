begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(11);

select lives_ok($$select 'career_page'::public.ats_type$$, 'career pages are a supported source type');
select lives_ok($$select 'browser'::public.source_render_mode$$, 'browser rendering is a supported source mode');
select throws_ok(
  $$select 'interactive'::public.source_render_mode$$,
  '22P02',
  'invalid input value for enum source_render_mode: "interactive"',
  'unknown source render modes are rejected'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '30000000-0000-0000-0000-000000000003',
  'authenticated', 'authenticated', 'constraints@example.invalid', '', now(), '{}', '{}', now(), now()
);

insert into public.profiles (owner_id) values ('30000000-0000-0000-0000-000000000003');
insert into public.companies (owner_id, name, tier, career_url)
values ('30000000-0000-0000-0000-000000000003', 'Example Dynamics', 'A', 'https://dynamics.example.invalid/careers');
insert into public.jobs (owner_id, company_id, employer_name, title, normalized_title, canonical_url)
select '30000000-0000-0000-0000-000000000003', id, 'Example Dynamics', 'Robotics Intern', 'robotics intern', 'https://dynamics.example.invalid/jobs/1'
from public.companies where name = 'Example Dynamics';

select throws_ok(
  $$insert into public.job_scores (
      owner_id, job_id, domain_fit, skill_fit, evidence_fit, location_fit, eligibility_freshness
    ) select '30000000-0000-0000-0000-000000000003', id, 31, 0, 0, 0, 0
      from public.jobs where canonical_url = 'https://dynamics.example.invalid/jobs/1'$$,
  '23514',
  'new row for relation "job_scores" violates check constraint "job_scores_domain_range"',
  'score components cannot exceed their bounds'
);

select lives_ok(
  $$insert into public.job_scores (
      owner_id, job_id, domain_fit, skill_fit, evidence_fit, location_fit, eligibility_freshness
    ) select '30000000-0000-0000-0000-000000000003', id, 30, 30, 20, 10, 10
      from public.jobs where canonical_url = 'https://dynamics.example.invalid/jobs/1'$$,
  'bounded score inserts successfully'
);

select is((select total_score from public.job_scores), 100::smallint, 'total score is generated from components');

insert into public.applications (owner_id, job_id)
select owner_id, id from public.jobs where canonical_url = 'https://dynamics.example.invalid/jobs/1';

select throws_ok(
  $$update public.applications set state = 'submitted'$$,
  '23514',
  'invalid application state transition from not_started to submitted',
  'application cannot skip directly to submitted'
);

select lives_ok($$update public.applications set state = 'queued_for_codex'$$, 'valid application transition succeeds');
select is((select count(*) from public.application_events), 1::bigint, 'state transition appends an audit event');

select throws_ok(
  $$update public.application_events set event_type = 'rewritten'$$,
  '55000',
  'application events are append-only',
  'application event updates are rejected'
);

select throws_ok(
  $$delete from public.application_events$$,
  '55000',
  'application events are append-only',
  'application event deletes are rejected'
);

select * from finish();
rollback;
