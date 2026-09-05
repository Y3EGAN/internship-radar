create function public.upsert_discovered_job_with_alert(
  p_owner_id uuid, p_source_endpoint_id bigint, p_external_job_id text,
  p_employer_name text,
  p_title text, p_normalized_title text, p_canonical_url text, p_source_url text,
  p_description text, p_location_text text, p_normalized_location text, p_role_family text,
  p_posted_at timestamptz, p_closes_at timestamptz, p_content_hash text,
  p_verification_state public.job_state,
  p_domain_fit smallint, p_skill_fit smallint, p_evidence_fit smallint,
  p_location_fit smallint, p_eligibility_freshness smallint, p_explanation_inputs jsonb,
  p_source_run_id bigint, p_alert_recipient text
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
    p_domain_fit, p_skill_fit, p_evidence_fit, p_location_fit, p_eligibility_freshness,
    p_explanation_inputs
  );
  if v_result.source_new and p_verification_state = 'verified' and v_total >= 80
    and p_source_run_id is not null and nullif(btrim(p_alert_recipient), '') is not null then
    v_event_key := 'priority-alert/' || p_source_run_id || '/' || p_owner_id;
    insert into public.email_outbox (owner_id, logical_event_key, message_type, recipient, payload)
    values (
      p_owner_id, v_event_key, 'priority_jobs', lower(btrim(p_alert_recipient)),
      jsonb_build_object('source_run_id', p_source_run_id, 'job_ids', jsonb_build_array(v_result.job_id))
    )
    on conflict (owner_id, logical_event_key) do update set
      payload = jsonb_set(
        public.email_outbox.payload, '{job_ids}',
        coalesce(public.email_outbox.payload -> 'job_ids', '[]'::jsonb) || jsonb_build_array(v_result.job_id), true
      ), updated_at = now();
  end if;
  return query select v_result.job_id, v_result.source_new, v_result.content_changed;
end;
$$;

create function public.claim_email_outbox(p_owner_id uuid, p_limit integer default 10)
returns table (
  outbox_id bigint, logical_event_key text, message_type text,
  recipient text, payload jsonb, attempt smallint
)
language plpgsql set search_path = '' as $$
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
$$;

create function public.record_email_send(p_outbox_id bigint, p_resend_message_id text)
returns void language plpgsql set search_path = '' as $$
declare v_owner_id uuid;
begin
  update public.email_outbox set state = 'sent', sent_at = now(), last_error_code = null, updated_at = now()
  where id = p_outbox_id and state = 'sending' returning owner_id into v_owner_id;
  if not found then raise exception 'outbox row is not in sending state' using errcode = '55000'; end if;
  insert into public.email_deliveries (owner_id, outbox_id, resend_message_id)
  values (v_owner_id, p_outbox_id, p_resend_message_id) on conflict (outbox_id) do nothing;
end;
$$;

create function public.record_email_failure(p_outbox_id bigint, p_retryable boolean, p_error_code text)
returns public.email_outbox_state language plpgsql set search_path = '' as $$
declare v_state public.email_outbox_state;
begin
  update public.email_outbox outbox set
    state = case
      when p_retryable and outbox.attempts < outbox.max_attempts then 'retry_wait'::public.email_outbox_state
      else 'failed'::public.email_outbox_state
    end,
    next_attempt_at = case when p_retryable then now() + make_interval(secs => least(3600, 60 * (2 ^ greatest(outbox.attempts - 1, 0)))) else outbox.next_attempt_at end,
    last_error_code = left(coalesce(nullif(btrim(p_error_code), ''), 'unknown'), 100), updated_at = now()
  where outbox.id = p_outbox_id and outbox.state = 'sending' returning outbox.state into v_state;
  if not found then raise exception 'outbox row is not in sending state' using errcode = '55000'; end if;
  return v_state;
end;
$$;

create function public.record_resend_webhook(
  p_owner_id uuid, p_event_id text, p_event_type text,
  p_resend_message_id text, p_recipient text, p_sanitized_metadata jsonb
)
returns boolean language plpgsql set search_path = '' as $$
declare v_delivery_id bigint; v_inserted bigint; v_state public.delivery_state;
begin
  select delivery.id into v_delivery_id from public.email_deliveries delivery
  where delivery.owner_id = p_owner_id and delivery.resend_message_id = p_resend_message_id;
  if not found then return false; end if;
  insert into public.resend_webhook_events (owner_id, event_id, event_type, delivery_id, sanitized_metadata)
  values (p_owner_id, p_event_id, p_event_type, v_delivery_id, p_sanitized_metadata)
  on conflict (event_id) do nothing returning id into v_inserted;
  if not found then return false; end if;
  v_state := case p_event_type
    when 'email.delivered' then 'delivered' when 'email.bounced' then 'bounced'
    when 'email.complained' then 'complained' when 'email.delivery_delayed' then 'delivery_delayed'
    when 'email.suppressed' then 'suppressed' else null end;
  if v_state is not null then
    update public.email_deliveries set state = v_state, last_event_at = now(), updated_at = now()
    where id = v_delivery_id;
  end if;
  if p_event_type in ('email.bounced', 'email.complained', 'email.suppressed') then
    insert into public.email_suppressions (owner_id, recipient, reason, source_message_id)
    values (p_owner_id, lower(btrim(p_recipient)), p_event_type, p_resend_message_id)
    on conflict (owner_id, recipient) do nothing;
  end if;
  return true;
end;
$$;

revoke all on function public.upsert_discovered_job_with_alert(uuid,bigint,text,text,text,text,text,text,text,text,text,text,timestamptz,timestamptz,text,public.job_state,smallint,smallint,smallint,smallint,smallint,jsonb,bigint,text) from public, anon, authenticated;
revoke all on function public.claim_email_outbox(uuid,integer) from public, anon, authenticated;
revoke all on function public.record_email_send(bigint,text) from public, anon, authenticated;
revoke all on function public.record_email_failure(bigint,boolean,text) from public, anon, authenticated;
revoke all on function public.record_resend_webhook(uuid,text,text,text,text,jsonb) from public, anon, authenticated;
