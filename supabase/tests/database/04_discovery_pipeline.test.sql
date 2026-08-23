begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(24);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '40000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'pipeline-owner@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '50000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'pipeline-other@example.invalid', '', now(), '{}', '{}', now(), now());

insert into public.profiles (owner_id) values
  ('40000000-0000-0000-0000-000000000004'),
  ('50000000-0000-0000-0000-000000000005');

insert into public.companies (owner_id, name, tier, career_url) values
  ('40000000-0000-0000-0000-000000000004', 'Fixture Robotics', 'A', 'https://robotics.example.invalid/careers'),
  ('50000000-0000-0000-0000-000000000005', 'Other Fixture Robotics', 'B', 'https://other.example.invalid/careers');

insert into public.source_endpoints (
  owner_id, company_id, ats, board_identifier, endpoint_url, interval_seconds
)
select owner_id, id, 'greenhouse', 'fixture-robotics', 'https://boards.example.invalid/fixture-robotics', 900
from public.companies where name = 'Fixture Robotics';

select ok(
  not has_function_privilege('authenticated', 'public.start_source_run(uuid,text,text)', 'execute'),
  'authenticated users cannot start privileged source runs'
);
select ok(
  has_function_privilege('service_role', 'public.start_source_run(uuid,text,text)', 'execute'),
  'service role can start source runs'
);

set local role service_role;

create temporary table first_run as
select public.start_source_run(
  '40000000-0000-0000-0000-000000000004', 'fixture-workflow-1', 'partition-a'
) as run_id;

select is(
  public.start_source_run('40000000-0000-0000-0000-000000000004', 'fixture-workflow-1', 'partition-a'),
  (select run_id from first_run),
  'starting the same workflow partition is idempotent'
);
select is((select count(*) from public.source_runs), 1::bigint, 'idempotent start creates one run row');

create temporary table first_upsert as
select * from public.upsert_discovered_job(
  '40000000-0000-0000-0000-000000000004',
  (select id from public.source_endpoints where board_identifier = 'fixture-robotics'),
  'fixture-job-1', 'Robotics Software Intern', 'robotics software intern',
  'https://robotics.example.invalid/jobs/1', 'https://boards.example.invalid/fixture-robotics/jobs/1',
  'Build safe controls for a fictional test robot.', 'Toronto, ON', 'toronto on', 'robotics',
  '2026-08-01T12:00:00Z', '2026-09-01T12:00:00Z', repeat('a', 64), 'verified',
  25::smallint, 24::smallint, 16::smallint, 8::smallint, 9::smallint,
  '{"fixture":true}'::jsonb
);

select is((select source_new from first_upsert), true, 'first observation creates a source record');
select is((select content_changed from first_upsert), false, 'first observation is not a change event');
select is((select count(*) from public.jobs), 1::bigint, 'first observation creates one job');
select is((select count(*) from public.job_sources), 1::bigint, 'first observation creates one source link');
select is((select total_score from public.job_scores), 82::smallint, 'score components persist deterministically');
select is((select count(*) from public.job_snapshots), 0::bigint, 'initial content does not create a change snapshot');

create temporary table unchanged_upsert as
select * from public.upsert_discovered_job(
  '40000000-0000-0000-0000-000000000004',
  (select id from public.source_endpoints where board_identifier = 'fixture-robotics'),
  'fixture-job-1', 'Robotics Software Intern', 'robotics software intern',
  'https://robotics.example.invalid/jobs/1', 'https://boards.example.invalid/fixture-robotics/jobs/1',
  'Build safe controls for a fictional test robot.', 'Toronto, ON', 'toronto on', 'robotics',
  '2026-08-01T12:00:00Z', '2026-09-01T12:00:00Z', repeat('a', 64), 'verified',
  25::smallint, 24::smallint, 16::smallint, 8::smallint, 9::smallint,
  '{"fixture":true}'::jsonb
);

select is((select source_new from unchanged_upsert), false, 'repeat observation reuses its source record');
select is((select content_changed from unchanged_upsert), false, 'unchanged content is not marked changed');
select is((select count(*) from public.jobs), 1::bigint, 'repeat observation does not duplicate the job');

