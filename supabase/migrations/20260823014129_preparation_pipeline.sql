set local check_function_bodies = off;

alter table "public"."profiles"
  drop constraint "profiles_email_caps";

alter table "public"."profiles"
  drop constraint "profiles_resource_limits";

create or replace function public.claim_next_application_preparation (
  p_worker_id text
)
  returns table (
    application_id         uuid,
    owner_id               uuid,
    job                    jsonb,
    evidence               jsonb,
    approved_answers       jsonb,
    cover_letter_requested boolean
  )
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_application public.applications%rowtype;
begin
  if btrim(p_worker_id) = '' then raise exception 'worker id is required' using errcode = '22023'; end if;
  select app.* into v_application
  from public.applications app
  where app.state = 'queued_for_codex'
  order by app.queued_at, app.id
  for update skip locked
  limit 1;
  if not found then return; end if;

  update public.applications set state = 'preparing', updated_at = now() where id = v_application.id;
  insert into public.application_events (owner_id, application_id, event_type, from_state, to_state, sanitized_detail, actor_type)
  values (v_application.owner_id, v_application.id, 'preparation_claimed', 'queued_for_codex', 'preparing', jsonb_build_object('worker_id', p_worker_id), 'codex');

  return query
  select
    v_application.id,
    v_application.owner_id,
    to_jsonb(job_row),
    coalesce((select jsonb_agg(to_jsonb(item) order by item.id) from public.profile_evidence item where item.owner_id = v_application.owner_id and (item.expires_at is null or item.expires_at > now())), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(answer) order by answer.id) from public.screening_answers answer where answer.owner_id = v_application.owner_id and (answer.expires_at is null or answer.expires_at > now())), '[]'::jsonb),
    coalesce((select (event.sanitized_detail ->> 'cover_letter_requested')::boolean from public.application_events event where event.application_id = v_application.id and event.event_type = 'preparation_queued' order by event.id desc limit 1), false)
  from public.jobs job_row where job_row.id = v_application.job_id;
end;
$function$;

create or replace function public.fail_application_preparation (
  p_application_id uuid,
  p_questions      jsonb,
  p_error_code     text  default null::text
)
  returns void
  language plpgsql
  set search_path to ''
  AS $function$
declare v_application public.applications%rowtype;
begin
  select * into v_application from public.applications where id = p_application_id and state = 'preparing' for update;
  if not found then raise exception 'application is not in preparation' using errcode = '23514'; end if;
  if jsonb_typeof(p_questions) <> 'array' then raise exception 'questions must be an array' using errcode = '23514'; end if;
  update public.applications set state = case when jsonb_array_length(p_questions) > 0 then 'needs_input'::public.application_state else 'failed'::public.application_state end, updated_at = now() where id = p_application_id;
  insert into public.application_packages (owner_id, application_id, state, answer_manifest, evidence_manifest)
  values (v_application.owner_id, p_application_id, case when jsonb_array_length(p_questions) > 0 then 'needs_input'::public.package_state else 'draft'::public.package_state end, jsonb_build_object('unresolved_questions', p_questions, 'error_code', p_error_code), '[]'::jsonb);
  insert into public.application_events (owner_id, application_id, event_type, from_state, to_state, sanitized_detail, actor_type)
  values (v_application.owner_id, p_application_id, 'preparation_stopped', 'preparing', case when jsonb_array_length(p_questions) > 0 then 'needs_input'::public.application_state else 'failed'::public.application_state end, jsonb_build_object('question_count', jsonb_array_length(p_questions), 'error_code', p_error_code), 'codex');
end;
$function$;

create or replace function public.queue_application_preparation (
  p_job_id                 bigint,
  p_cover_letter_requested boolean default false
)
  returns uuid
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_owner_id uuid := auth.uid();
  v_application_id uuid;
begin
  if v_owner_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.jobs job
    where job.id = p_job_id and job.owner_id = v_owner_id and job.state = 'verified'
      and exists (select 1 from public.job_sources source where source.job_id = job.id and source.is_verified)
  ) then
    raise exception 'job is not verified for preparation' using errcode = '23514';
  end if;
  if exists (select 1 from public.applications app where app.owner_id = v_owner_id and app.job_id = p_job_id) then
    raise exception 'application already exists for this job' using errcode = '23505';
  end if;

  insert into public.applications (owner_id, job_id, state, queued_at)
  values (v_owner_id, p_job_id, 'queued_for_codex', now())
  returning id into v_application_id;
  insert into public.application_events (owner_id, application_id, event_type, from_state, to_state, sanitized_detail, actor_type)
  values (v_owner_id, v_application_id, 'preparation_queued', 'not_started', 'queued_for_codex', jsonb_build_object('cover_letter_requested', p_cover_letter_requested), 'owner');
  return v_application_id;
