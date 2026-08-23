set local check_function_bodies = off;

alter table "public"."profiles"
  drop constraint "profiles_email_caps";

alter table "public"."profiles"
  drop constraint "profiles_resource_limits";

create or replace function public.finish_source_run (
  p_source_run_id bigint
)
  returns public.run_outcome
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_outcome public.run_outcome;
begin
  update public.source_runs run
  set
    finished_at = now(),
    duration_ms = greatest(0, floor(extract(epoch from (now() - run.started_at)) * 1000)::integer),
    outcome = case
      when run.failed_count = 0 then 'succeeded'::public.run_outcome
      when run.succeeded_count = 0 then 'failed'::public.run_outcome
      else 'partial'::public.run_outcome
    end
  where run.id = p_source_run_id and run.outcome = 'running'
  returning run.outcome into v_outcome;

  if not found then
    raise exception 'source run is missing or already finished' using errcode = '55000';
  end if;
  return v_outcome;
end;
$function$;

create or replace function public.record_source_result (
  p_source_run_id      bigint,
  p_source_endpoint_id bigint,
  p_succeeded          boolean,
  p_discovered_count   integer,
  p_changed_count      integer,
  p_sanitized_error    text    default null::text
)
  returns public.source_state
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_owner_id uuid;
  v_source_state public.source_state;
begin
  select run.owner_id into v_owner_id
  from public.source_runs run
  join public.source_endpoints endpoint
    on endpoint.id = p_source_endpoint_id and endpoint.owner_id = run.owner_id
  where run.id = p_source_run_id and run.outcome = 'running';

  if not found then
    raise exception 'active source run and endpoint do not share an owner'
      using errcode = '23503';
  end if;

  update public.source_endpoints endpoint
  set
    last_checked_at = now(),
    last_success_at = case when p_succeeded then now() else endpoint.last_success_at end,
    failure_count = case when p_succeeded then 0 else endpoint.failure_count + 1 end,
    state = case
      when endpoint.state = 'disabled' then 'disabled'::public.source_state
      when p_succeeded then 'healthy'::public.source_state
      when endpoint.failure_count + 1 >= 3 then 'failing'::public.source_state
      else 'degraded'::public.source_state
    end,
    next_due_at = now() + make_interval(secs => endpoint.interval_seconds),
    updated_at = now()
  where endpoint.id = p_source_endpoint_id
  returning endpoint.state into v_source_state;

  update public.source_runs run
  set
    attempted_count = run.attempted_count + 1,
    succeeded_count = run.succeeded_count + case when p_succeeded then 1 else 0 end,
    failed_count = run.failed_count + case when p_succeeded then 0 else 1 end,
    discovered_count = run.discovered_count + greatest(p_discovered_count, 0),
    changed_count = run.changed_count + greatest(p_changed_count, 0),
    sanitized_error = case
      when p_sanitized_error is null then run.sanitized_error
      else left(p_sanitized_error, 500)
    end
  where run.id = p_source_run_id;

  return v_source_state;
end;
$function$;

create or replace function public.start_source_run (
  p_owner_id        uuid,
  p_workflow_run_id text,
  p_partition_key   text
)
  returns bigint
  language sql
  set search_path to ''
  AS $function$
  insert into public.source_runs (owner_id, workflow_run_id, partition_key)
  values (p_owner_id, p_workflow_run_id, p_partition_key)
  on conflict (owner_id, workflow_run_id, partition_key)
  do update set workflow_run_id = excluded.workflow_run_id
  returning id;
$function$;

create or replace function public.upsert_discovered_job (
  p_owner_id              uuid,
  p_source_endpoint_id    bigint,
  p_external_job_id       text,
  p_title                 text,
  p_normalized_title      text,
  p_canonical_url         text,
  p_source_url            text,
  p_description           text,
  p_location_text         text,
  p_normalized_location   text,
  p_role_family           text,
  p_posted_at             timestamp with time zone,
  p_closes_at             timestamp with time zone,
  p_content_hash          text,
  p_verification_state    public.job_state,
  p_domain_fit            smallint,
  p_skill_fit             smallint,
  p_evidence_fit          smallint,
  p_location_fit          smallint,
  p_eligibility_freshness smallint,
  p_explanation_inputs    jsonb
)
  returns table (
    job_id          bigint,
    source_new      boolean,
    content_changed boolean
  )
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_company_id bigint;
  v_job_id bigint;
  v_job_source_id bigint;
  v_source_new boolean := false;
  v_content_changed boolean := false;
