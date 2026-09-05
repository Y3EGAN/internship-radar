create function public.start_source_run(
  p_owner_id uuid,
  p_workflow_run_id text,
  p_partition_key text
)
returns bigint
language sql
set search_path = ''
as $$
  insert into public.source_runs (owner_id, workflow_run_id, partition_key)
  values (p_owner_id, p_workflow_run_id, p_partition_key)
  on conflict (owner_id, workflow_run_id, partition_key)
  do update set workflow_run_id = excluded.workflow_run_id
  returning id;
$$;

create function public.try_start_source_run(
  p_owner_id uuid,
  p_workflow_run_id text,
  p_partition_key text
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_run_id bigint;
begin
  update public.source_runs run
  set
    finished_at = now(),
    duration_ms = greatest(0, floor(extract(epoch from (now() - run.started_at)) * 1000)::integer),
    outcome = 'failed',
    sanitized_error = 'stale scheduler run recovered'
  where run.owner_id = p_owner_id
    and run.outcome = 'running'
    and run.started_at < now() - interval '5 minutes';

  insert into public.source_runs (owner_id, workflow_run_id, partition_key)
  values (p_owner_id, p_workflow_run_id, p_partition_key)
  returning id into v_run_id;
  return v_run_id;
exception
  when unique_violation then
    return null;
end;
$$;

create function public.upsert_discovered_job(
  p_owner_id uuid,
  p_source_endpoint_id bigint,
  p_external_job_id text,
  p_employer_name text,
  p_title text,
  p_normalized_title text,
  p_canonical_url text,
  p_source_url text,
  p_description text,
  p_location_text text,
  p_normalized_location text,
  p_role_family text,
  p_posted_at timestamptz,
  p_closes_at timestamptz,
  p_content_hash text,
  p_verification_state public.job_state,
  p_domain_fit smallint,
  p_skill_fit smallint,
  p_evidence_fit smallint,
  p_location_fit smallint,
  p_eligibility_freshness smallint,
  p_explanation_inputs jsonb
)
returns table (job_id bigint, source_new boolean, content_changed boolean)
language plpgsql
set search_path = ''
as $$
declare
  v_company_id bigint;
  v_job_id bigint;
  v_job_source_id bigint;
  v_source_new boolean := false;
  v_content_changed boolean := false;
  v_incoming_secondary boolean := false;
  v_existing_primary boolean := false;
begin
  select
    case when endpoint.ats in ('secondary', 'simplify') then null else endpoint.company_id end,
    endpoint.ats in ('secondary', 'simplify')
  into v_company_id, v_incoming_secondary
  from public.source_endpoints endpoint
  where endpoint.id = p_source_endpoint_id
    and endpoint.owner_id = p_owner_id
    and endpoint.state <> 'disabled';

  if not found then
    raise exception 'source endpoint is missing, disabled, or belongs to another owner'
      using errcode = '23503';
  end if;

  select exists (
    select 1
    from public.jobs existing_job
    join public.job_sources existing_source on existing_source.job_id = existing_job.id
    join public.source_endpoints existing_endpoint on existing_endpoint.id = existing_source.source_endpoint_id
    where existing_job.owner_id = p_owner_id
      and existing_job.canonical_url = p_canonical_url
      and existing_source.is_verified
      and existing_endpoint.ats not in ('secondary', 'simplify')
  ) into v_existing_primary;

  insert into public.jobs (
    owner_id, company_id, employer_name, title, normalized_title, canonical_url, description,
    location_text, normalized_location, role_family, state, preliminary_score,
    posted_at, closes_at
  ) values (
    p_owner_id, v_company_id, p_employer_name, p_title, p_normalized_title, p_canonical_url, p_description,
    p_location_text, p_normalized_location, p_role_family, p_verification_state,
    p_domain_fit + p_skill_fit + p_evidence_fit + p_location_fit + p_eligibility_freshness,
    p_posted_at, p_closes_at
  )
  on conflict (owner_id, canonical_url) where canonical_url is not null
  do update set
    company_id = case when v_existing_primary and v_incoming_secondary then jobs.company_id else coalesce(excluded.company_id, jobs.company_id) end,
    employer_name = case when v_existing_primary and v_incoming_secondary then jobs.employer_name else excluded.employer_name end,
    title = case when v_existing_primary and v_incoming_secondary then jobs.title else excluded.title end,
    normalized_title = case when v_existing_primary and v_incoming_secondary then jobs.normalized_title else excluded.normalized_title end,
    description = case when v_existing_primary and v_incoming_secondary then jobs.description else excluded.description end,
    location_text = case when v_existing_primary and v_incoming_secondary then jobs.location_text else excluded.location_text end,
    normalized_location = case when v_existing_primary and v_incoming_secondary then jobs.normalized_location else excluded.normalized_location end,
    role_family = case when v_existing_primary and v_incoming_secondary then jobs.role_family else excluded.role_family end,
    state = case
      when jobs.state in ('shortlisted', 'dismissed') then jobs.state
      when v_existing_primary and v_incoming_secondary and jobs.state = 'verified' then jobs.state
      else excluded.state
    end,
    preliminary_score = excluded.preliminary_score,
    posted_at = case when v_existing_primary and v_incoming_secondary then jobs.posted_at else coalesce(excluded.posted_at, jobs.posted_at) end,
    closes_at = case when v_existing_primary and v_incoming_secondary then jobs.closes_at else excluded.closes_at end,
    last_seen_at = now(),
    updated_at = now()
  returning id into v_job_id;

  insert into public.job_sources (
    owner_id, job_id, source_endpoint_id, external_job_id, source_url,
    content_hash, is_active, is_verified, verified_at
  ) values (
    p_owner_id, v_job_id, p_source_endpoint_id, p_external_job_id, p_source_url,
    p_content_hash, true, p_verification_state = 'verified',
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
      is_active = true,
      is_verified = p_verification_state = 'verified',
      verified_at = case when p_verification_state = 'verified' then coalesce(source.verified_at, now()) else null end,
      updated_at = now()
    where source.source_endpoint_id = p_source_endpoint_id
      and source.external_job_id = p_external_job_id
      and source.content_hash = p_content_hash
    returning source.id into v_job_source_id;

    if not found then
    update public.job_sources source
    set
      owner_id = p_owner_id,
      job_id = v_job_id,
      source_url = p_source_url,
      last_seen_at = now(),
      content_hash = p_content_hash,
      is_active = true,
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
  end if;

  insert into public.job_scores (
    owner_id, job_id, domain_fit, skill_fit, evidence_fit, location_fit,
    eligibility_freshness, explanation_inputs
  ) values (
    p_owner_id, v_job_id, p_domain_fit, p_skill_fit, p_evidence_fit, p_location_fit,
    p_eligibility_freshness, p_explanation_inputs
  )
  on conflict on constraint job_scores_job_id_key do update set
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
$$;

create function public.reconcile_secondary_source(
  p_owner_id uuid,
  p_source_endpoint_id bigint,
  p_seen_external_job_ids text[]
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_closed_count integer := 0;
begin
  if not exists (
    select 1 from public.source_endpoints endpoint
    where endpoint.id = p_source_endpoint_id
      and endpoint.owner_id = p_owner_id
      and endpoint.ats in ('secondary', 'simplify')
      and endpoint.state <> 'disabled'
  ) then
    raise exception 'secondary source endpoint is missing, disabled, or belongs to another owner'
      using errcode = '23503';
  end if;

  update public.job_sources source
  set is_active = false, updated_at = now()
  where source.owner_id = p_owner_id
    and source.source_endpoint_id = p_source_endpoint_id
    and source.is_active
    and not (source.external_job_id = any(coalesce(p_seen_external_job_ids, array[]::text[])));

  update public.jobs job
  set state = 'closed', updated_at = now()
  where job.owner_id = p_owner_id
    and job.state in ('discovered', 'needs_verification', 'verified', 'shortlisted')
    and exists (
      select 1 from public.job_sources source
      where source.job_id = job.id and source.source_endpoint_id = p_source_endpoint_id
    )
    and not exists (
      select 1 from public.job_sources active_source
      where active_source.job_id = job.id and active_source.is_active
    );
  get diagnostics v_closed_count = row_count;
  return v_closed_count;
end;
$$;

create function public.record_source_result(
  p_source_run_id bigint,
  p_source_endpoint_id bigint,
  p_succeeded boolean,
  p_discovered_count integer,
  p_changed_count integer,
  p_sanitized_error text default null
)
returns public.source_state
language plpgsql
set search_path = ''
as $$
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
$$;

create function public.finish_source_run(p_source_run_id bigint)
returns public.run_outcome
language plpgsql
set search_path = ''
as $$
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
$$;

revoke all on function public.start_source_run(uuid, text, text) from public, anon, authenticated;
revoke all on function public.try_start_source_run(uuid, text, text) from public, anon, authenticated;
revoke all on function public.upsert_discovered_job(
  uuid, bigint, text, text, text, text, text, text, text, text, text, text,
  timestamptz, timestamptz, text, public.job_state,
  smallint, smallint, smallint, smallint, smallint, jsonb
) from public, anon, authenticated;
revoke all on function public.reconcile_secondary_source(uuid, bigint, text[]) from public, anon, authenticated;
revoke all on function public.record_source_result(bigint, bigint, boolean, integer, integer, text) from public, anon, authenticated;
revoke all on function public.finish_source_run(bigint) from public, anon, authenticated;