end;
$function$;

create or replace function public.record_application_package (
  p_application_id    uuid,
  p_resume_path       text,
  p_cover_letter_path text,
  p_answer_manifest   jsonb,
  p_evidence_manifest jsonb
)
  returns uuid
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_application public.applications%rowtype;
  v_package_id uuid;
begin
  select * into v_application from public.applications where id = p_application_id and state = 'preparing' for update;
  if not found then raise exception 'application is not in preparation' using errcode = '23514'; end if;
  if p_resume_path !~ ('^' || v_application.owner_id::text || '/' || v_application.id::text || '/[^/]+[.](docx|pdf)$') then
    raise exception 'resume path is outside the private application directory' using errcode = '23514';
  end if;
  if p_cover_letter_path is not null and p_cover_letter_path !~ ('^' || v_application.owner_id::text || '/' || v_application.id::text || '/[^/]+[.](docx|pdf)$') then
    raise exception 'cover letter path is outside the private application directory' using errcode = '23514';
  end if;
  if jsonb_typeof(p_answer_manifest) <> 'object' or jsonb_typeof(p_evidence_manifest) <> 'array' or jsonb_array_length(p_evidence_manifest) = 0 then
    raise exception 'package manifests are invalid' using errcode = '23514';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_evidence_manifest) claim
    where jsonb_typeof(claim -> 'evidenceIds') <> 'array' or jsonb_array_length(claim -> 'evidenceIds') = 0
      or exists (
        select 1 from jsonb_array_elements_text(claim -> 'evidenceIds') evidence_id
        where not exists (
          select 1 from public.profile_evidence item
          where item.id = evidence_id::bigint and item.owner_id = v_application.owner_id
            and (item.expires_at is null or item.expires_at > now())
        )
      )
  ) then raise exception 'package contains unsupported or expired evidence' using errcode = '23514'; end if;

  update public.application_packages set state = 'superseded', superseded_at = now() where application_id = p_application_id and state <> 'superseded';
  insert into public.application_packages (owner_id, application_id, state, resume_path, cover_letter_path, answer_manifest, evidence_manifest, verified_at)
  values (v_application.owner_id, p_application_id, 'verified', p_resume_path, p_cover_letter_path, p_answer_manifest, p_evidence_manifest, now())
  returning id into v_package_id;
  update public.applications set state = 'package_ready', updated_at = now() where id = p_application_id;
  insert into public.application_events (owner_id, application_id, event_type, from_state, to_state, sanitized_detail, actor_type)
  values (v_application.owner_id, p_application_id, 'package_verified', 'preparing', 'package_ready', jsonb_build_object('package_id', v_package_id), 'codex');
  return v_package_id;
end;
$function$;

alter table "public"."profiles"
  add constraint "profiles_email_caps"
    check ((((daily_email_cap >= 1) AND (daily_email_cap <= 50)) AND ((monthly_email_cap >= 1) AND (monthly_email_cap <= 2500)) AND (daily_email_cap <= monthly_email_cap)));

alter table "public"."profiles"
  add constraint "profiles_resource_limits"
    check ((((database_soft_limit_mb >= 1) AND (database_soft_limit_mb <= 400)) AND ((storage_soft_limit_mb >= 1) AND (storage_soft_limit_mb <= 800))));

revoke all on function "public"."claim_next_application_preparation"(text) from public, "anon", "authenticated";
grant execute on function "public"."claim_next_application_preparation"(text) to "postgres", "service_role";

revoke all on function "public"."fail_application_preparation"(uuid, jsonb, text) from public, "anon", "authenticated";
grant execute on function "public"."fail_application_preparation"(uuid, jsonb, text) to "postgres", "service_role";

revoke all on function "public"."queue_application_preparation"(bigint, boolean) from public, "anon", "authenticated";
grant execute on function "public"."queue_application_preparation"(bigint, boolean) to "authenticated", "postgres";

revoke all on function "public"."record_application_package"(uuid, text, text, jsonb, jsonb) from public, "anon", "authenticated";
grant execute on function "public"."record_application_package"(uuid, text, text, jsonb, jsonb) to "postgres", "service_role";
