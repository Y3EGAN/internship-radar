alter table public.jobs add column employer_name text;

update public.jobs job
set employer_name = coalesce(company.name, 'Company not listed')
from public.companies company
where company.id = job.company_id;

update public.jobs set employer_name = 'Company not listed' where employer_name is null;
alter table public.jobs alter column employer_name set not null;
alter table public.jobs add constraint jobs_employer_name_nonempty check (btrim(employer_name) <> '');

alter table public.job_sources add column is_active boolean not null default true;

create table public.link_verifications (
  owner_id uuid not null references auth.users (id) on delete cascade,
  canonical_url text not null,
  outcome text not null,
  http_status smallint,
  checked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint link_verifications_https check (canonical_url ~ '^https://'),
  constraint link_verifications_outcome check (outcome in ('reachable', 'unreachable')),
  constraint link_verifications_status check (http_status is null or http_status between 100 and 599),
  constraint link_verifications_expiry check (expires_at > checked_at),
  primary key (owner_id, canonical_url)
);

alter table public.link_verifications enable row level security;
alter table public.link_verifications force row level security;
create policy link_verifications_owner_select on public.link_verifications
for select to authenticated using ((select auth.uid()) = owner_id);
revoke all on table public.link_verifications from anon, authenticated;
grant select on table public.link_verifications to authenticated;
grant all privileges on table public.link_verifications to service_role;

create or replace function private.validate_job_state_transition()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.state = old.state then return new; end if;
  if not (
    (old.state = 'discovered' and new.state in ('needs_verification', 'verified', 'dismissed', 'closed'))
    or (old.state = 'needs_verification' and new.state in ('verified', 'dismissed', 'closed'))
    or (old.state = 'verified' and new.state in ('needs_verification', 'shortlisted', 'dismissed', 'closed'))
    or (old.state = 'shortlisted' and new.state in ('verified', 'dismissed', 'closed'))
    or (old.state = 'dismissed' and new.state in ('verified', 'closed'))
    or (old.state = 'closed' and new.state in ('needs_verification', 'verified'))
  ) then
    raise exception 'invalid job state transition from % to %', old.state, new.state using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Drop the dependent alert wrapper before replacing its underlying discovery RPC.
drop function public.upsert_discovered_job_with_alert(uuid,bigint,text,text,text,text,text,text,text,text,text,timestamptz,timestamptz,text,public.job_state,smallint,smallint,smallint,smallint,smallint,jsonb,bigint,text);
drop function public.upsert_discovered_job(uuid,bigint,text,text,text,text,text,text,text,text,text,timestamptz,timestamptz,text,public.job_state,smallint,smallint,smallint,smallint,smallint,jsonb);

create function public.upsert_discovered_job(
  p_owner_id uuid, p_source_endpoint_id bigint, p_external_job_id text, p_employer_name text,
  p_title text, p_normalized_title text, p_canonical_url text, p_source_url text,
  p_description text, p_location_text text, p_normalized_location text, p_role_family text,
  p_posted_at timestamptz, p_closes_at timestamptz, p_content_hash text,
  p_verification_state public.job_state, p_domain_fit smallint, p_skill_fit smallint,
  p_evidence_fit smallint, p_location_fit smallint, p_eligibility_freshness smallint,
  p_explanation_inputs jsonb
)
returns table (job_id bigint, source_new boolean, content_changed boolean)
language plpgsql set search_path = '' as $$
declare
  v_company_id bigint;
  v_job_id bigint;
  v_job_source_id bigint;
  v_source_new boolean := false;
  v_content_changed boolean := false;
  v_incoming_secondary boolean := false;
  v_existing_primary boolean := false;
