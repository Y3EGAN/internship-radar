begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(17);

insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('00000000-0000-0000-0000-000000000000','90000000-0000-0000-0000-000000000009','authenticated','authenticated','preparation-owner@example.invalid','',now(),'{}','{}',now(),now());
insert into public.profiles(owner_id) values ('90000000-0000-0000-0000-000000000009');
insert into public.profile_evidence(owner_id,evidence_type,label,fact,source_reference,verified_at)
values ('90000000-0000-0000-0000-000000000009','project','Fixture telemetry','Built a TypeScript telemetry dashboard that reduced triage time by 20%.','fixture/evidence/telemetry',now());
insert into public.companies(owner_id,name,tier,career_url)
values ('90000000-0000-0000-0000-000000000009','Preparation Fixture Robotics','A','https://prepare.example.invalid/careers');
insert into public.source_endpoints(owner_id,company_id,ats,board_identifier,endpoint_url,interval_seconds)
select owner_id,id,'greenhouse','preparation-fixture','https://prepare.example.invalid/jobs.json',900 from public.companies where name='Preparation Fixture Robotics';
insert into public.jobs(owner_id,company_id,employer_name,title,normalized_title,canonical_url,state,preliminary_score)
select owner_id,id,name,'Verified Internship','verified internship','https://prepare.example.invalid/jobs/verified','verified'::public.job_state,85 from public.companies where name='Preparation Fixture Robotics'
union all
select owner_id,id,name,'Second Verified Internship','second verified internship','https://prepare.example.invalid/jobs/second','verified'::public.job_state,84 from public.companies where name='Preparation Fixture Robotics'
union all
select owner_id,id,name,'Unverified Internship','unverified internship','https://prepare.example.invalid/jobs/unverified','discovered'::public.job_state,70 from public.companies where name='Preparation Fixture Robotics';
insert into public.job_sources(owner_id,job_id,source_endpoint_id,external_job_id,source_url,content_hash,is_verified,verified_at)
select job.owner_id,job.id,endpoint.id,'fixture-'||job.id,job.canonical_url,repeat('e',64),true,now()
from public.jobs job join public.source_endpoints endpoint on endpoint.owner_id=job.owner_id
where job.state='verified';

select ok(not has_function_privilege('anon','public.queue_application_preparation(bigint,boolean)','execute'),'anonymous cannot queue preparation');
select ok(has_function_privilege('authenticated','public.queue_application_preparation(bigint,boolean)','execute'),'authenticated owner can execute queue RPC');
select ok(not has_function_privilege('authenticated','public.claim_next_application_preparation(text)','execute'),'browser user cannot claim Codex work');
select ok(has_function_privilege('service_role','public.claim_next_application_preparation(text)','execute'),'service worker can claim Codex work');

set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000009',true);
select lives_ok($$select public.queue_application_preparation((select id from public.jobs where normalized_title='verified internship'),true)$$,'owner explicitly queues a verified job');
select throws_ok($$select public.queue_application_preparation((select id from public.jobs where normalized_title='verified internship'),false)$$,'23505','application already exists for this job','duplicate application is rejected');
select throws_ok($$select public.queue_application_preparation((select id from public.jobs where normalized_title='unverified internship'),false)$$,'23514','job is not verified for preparation','unverified job cannot be queued');
reset role;

set local role service_role;
create temporary table claimed_preparation as select * from public.claim_next_application_preparation('fixture-codex-worker');
select is((select count(*) from claimed_preparation),1::bigint,'one queued application is claimed');
select is((select state from public.applications),'preparing'::public.application_state,'claim atomically transitions to preparing');
select is((select count(*) from public.claim_next_application_preparation('second-worker')),0::bigint,'claimed work cannot be claimed twice');
select throws_ok(
  $$select public.record_application_package((select application_id from claimed_preparation),'outside/resume.docx',null,'{}',jsonb_build_array(jsonb_build_object('claim','fixture','evidenceIds',jsonb_build_array((select id from public.profile_evidence)))))$$,
  '23514','resume path is outside the private application directory','artifacts cannot escape the private owner/application path'
);
select throws_ok(
  $$select public.record_application_package((select application_id from claimed_preparation),(select owner_id||'/'||application_id||'/resume.docx' from claimed_preparation),null,'{}','[{"claim":"invented","evidenceIds":[999999]}]'::jsonb)$$,
  '23514','package contains unsupported or expired evidence','unknown evidence cannot verify a package'
);
select lives_ok(
  $$select public.record_application_package((select application_id from claimed_preparation),(select owner_id||'/'||application_id||'/resume.docx' from claimed_preparation),null,'{"answers":[]}',jsonb_build_array(jsonb_build_object('claim','Supported fixture claim','evidenceIds',jsonb_build_array((select id from public.profile_evidence)))))$$,
  'supported private package is recorded'
);
select is((select state from public.applications),'package_ready'::public.application_state,'verified package transitions the application to package ready');
select is((select state from public.application_packages),'verified'::public.package_state,'package is marked verified');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000009',true);
select public.queue_application_preparation((select id from public.jobs where normalized_title='second verified internship'),false);
reset role;
set local role service_role;
create temporary table second_claim as select * from public.claim_next_application_preparation('fixture-codex-worker');
select lives_ok($$select public.fail_application_preparation((select application_id from second_claim),'[{"fingerprint":"authorization","prompt":"Will you need sponsorship?"}]','needs_owner_input')$$,'sensitive question stops preparation safely');
select is((select state from public.applications where id=(select application_id from second_claim)),'needs_input'::public.application_state,'unresolved sensitive question transitions to needs input');
reset role;

select * from finish();
rollback;