create temporary table changed_upsert as
select * from public.upsert_discovered_job(
  '40000000-0000-0000-0000-000000000004',
  (select id from public.source_endpoints where board_identifier = 'fixture-robotics'),
  'fixture-job-1', 'Robotics Software Intern', 'robotics software intern',
  'https://robotics.example.invalid/jobs/1', 'https://boards.example.invalid/fixture-robotics/jobs/1',
  'Build safe controls and perception for a fictional test robot.', 'Toronto, ON', 'toronto on', 'robotics',
  '2026-08-01T12:00:00Z', '2026-09-01T12:00:00Z', repeat('b', 64), 'verified',
  26::smallint, 24::smallint, 16::smallint, 8::smallint, 9::smallint,
  '{"fixture":true,"revision":2}'::jsonb
);

select is((select content_changed from changed_upsert), true, 'new content hash is marked changed');
select is((select count(*) from public.job_snapshots), 1::bigint, 'changed content creates exactly one snapshot');
select is((select total_score from public.job_scores), 83::smallint, 'changed observation updates its score');

select throws_ok(
  $$select public.upsert_discovered_job(
    '50000000-0000-0000-0000-000000000005',
    (select id from public.source_endpoints where board_identifier = 'fixture-robotics'),
    'foreign-job', 'Foreign Job', 'foreign job', 'https://other.example.invalid/jobs/1',
    'https://other.example.invalid/jobs/1', null, null, null, null, null, null,
    repeat('c', 64), 'discovered', 0::smallint, 0::smallint, 0::smallint, 0::smallint, 0::smallint, '{}'::jsonb
  )$$,
  '23503',
  'source endpoint is missing, disabled, or belongs to another owner',
  'upsert rejects an endpoint owned by another account'
);

select is(
  public.record_source_result(
    (select run_id from first_run),
    (select id from public.source_endpoints where board_identifier = 'fixture-robotics'),
    true, 1, 1, null
  ),
  'healthy'::public.source_state,
  'successful source result keeps the endpoint healthy'
);
select is(
  (select discovered_count from public.source_runs where id = (select run_id from first_run)),
  1,
  'source result updates run discovery counts'
);
select is(
  public.finish_source_run((select run_id from first_run)),
  'succeeded'::public.run_outcome,
  'run with only successful sources finishes succeeded'
);
select is(
  (select outcome from public.source_runs where id = (select run_id from first_run)),
  'succeeded'::public.run_outcome,
  'finished outcome is persisted'
);

create temporary table failure_runs (run_id bigint);
insert into failure_runs values (
  public.start_source_run('40000000-0000-0000-0000-000000000004', 'fixture-failure-1', 'partition-a')
);
select is(
  public.record_source_result(
    (select max(run_id) from failure_runs),
    (select id from public.source_endpoints where board_identifier = 'fixture-robotics'),
    false, 0, 0, 'source returned HTTP 503'
  ),
  'degraded'::public.source_state,
  'first consecutive failure degrades source health'
);
do $$ begin perform public.finish_source_run((select max(run_id) from failure_runs)); end $$;

insert into failure_runs values (
  public.start_source_run('40000000-0000-0000-0000-000000000004', 'fixture-failure-2', 'partition-a')
);
select is(
  public.record_source_result(
    (select max(run_id) from failure_runs),
    (select id from public.source_endpoints where board_identifier = 'fixture-robotics'),
    false, 0, 0, 'source returned HTTP 503'
  ),
  'degraded'::public.source_state,
  'second consecutive failure remains degraded'
);
do $$ begin perform public.finish_source_run((select max(run_id) from failure_runs)); end $$;

insert into failure_runs values (
  public.start_source_run('40000000-0000-0000-0000-000000000004', 'fixture-failure-3', 'partition-a')
);
select is(
  public.record_source_result(
    (select max(run_id) from failure_runs),
    (select id from public.source_endpoints where board_identifier = 'fixture-robotics'),
    false, 0, 0, 'source returned HTTP 503'
  ),
  'failing'::public.source_state,
  'third consecutive failure marks source failing'
);
do $$ begin perform public.finish_source_run((select max(run_id) from failure_runs)); end $$;

reset role;
select * from finish();
rollback;