begin
  select case when endpoint.ats in ('secondary', 'simplify') then null else endpoint.company_id end,
    endpoint.ats in ('secondary', 'simplify')
  into v_company_id, v_incoming_secondary
  from public.source_endpoints endpoint
  where endpoint.id = p_source_endpoint_id and endpoint.owner_id = p_owner_id and endpoint.state <> 'disabled';
  if not found then
    raise exception 'source endpoint is missing, disabled, or belongs to another owner' using errcode = '23503';
  end if;

  select exists (
    select 1 from public.jobs existing_job
    join public.job_sources existing_source on existing_source.job_id = existing_job.id
    join public.source_endpoints existing_endpoint on existing_endpoint.id = existing_source.source_endpoint_id
    where existing_job.owner_id = p_owner_id and existing_job.canonical_url = p_canonical_url
      and existing_source.is_verified and existing_endpoint.ats not in ('secondary', 'simplify')
  ) into v_existing_primary;

  insert into public.jobs (
    owner_id, company_id, employer_name, title, normalized_title, canonical_url, description,
    location_text, normalized_location, role_family, state, preliminary_score, posted_at, closes_at
  ) values (
    p_owner_id, v_company_id, p_employer_name, p_title, p_normalized_title, p_canonical_url, p_description,
    p_location_text, p_normalized_location, p_role_family, p_verification_state,
    p_domain_fit + p_skill_fit + p_evidence_fit + p_location_fit + p_eligibility_freshness,
    p_posted_at, p_closes_at
  )
  on conflict (owner_id, canonical_url) where canonical_url is not null do update set
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
    last_seen_at = now(), updated_at = now()
  returning id into v_job_id;

  insert into public.job_sources (
    owner_id, job_id, source_endpoint_id, external_job_id, source_url, content_hash,
    is_active, is_verified, verified_at
  ) values (
    p_owner_id, v_job_id, p_source_endpoint_id, p_external_job_id, p_source_url, p_content_hash,
    true, p_verification_state = 'verified', case when p_verification_state = 'verified' then now() else null end
  ) on conflict (source_endpoint_id, external_job_id) do nothing
  returning id into v_job_source_id;

  if found then
    v_source_new := true;
  else
    update public.job_sources source set
      owner_id = p_owner_id, job_id = v_job_id, source_url = p_source_url, last_seen_at = now(),
      is_active = true, is_verified = p_verification_state = 'verified',
      verified_at = case when p_verification_state = 'verified' then coalesce(source.verified_at, now()) else null end,
      updated_at = now()
    where source.source_endpoint_id = p_source_endpoint_id
      and source.external_job_id = p_external_job_id and source.content_hash = p_content_hash
    returning source.id into v_job_source_id;

    if not found then
      update public.job_sources source set
        owner_id = p_owner_id, job_id = v_job_id, source_url = p_source_url, last_seen_at = now(),
        content_hash = p_content_hash, is_active = true, is_verified = p_verification_state = 'verified',
        verified_at = case when p_verification_state = 'verified' then coalesce(source.verified_at, now()) else null end,
        updated_at = now()
      where source.source_endpoint_id = p_source_endpoint_id
        and source.external_job_id = p_external_job_id and source.content_hash <> p_content_hash
      returning source.id into v_job_source_id;
      if found then
        v_content_changed := true;
        insert into public.job_snapshots (owner_id, job_source_id, content_hash, normalized_content)
        values (p_owner_id, v_job_source_id, p_content_hash, jsonb_build_object(
          'title', p_title, 'description', p_description, 'location', p_location_text,
          'posted_at', p_posted_at, 'closes_at', p_closes_at
        )) on conflict (job_source_id, content_hash) do nothing;
      else
        select source.id into v_job_source_id from public.job_sources source
        where source.source_endpoint_id = p_source_endpoint_id and source.external_job_id = p_external_job_id;
      end if;
    end if;
  end if;

  insert into public.job_scores (
    owner_id, job_id, domain_fit, skill_fit, evidence_fit, location_fit, eligibility_freshness, explanation_inputs
  ) values (
    p_owner_id, v_job_id, p_domain_fit, p_skill_fit, p_evidence_fit, p_location_fit,
    p_eligibility_freshness, p_explanation_inputs
  ) on conflict on constraint job_scores_job_id_key do update set
    owner_id = excluded.owner_id, domain_fit = excluded.domain_fit, skill_fit = excluded.skill_fit,
    evidence_fit = excluded.evidence_fit, location_fit = excluded.location_fit,
    eligibility_freshness = excluded.eligibility_freshness,
    explanation_inputs = excluded.explanation_inputs, updated_at = now();

  return query select v_job_id, v_source_new, v_content_changed;
end;
$$;

