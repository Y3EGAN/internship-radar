begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(22);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-00000000000a','authenticated','authenticated','companion-owner@example.invalid','',now(),'{}','{}',now(),now());
insert into public.profiles(owner_id) values('a0000000-0000-0000-0000-00000000000a');
insert into public.companies(owner_id,name,tier,career_url) values('a0000000-0000-0000-0000-00000000000a','Companion Fixture','A','https://companion.example.invalid/careers');
insert into public.jobs(owner_id,company_id,employer_name,title,normalized_title,canonical_url,state)
select owner_id,id,name,'Fixture Application','fixture application','https://boards.greenhouse.io/fixture/jobs/1','verified' from public.companies where name='Companion Fixture';
insert into public.applications(id,owner_id,job_id,state,queued_at)
select 'a1000000-0000-0000-0000-00000000000a',owner_id,id,'package_ready',now() from public.jobs where normalized_title='fixture application';
insert into public.application_packages(owner_id,application_id,state,resume_path,answer_manifest,evidence_manifest,verified_at)
values('a0000000-0000-0000-0000-00000000000a','a1000000-0000-0000-0000-00000000000a','verified','a0000000-0000-0000-0000-00000000000a/a1000000-0000-0000-0000-00000000000a/resume.docx','{}','[]',now());

select ok(not has_function_privilege('anon','public.create_device_pairing(text,text)','execute'),'anonymous cannot create pairings');
select ok(has_function_privilege('authenticated','public.create_device_pairing(text,text)','execute'),'owner can create pairings');
select ok(not (select prosecdef from pg_proc where oid='public.create_device_pairing(text,text)'::regprocedure),'pairing creation uses invoker security');
select ok(not (select prosecdef from pg_proc where oid='public.revoke_device_token(bigint)'::regprocedure),'token revocation uses invoker security');
select ok(not has_function_privilege('authenticated','public.consume_device_pairing(text,text)','execute'),'browser cannot consume pairings directly');
select ok(has_function_privilege('service_role','public.consume_device_pairing(text,text)','execute'),'service API can consume pairings');
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-00000000000a',true);
select lives_ok($$select public.create_device_pairing(repeat('a',64),'Fixture laptop')$$,'owner creates a ten-minute pairing');
select ok((select expires_at<=created_at+interval '10 minutes' from public.device_pairings where pairing_code_hash=repeat('a',64)),'pairing expiry is bounded to ten minutes');
reset role;

set local role service_role;
create temporary table paired_device as select * from public.consume_device_pairing(repeat('a',64),repeat('b',64));
select is((select count(*) from paired_device),1::bigint,'pairing code returns one device token row');
select ok((select consumed_at is not null from public.device_pairings where pairing_code_hash=repeat('a',64)),'pairing code is consumed once');
select is((select token_hash from public.device_tokens),repeat('b',64),'database stores only the supplied token hash');
select throws_ok($$select * from public.consume_device_pairing(repeat('a',64),repeat('c',64))$$,'28000','pairing code is invalid or expired','consumed pairing cannot be reused');
create temporary table companion_claim as select * from public.claim_next_companion_application(repeat('b',64));
select is((select count(*) from companion_claim),1::bigint,'paired device claims one ready package');
select is((select state from public.applications),'filling'::public.application_state,'claim moves package to filling');
select is((select count(*) from public.claim_next_companion_application(repeat('b',64))),0::bigint,'same application cannot be claimed twice');
select is(public.record_companion_event(repeat('b',64),'a1000000-0000-0000-0000-00000000000a','progress','{"fieldCount":4}'),'filling'::public.application_state,'progress remains in filling');
select throws_ok($$select public.record_companion_event(repeat('b',64),'a1000000-0000-0000-0000-00000000000a','final_submit','{}')$$,'22023','unsupported companion event','final submit event is impossible');
select ok((select submitted_at is null from public.applications),'agent cannot record submission');
select is(public.record_companion_event(repeat('b',64),'a1000000-0000-0000-0000-00000000000a','review_ready','{}'),'ready_for_review'::public.application_state,'supported fixture reaches review state');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-00000000000a',true);
select is(public.revoke_device_token((select id from public.device_tokens)),true,'owner revokes the paired device');
reset role;
set local role service_role;
select is((select count(*) from public.authenticate_device_token(repeat('b',64))),0::bigint,'revoked device token no longer authenticates');
insert into public.device_pairings(owner_id,pairing_code_hash,device_label,created_at,expires_at)
values('a0000000-0000-0000-0000-00000000000a',repeat('d',64),'Expired fixture',now()-interval '9 minutes',now()-interval '1 minute');
select throws_ok($$select * from public.consume_device_pairing(repeat('d',64),repeat('e',64))$$,'28000','pairing code is invalid or expired','expired pairing code is rejected');
reset role;
select * from finish();
rollback;
