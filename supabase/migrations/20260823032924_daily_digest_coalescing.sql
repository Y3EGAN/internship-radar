set local check_function_bodies = off;

alter table "public"."profiles"
  drop constraint "profiles_email_caps";

alter table "public"."profiles"
  drop constraint "profiles_resource_limits";

create or replace function public.claim_email_outbox (
  p_owner_id uuid,
  p_limit    integer default 10
)
  returns table (
    outbox_id         bigint,
    logical_event_key text,
    message_type      text,
    recipient         text,
    payload           jsonb,
    attempt           smallint
  )
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_defer_until timestamptz;
  v_digest_key text;
  v_digest_recipient text;
  v_job_ids jsonb;
begin
  update public.email_outbox outbox set state = 'retry_wait', next_attempt_at = now(), updated_at = now()
  where outbox.owner_id = p_owner_id and outbox.state = 'sending'
    and outbox.updated_at < now() - interval '10 minutes';
  update public.email_outbox outbox set state = 'suppressed', updated_at = now()
  where outbox.owner_id = p_owner_id and outbox.state in ('pending', 'retry_wait')
    and exists (
      select 1 from public.email_suppressions suppression
      where suppression.owner_id = outbox.owner_id
        and lower(suppression.recipient) = lower(outbox.recipient)
    );
  if (select count(*) from public.email_deliveries delivery
      where delivery.owner_id = p_owner_id and delivery.created_at >= date_trunc('month', now()))
      >= (select profile.monthly_email_cap from public.profiles profile where profile.owner_id = p_owner_id) then
    v_defer_until := date_trunc('month', now()) + interval '1 month';
  elsif (select count(*) from public.email_deliveries delivery
      where delivery.owner_id = p_owner_id and delivery.created_at >= date_trunc('day', now()))
      >= (select profile.daily_email_cap from public.profiles profile where profile.owner_id = p_owner_id) then
    v_defer_until := date_trunc('day', now()) + interval '1 day';
  end if;
  if v_defer_until is not null then
    select min(outbox.recipient), coalesce(jsonb_agg(distinct job.value::bigint), '[]'::jsonb)
      into v_digest_recipient, v_job_ids
    from public.email_outbox outbox
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(outbox.payload -> 'job_ids') = 'array' then outbox.payload -> 'job_ids' else '[]'::jsonb end
    ) job(value)
    where outbox.owner_id = p_owner_id and outbox.state in ('pending', 'retry_wait')
      and outbox.next_attempt_at <= now() and outbox.message_type in ('priority_jobs', 'daily_digest')
      and job.value ~ '^[1-9][0-9]*$';
    if jsonb_array_length(v_job_ids) > 0 then
      v_digest_key := 'daily-digest/' || p_owner_id || '/' || to_char(v_defer_until at time zone 'UTC', 'YYYY-MM-DD');
      insert into public.email_outbox(owner_id, logical_event_key, message_type, recipient, payload, next_attempt_at)
      values(p_owner_id, v_digest_key, 'daily_digest', v_digest_recipient, jsonb_build_object('job_ids', v_job_ids), v_defer_until)
      on conflict on constraint email_outbox_owner_id_logical_event_key_key do update set
        payload = jsonb_set(public.email_outbox.payload, '{job_ids}',
          (select coalesce(jsonb_agg(distinct item.value::bigint), '[]'::jsonb)
           from jsonb_array_elements_text((public.email_outbox.payload -> 'job_ids') || (excluded.payload -> 'job_ids')) item(value)
           where item.value ~ '^[1-9][0-9]*$'), true),
        updated_at = now();
      update public.email_outbox outbox set state = 'suppressed', last_error_code = 'coalesced_into_daily_digest', updated_at = now()
      where outbox.owner_id = p_owner_id and outbox.logical_event_key <> v_digest_key
        and outbox.state in ('pending', 'retry_wait') and outbox.next_attempt_at <= now()
        and outbox.message_type in ('priority_jobs', 'daily_digest');
    end if;
    update public.email_outbox outbox set next_attempt_at = v_defer_until, updated_at = now()
    where outbox.owner_id = p_owner_id and outbox.state in ('pending', 'retry_wait') and outbox.next_attempt_at <= now();
    return;
  end if;
  return query with due as (
    select outbox.id from public.email_outbox outbox
    where outbox.owner_id = p_owner_id and outbox.state in ('pending', 'retry_wait')
      and outbox.next_attempt_at <= now() and outbox.attempts < outbox.max_attempts
    order by outbox.next_attempt_at, outbox.id for update skip locked
    limit greatest(1, least(p_limit, 25))
  )
  update public.email_outbox outbox
  set state = 'sending', attempts = outbox.attempts + 1, updated_at = now()
  from due where outbox.id = due.id
  returning outbox.id, outbox.logical_event_key, outbox.message_type,
    outbox.recipient, outbox.payload, outbox.attempts;
end;
$function$;

alter table "public"."profiles"
  add constraint "profiles_email_caps"
    check ((((daily_email_cap >= 1) AND (daily_email_cap <= 50)) AND ((monthly_email_cap >= 1) AND (monthly_email_cap <= 2500)) AND (daily_email_cap <= monthly_email_cap)));

alter table "public"."profiles"
  add constraint "profiles_resource_limits"
    check ((((database_soft_limit_mb >= 1) AND (database_soft_limit_mb <= 400)) AND ((storage_soft_limit_mb >= 1) AND (storage_soft_limit_mb <= 800))));