create function public.reconcile_secondary_source(p_owner_id uuid, p_source_endpoint_id bigint, p_seen_external_job_ids text[])
returns integer language plpgsql set search_path = '' as $$
declare v_closed_count integer := 0;
begin
  if not exists (
    select 1 from public.source_endpoints endpoint
    where endpoint.id = p_source_endpoint_id and endpoint.owner_id = p_owner_id
      and endpoint.ats in ('secondary', 'simplify') and endpoint.state <> 'disabled'
  ) then
    raise exception 'secondary source endpoint is missing, disabled, or belongs to another owner' using errcode = '23503';
  end if;
  update public.job_sources source set is_active = false, updated_at = now()
  where source.owner_id = p_owner_id and source.source_endpoint_id = p_source_endpoint_id and source.is_active
    and not (source.external_job_id = any(coalesce(p_seen_external_job_ids, array[]::text[])));
  update public.jobs job set state = 'closed', updated_at = now()
  where job.owner_id = p_owner_id and job.state in ('discovered', 'needs_verification', 'verified', 'shortlisted')
    and exists (select 1 from public.job_sources source where source.job_id = job.id and source.source_endpoint_id = p_source_endpoint_id)
    and not exists (select 1 from public.job_sources active_source where active_source.job_id = job.id and active_source.is_active);
  get diagnostics v_closed_count = row_count;
  return v_closed_count;
end;
$$;

create function public.upsert_discovered_job_with_alert(
  p_owner_id uuid, p_source_endpoint_id bigint, p_external_job_id text, p_employer_name text,
  p_title text, p_normalized_title text, p_canonical_url text, p_source_url text,
  p_description text, p_location_text text, p_normalized_location text, p_role_family text,
  p_posted_at timestamptz, p_closes_at timestamptz, p_content_hash text,
  p_verification_state public.job_state, p_domain_fit smallint, p_skill_fit smallint,
  p_evidence_fit smallint, p_location_fit smallint, p_eligibility_freshness smallint,
  p_explanation_inputs jsonb, p_source_run_id bigint, p_alert_recipient text
)
returns table (job_id bigint, source_new boolean, content_changed boolean)
language plpgsql set search_path = '' as $$
declare
  v_result record;
  v_total smallint := p_domain_fit + p_skill_fit + p_evidence_fit + p_location_fit + p_eligibility_freshness;
  v_event_key text;
begin
  select * into v_result from public.upsert_discovered_job(
    p_owner_id, p_source_endpoint_id, p_external_job_id, p_employer_name, p_title, p_normalized_title,
    p_canonical_url, p_source_url, p_description, p_location_text, p_normalized_location,
    p_role_family, p_posted_at, p_closes_at, p_content_hash, p_verification_state,
    p_domain_fit, p_skill_fit, p_evidence_fit, p_location_fit, p_eligibility_freshness, p_explanation_inputs
  );
  if v_result.source_new and p_verification_state = 'verified' and v_total >= 80
    and p_source_run_id is not null and nullif(btrim(p_alert_recipient), '') is not null then
    v_event_key := 'priority-alert/' || p_source_run_id || '/' || p_owner_id;
    insert into public.email_outbox (owner_id, logical_event_key, message_type, recipient, payload)
    values (p_owner_id, v_event_key, 'priority_jobs', lower(btrim(p_alert_recipient)),
      jsonb_build_object('source_run_id', p_source_run_id, 'job_ids', jsonb_build_array(v_result.job_id)))
    on conflict (owner_id, logical_event_key) do update set
      payload = jsonb_set(public.email_outbox.payload, '{job_ids}',
        coalesce(public.email_outbox.payload -> 'job_ids', '[]'::jsonb) || jsonb_build_array(v_result.job_id), true),
      updated_at = now();
  end if;
  return query select v_result.job_id, v_result.source_new, v_result.content_changed;
end;
$$;

revoke all on function public.upsert_discovered_job(uuid,bigint,text,text,text,text,text,text,text,text,text,text,timestamptz,timestamptz,text,public.job_state,smallint,smallint,smallint,smallint,smallint,jsonb) from public, anon, authenticated;
revoke all on function public.upsert_discovered_job_with_alert(uuid,bigint,text,text,text,text,text,text,text,text,text,text,timestamptz,timestamptz,text,public.job_state,smallint,smallint,smallint,smallint,smallint,jsonb,bigint,text) from public, anon, authenticated;
revoke all on function public.reconcile_secondary_source(uuid,bigint,text[]) from public, anon, authenticated;
grant execute on function public.upsert_discovered_job(uuid,bigint,text,text,text,text,text,text,text,text,text,text,timestamptz,timestamptz,text,public.job_state,smallint,smallint,smallint,smallint,smallint,jsonb) to service_role;
grant execute on function public.upsert_discovered_job_with_alert(uuid,bigint,text,text,text,text,text,text,text,text,text,text,timestamptz,timestamptz,text,public.job_state,smallint,smallint,smallint,smallint,smallint,jsonb,bigint,text) to service_role;
grant execute on function public.reconcile_secondary_source(uuid,bigint,text[]) to service_role;
