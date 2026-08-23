begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'other@example.invalid', '', now(), '{}', '{}', now(), now());

insert into public.profiles (owner_id) values
  ('10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002');

insert into public.companies (owner_id, name, tier, career_url) values
  ('10000000-0000-0000-0000-000000000001', 'Example Robotics One', 'A', 'https://one.example.invalid/careers'),
  ('20000000-0000-0000-0000-000000000002', 'Example Robotics Two', 'B', 'https://two.example.invalid/careers');

set local role anon;
select throws_ok(
  $$select count(*) from public.profiles$$,
  '42501',
  'permission denied for table profiles',
  'anonymous cannot read profiles'
);
select throws_ok(
  $$select count(*) from public.companies$$,
  '42501',
  'permission denied for table companies',
  'anonymous cannot read companies'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select is((select count(*) from public.profiles), 1::bigint, 'owner sees only own profile');
select is((select count(*) from public.companies), 1::bigint, 'owner sees only own company');

select lives_ok(
  $$insert into public.profile_evidence (
      owner_id, evidence_type, label, fact, source_reference, verified_at
    ) values (
      '10000000-0000-0000-0000-000000000001', 'project', 'Fixture project',
      'Built a fictional test robot.', 'fixture/project-1', now()
    )$$,
  'owner can insert owned evidence'
);

select throws_ok(
  $$insert into public.profile_evidence (
      owner_id, evidence_type, label, fact, source_reference, verified_at
    ) values (
      '20000000-0000-0000-0000-000000000002', 'project', 'Cross-owner project',
      'This row must be rejected.', 'fixture/project-2', now()
    )$$,
  '42501',
  'new row violates row-level security policy for table "profile_evidence"',
  'owner cannot insert evidence for another owner'
);

select results_eq(
  $$update public.companies set priority = 10
    where owner_id = '20000000-0000-0000-0000-000000000002'
    returning priority$$,
  array[]::smallint[],
  'owner cannot update another owner row'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select is((select count(*) from public.profiles), 1::bigint, 'non-owner account sees only its own profile');
select is((select count(*) from public.profile_evidence), 0::bigint, 'non-owner account cannot see owner evidence');
reset role;

set local role service_role;
select is((select count(*) from public.profiles), 2::bigint, 'privileged worker sees all profiles');
select is((select count(*) from public.companies), 2::bigint, 'privileged worker sees all companies');
select is((select count(*) from public.profile_evidence), 1::bigint, 'privileged worker sees owner evidence');
reset role;

select * from finish();
rollback;
