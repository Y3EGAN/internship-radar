create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function private.validate_job_state_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
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
    or (old.state = 'closed' and new.state in ('needs_verification', 'verified'))
  ) then
    raise exception 'invalid job state transition from % to %', old.state, new.state
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function private.validate_application_state_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
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
$$;

create function private.record_application_state_event()
returns trigger
language plpgsql
set search_path = ''
as $$
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
$$;

create function private.reject_application_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'application events are append-only' using errcode = '55000';
end;
$$;

create function private.delete_expired_data(reference_time timestamptz default now())
returns jsonb
language plpgsql
set search_path = ''
as $$
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
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger profile_evidence_set_updated_at before update on public.profile_evidence
for each row execute function private.set_updated_at();
create trigger companies_set_updated_at before update on public.companies
for each row execute function private.set_updated_at();
create trigger source_endpoints_set_updated_at before update on public.source_endpoints
for each row execute function private.set_updated_at();
create trigger jobs_set_updated_at before update on public.jobs
for each row execute function private.set_updated_at();
create trigger job_sources_set_updated_at before update on public.job_sources
for each row execute function private.set_updated_at();
create trigger job_scores_set_updated_at before update on public.job_scores
for each row execute function private.set_updated_at();
create trigger applications_set_updated_at before update on public.applications
for each row execute function private.set_updated_at();
create trigger application_packages_set_updated_at before update on public.application_packages
for each row execute function private.set_updated_at();
create trigger screening_answers_set_updated_at before update on public.screening_answers
for each row execute function private.set_updated_at();
create trigger email_outbox_set_updated_at before update on public.email_outbox
for each row execute function private.set_updated_at();
create trigger email_deliveries_set_updated_at before update on public.email_deliveries
for each row execute function private.set_updated_at();
create trigger device_tokens_set_updated_at before update on public.device_tokens
for each row execute function private.set_updated_at();

create trigger jobs_validate_state before update of state on public.jobs
for each row execute function private.validate_job_state_transition();
create trigger applications_validate_state before update of state on public.applications
for each row execute function private.validate_application_state_transition();
create trigger applications_record_state after update of state on public.applications
for each row execute function private.record_application_state_event();
create trigger application_events_append_only
before update or delete on public.application_events
for each row execute function private.reject_application_event_mutation();

revoke all on all functions in schema private from public, anon, authenticated;
