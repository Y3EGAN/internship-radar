begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(23);

insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('00000000-0000-0000-0000-000000000000','80000000-0000-0000-0000-000000000008','authenticated','authenticated','email-owner@example.invalid','',now(),'{}','{}',now(),now());
insert into public.profiles(owner_id) values ('80000000-0000-0000-0000-000000000008');
insert into public.companies(owner_id,name,tier,career_url)
values ('80000000-0000-0000-0000-000000000008','Email Fixture Robotics','A','https://email.example.invalid/careers');
insert into public.source_endpoints(owner_id,company_id,ats,board_identifier,endpoint_url,interval_seconds)
select owner_id,id,'greenhouse','email-fixture','https://email.example.invalid/jobs.json',900 from public.companies where name='Email Fixture Robotics';
insert into public.source_runs(owner_id,workflow_run_id,partition_key,outcome,finished_at)
values ('80000000-0000-0000-0000-000000000008','email-run','all','succeeded',now());

select ok(not has_function_privilege('authenticated','public.claim_email_outbox(uuid,integer)','execute'),'authenticated cannot claim email outbox');
set local role service_role;

create temporary table alert_result as select * from public.upsert_discovered_job_with_alert(
  '80000000-0000-0000-0000-000000000008',(select id from public.source_endpoints where board_identifier='email-fixture'),
  'email-job-1','Robotics Intern','robotics intern','https://email.example.invalid/jobs/1','https://email.example.invalid/jobs/1',
  'Build robot controls.','Toronto, ON','toronto on','robotics',now(),now()+interval '30 days',repeat('d',64),'verified',
  25::smallint,25::smallint,15::smallint,8::smallint,8::smallint,'{}'::jsonb,
  (select id from public.source_runs where workflow_run_id='email-run'),'ALERT@EXAMPLE.INVALID'
);
select is((select count(*) from public.email_outbox),1::bigint,'priority job atomically creates one outbox row');
select is((select recipient from public.email_outbox),'alert@example.invalid','recipient is normalized');
select is((select jsonb_array_length(payload->'job_ids') from public.email_outbox),1,'outbox payload contains the job');

select * from public.upsert_discovered_job_with_alert(
  '80000000-0000-0000-0000-000000000008',(select id from public.source_endpoints where board_identifier='email-fixture'),
  'email-job-1','Robotics Intern','robotics intern','https://email.example.invalid/jobs/1','https://email.example.invalid/jobs/1',
  'Build robot controls.','Toronto, ON','toronto on','robotics',now(),now()+interval '30 days',repeat('d',64),'verified',
  25::smallint,25::smallint,15::smallint,8::smallint,8::smallint,'{}'::jsonb,
  (select id from public.source_runs where workflow_run_id='email-run'),'alert@example.invalid'
);
select is((select count(*) from public.email_outbox),1::bigint,'duplicate discovery does not duplicate an email');

create temporary table claimed as select * from public.claim_email_outbox('80000000-0000-0000-0000-000000000008',10);
select is((select count(*) from claimed),1::bigint,'due outbox row is claimed once');
select is((select state from public.email_outbox),'sending'::public.email_outbox_state,'claim transitions row to sending');
select is((select count(*) from public.claim_email_outbox('80000000-0000-0000-0000-000000000008',10)),0::bigint,'duplicate claim cannot send the same outbox row twice');
select lives_ok($$select public.record_email_send((select outbox_id from claimed),'resend-fixture-1')$$,'successful send is recorded');
select is((select count(*) from public.email_deliveries),1::bigint,'delivery metadata is created once');
select is(public.record_resend_webhook('80000000-0000-0000-0000-000000000008','event-delivered','email.delivered','resend-fixture-1','alert@example.invalid','{}'),true,'delivered webhook is accepted');
select is(public.record_resend_webhook('80000000-0000-0000-0000-000000000008','event-delivered','email.delivered','resend-fixture-1','alert@example.invalid','{}'),false,'duplicate webhook is idempotent');
select is((select state from public.email_deliveries),'delivered'::public.delivery_state,'delivery state is updated');

insert into public.email_outbox(owner_id,logical_event_key,message_type,recipient,payload)
values ('80000000-0000-0000-0000-000000000008','retry-fixture','priority_jobs','retry@example.invalid','{}');
create temporary table retry_claim as select * from public.claim_email_outbox('80000000-0000-0000-0000-000000000008',10) where logical_event_key='retry-fixture';
select is(public.record_email_failure((select outbox_id from retry_claim),true,'rate_limit_exceeded'),'retry_wait'::public.email_outbox_state,'retryable failure returns row to durable retry wait');

insert into public.email_outbox(owner_id,logical_event_key,message_type,recipient,payload,state,attempts,sent_at)
values ('80000000-0000-0000-0000-000000000008','bounce-fixture','priority_jobs','bounced@resend.dev','{}','sent',1,now());
insert into public.email_deliveries(owner_id,outbox_id,resend_message_id)
select owner_id,id,'resend-fixture-2' from public.email_outbox where logical_event_key='bounce-fixture';
select is(public.record_resend_webhook('80000000-0000-0000-0000-000000000008','event-bounced','email.bounced','resend-fixture-2','bounced@resend.dev','{}'),true,'bounce webhook is accepted');
select is((select count(*) from public.email_suppressions where recipient='bounced@resend.dev'),1::bigint,'hard bounce suppresses recipient immediately');
select is((select state from public.email_deliveries where resend_message_id='resend-fixture-2'),'bounced'::public.delivery_state,'bounce updates delivery state');

update public.profiles set daily_email_cap = 1 where owner_id = '80000000-0000-0000-0000-000000000008';
insert into public.email_outbox(owner_id,logical_event_key,message_type,recipient,payload)
values
  ('80000000-0000-0000-0000-000000000008','capped-priority-1','priority_jobs','digest@example.invalid','{"job_ids":[101]}'),
  ('80000000-0000-0000-0000-000000000008','capped-priority-2','priority_jobs','digest@example.invalid','{"job_ids":[102]}');
select is((select count(*) from public.claim_email_outbox('80000000-0000-0000-0000-000000000008',10)),0::bigint,'daily cap prevents an immediate send');
select is((select count(*) from public.email_outbox where message_type='daily_digest' and state='pending'),1::bigint,'capped priority messages coalesce into one daily digest');
select is((select jsonb_array_length(payload->'job_ids') from public.email_outbox where message_type='daily_digest'),2,'daily digest preserves all distinct job ids');
select is((select count(*) from public.email_outbox where logical_event_key like 'capped-priority-%' and state='suppressed'),2::bigint,'coalesced priority messages cannot send separately');

insert into public.email_outbox(owner_id,logical_event_key,message_type,recipient,payload,state,attempts,sent_at)
values ('80000000-0000-0000-0000-000000000008','complaint-fixture','priority_jobs','complained@resend.dev','{}','sent',1,now());
insert into public.email_deliveries(owner_id,outbox_id,resend_message_id)
select owner_id,id,'resend-fixture-3' from public.email_outbox where logical_event_key='complaint-fixture';
select is(public.record_resend_webhook('80000000-0000-0000-0000-000000000008','event-complained','email.complained','resend-fixture-3','complained@resend.dev','{}'),true,'complaint webhook is accepted');
select is((select count(*) from public.email_suppressions where recipient='complained@resend.dev'),1::bigint,'complaint suppresses recipient immediately');

reset role;
select * from finish();
rollback;
