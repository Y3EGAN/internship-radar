begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'scheduler-owner@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '70000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'scheduler-other@example.invalid', '', now(), '{}', '{}', now(), now());

select has_index(
  'public', 'source_runs', 'source_runs_one_running_per_owner_idx',
  'source runs enforce one active scheduler per owner'
);
select ok(
  not has_function_privilege('authenticated', 'public.try_start_source_run(uuid,text,text)', 'execute'),
  'authenticated users cannot claim the scheduler lock'
);

set local role service_role;

create temporary table scheduler_claim as
select public.try_start_source_run(
  '60000000-0000-0000-0000-000000000006', 'workflow-1', 'all-partitions'
) as run_id;

select isnt((select run_id from scheduler_claim), null::bigint, 'first scheduler cycle claims the owner lock');
select is(
  public.try_start_source_run('60000000-0000-0000-0000-000000000006', 'workflow-2', 'all-partitions'),
  null::bigint,
  'overlapping workflow for the same owner is skipped'
);
select isnt(
  public.try_start_source_run('70000000-0000-0000-0000-000000000007', 'workflow-2', 'all-partitions'),
  null::bigint,
  'a different owner has an independent scheduler lock'
);
select is(
  public.finish_source_run((select run_id from scheduler_claim)),
  'succeeded'::public.run_outcome,
  'claimed scheduler run can finish normally'
);
select isnt(
  public.try_start_source_run('60000000-0000-0000-0000-000000000006', 'workflow-3', 'all-partitions'),
  null::bigint,
  'owner can claim a new cycle after the prior run finishes'
);

update public.source_runs
set started_at = now() - interval '6 minutes'
where owner_id = '60000000-0000-0000-0000-000000000006' and outcome = 'running';
select isnt(
  public.try_start_source_run('60000000-0000-0000-0000-000000000006', 'workflow-4', 'all-partitions'),
  null::bigint,
  'recovery cycle replaces a scheduler lock older than the workflow ceiling'
);
select is(
  (select count(*) from public.source_runs
    where owner_id = '60000000-0000-0000-0000-000000000006'
      and outcome = 'failed' and sanitized_error = 'stale scheduler run recovered'),
  1::bigint,
  'stale scheduler recovery persists a sanitized failed run'
);

reset role;
select * from finish();
rollback;