begin
  select endpoint.company_id
  into v_company_id
  from public.source_endpoints endpoint
  where endpoint.id = p_source_endpoint_id
    and endpoint.owner_id = p_owner_id
    and endpoint.state <> 'disabled';

  if not found then
    raise exception 'source endpoint is missing, disabled, or belongs to another owner'
      using errcode = '23503';
  end if;

  insert into public.jobs (
    owner_id, company_id, title, normalized_title, canonical_url, description,
    location_text, normalized_location, role_family, state, preliminary_score,
    posted_at, closes_at
  ) values (
    p_owner_id, v_company_id, p_title, p_normalized_title, p_canonical_url, p_description,
    p_location_text, p_normalized_location, p_role_family, p_verification_state,
    p_domain_fit + p_skill_fit + p_evidence_fit + p_location_fit + p_eligibility_freshness,
    p_posted_at, p_closes_at
  )
  on conflict (owner_id, canonical_url) where canonical_url is not null
  do update set
    company_id = excluded.company_id,
    title = excluded.title,
    normalized_title = excluded.normalized_title,
    description = excluded.description,
    location_text = excluded.location_text,
    normalized_location = excluded.normalized_location,
    role_family = excluded.role_family,
    state = case
      when jobs.state in ('shortlisted', 'dismissed', 'closed') then jobs.state
      else excluded.state
    end,
    preliminary_score = excluded.preliminary_score,
    posted_at = coalesce(excluded.posted_at, jobs.posted_at),
    closes_at = excluded.closes_at,
    last_seen_at = now(),
    updated_at = now()
  returning id into v_job_id;

  insert into public.job_sources (
    owner_id, job_id, source_endpoint_id, external_job_id, source_url,
    content_hash, is_verified, verified_at
  ) values (
    p_owner_id, v_job_id, p_source_endpoint_id, p_external_job_id, p_source_url,
    p_content_hash, p_verification_state = 'verified',
    case when p_verification_state = 'verified' then now() else null end
  )
  on conflict (source_endpoint_id, external_job_id) do nothing
  returning id into v_job_source_id;

  if found then
    v_source_new := true;
  else
    update public.job_sources source
    set
      owner_id = p_owner_id,
      job_id = v_job_id,
      source_url = p_source_url,
      last_seen_at = now(),
      content_hash = p_content_hash,
      is_verified = p_verification_state = 'verified',
      verified_at = case when p_verification_state = 'verified' then coalesce(source.verified_at, now()) else null end,
      updated_at = now()
    where source.source_endpoint_id = p_source_endpoint_id
      and source.external_job_id = p_external_job_id
      and source.content_hash <> p_content_hash
    returning source.id into v_job_source_id;

    if found then
      v_content_changed := true;
      insert into public.job_snapshots (owner_id, job_source_id, content_hash, normalized_content)
      values (
        p_owner_id,
        v_job_source_id,
        p_content_hash,
        jsonb_build_object(
          'title', p_title,
          'description', p_description,
          'location', p_location_text,
          'posted_at', p_posted_at,
          'closes_at', p_closes_at
        )
      )
      on conflict (job_source_id, content_hash) do nothing;
    else
      select source.id into v_job_source_id
      from public.job_sources source
      where source.source_endpoint_id = p_source_endpoint_id
        and source.external_job_id = p_external_job_id;
    end if;
  end if;

  insert into public.job_scores (
    owner_id, job_id, domain_fit, skill_fit, evidence_fit, location_fit,
    eligibility_freshness, explanation_inputs
  ) values (
    p_owner_id, v_job_id, p_domain_fit, p_skill_fit, p_evidence_fit, p_location_fit,
    p_eligibility_freshness, p_explanation_inputs
  )
  on conflict (job_id) do update set
    owner_id = excluded.owner_id,
    domain_fit = excluded.domain_fit,
    skill_fit = excluded.skill_fit,
    evidence_fit = excluded.evidence_fit,
    location_fit = excluded.location_fit,
    eligibility_freshness = excluded.eligibility_freshness,
    explanation_inputs = excluded.explanation_inputs,
    updated_at = now();

  return query select v_job_id, v_source_new, v_content_changed;
end;
$function$;

alter table "public"."profiles"
  add constraint "profiles_email_caps"
    check ((((daily_email_cap >= 1) AND (daily_email_cap <= 50)) AND ((monthly_email_cap >= 1) AND (monthly_email_cap <= 2500)) AND (daily_email_cap <= monthly_email_cap)));

alter table "public"."profiles"
  add constraint "profiles_resource_limits"
    check ((((database_soft_limit_mb >= 1) AND (database_soft_limit_mb <= 400)) AND ((storage_soft_limit_mb >= 1) AND (storage_soft_limit_mb <= 800))));

revoke all on function "public"."finish_source_run"(bigint) from public;

grant execute on function "public"."finish_source_run"(bigint) to "postgres", "service_role";

revoke all on function "public"."record_source_result"(bigint, bigint, boolean, integer, integer, text) from public;

grant execute on function "public"."record_source_result"(bigint, bigint, boolean, integer, integer, text) to "postgres", "service_role";

revoke all on function "public"."start_source_run"(uuid, text, text) from public;

grant execute on function "public"."start_source_run"(uuid, text, text) to "postgres", "service_role";

revoke all
  on function "public"."upsert_discovered_job"(uuid, bigint, text, text, text, text, text, text, text, text, text, timestamp with time zone, timestamp
    with time zone, text, public.job_state, smallint, smallint, smallint, smallint, smallint, jsonb)
  from public;

grant execute
  on function "public"."upsert_discovered_job"(uuid, bigint, text, text, text, text, text, text, text, text, text, timestamp with time zone, timestamp
    with time zone, text, public.job_state, smallint, smallint, smallint, smallint, smallint, jsonb)
  to "postgres", "service_role";
