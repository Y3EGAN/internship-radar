revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

grant usage on schema public to authenticated, service_role;

grant select on table
  public.profiles,
  public.profile_evidence,
  public.companies,
  public.source_endpoints,
  public.source_runs,
  public.jobs,
  public.job_sources,
  public.link_verifications,
  public.job_snapshots,
  public.job_scores,
  public.applications,
  public.application_packages,
  public.screening_answers,
  public.application_events,
  public.email_outbox,
  public.email_deliveries,
  public.resend_webhook_events,
  public.email_suppressions,
  public.device_pairings,
  public.device_tokens
to authenticated;

grant insert, update, delete on table
  public.profiles,
  public.profile_evidence,
  public.companies,
  public.source_endpoints,
  public.jobs,
  public.applications,
  public.screening_answers
to authenticated;

grant delete on table public.application_packages to authenticated;
grant insert on table public.application_events to authenticated;
grant insert, delete on table public.device_pairings to authenticated;
grant update on table public.device_tokens to authenticated;
revoke all on function public.queue_application_preparation(bigint,boolean) from public, anon, authenticated;
grant execute on function public.queue_application_preparation(bigint,boolean) to authenticated;
revoke all on function public.create_device_pairing(text,text) from public, anon, authenticated;
revoke all on function public.revoke_device_token(bigint) from public, anon, authenticated;
grant execute on function public.create_device_pairing(text,text) to authenticated;
grant execute on function public.revoke_device_token(bigint) to authenticated;

grant usage, select on sequence
  public.profile_evidence_id_seq,
  public.companies_id_seq,
  public.source_endpoints_id_seq,
  public.jobs_id_seq,
  public.screening_answers_id_seq,
  public.application_events_id_seq,
  public.device_pairings_id_seq
to authenticated;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant usage on schema private to service_role;
grant execute on function private.delete_expired_data(timestamptz) to service_role;
grant execute on function public.start_source_run(uuid, text, text) to service_role;
grant execute on function public.try_start_source_run(uuid, text, text) to service_role;
grant execute on function public.upsert_discovered_job(
  uuid, bigint, text, text, text, text, text, text, text, text, text, text,
  timestamptz, timestamptz, text, public.job_state,
  smallint, smallint, smallint, smallint, smallint, jsonb
) to service_role;
grant execute on function public.reconcile_secondary_source(uuid, bigint, text[]) to service_role;
grant execute on function public.record_source_result(bigint, bigint, boolean, integer, integer, text) to service_role;
grant execute on function public.finish_source_run(bigint) to service_role;
grant execute on function public.upsert_discovered_job_with_alert(uuid,bigint,text,text,text,text,text,text,text,text,text,text,timestamptz,timestamptz,text,public.job_state,smallint,smallint,smallint,smallint,smallint,jsonb,bigint,text) to service_role;
grant execute on function public.claim_email_outbox(uuid,integer) to service_role;
grant execute on function public.record_email_send(bigint,text) to service_role;
grant execute on function public.record_email_failure(bigint,boolean,text) to service_role;
grant execute on function public.record_resend_webhook(uuid,text,text,text,text,jsonb) to service_role;
revoke all on function public.claim_next_application_preparation(text) from public, anon, authenticated;
revoke all on function public.record_application_package(uuid,text,text,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.fail_application_preparation(uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.claim_next_application_preparation(text) to service_role;
grant execute on function public.record_application_package(uuid,text,text,jsonb,jsonb) to service_role;
grant execute on function public.fail_application_preparation(uuid,jsonb,text) to service_role;
revoke all on function public.consume_device_pairing(text,text) from public, anon, authenticated;
revoke all on function public.authenticate_device_token(text) from public, anon, authenticated;
revoke all on function public.claim_next_companion_application(text) from public, anon, authenticated;
revoke all on function public.record_companion_event(text,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.consume_device_pairing(text,text) to service_role;
grant execute on function public.authenticate_device_token(text) to service_role;
grant execute on function public.claim_next_companion_application(text) to service_role;
grant execute on function public.record_companion_event(text,uuid,text,jsonb) to service_role;

revoke all on schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
