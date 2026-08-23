create function public.create_device_pairing(p_pairing_code_hash text, p_device_label text)
returns bigint language plpgsql security invoker set search_path='' as $$
declare v_id bigint; v_owner uuid:=auth.uid();
begin
  if v_owner is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_pairing_code_hash !~ '^[a-f0-9]{64}$' or btrim(p_device_label)='' then raise exception 'invalid pairing request' using errcode='22023'; end if;
  delete from public.device_pairings where owner_id=v_owner and consumed_at is null and expires_at<=now();
  insert into public.device_pairings(owner_id,pairing_code_hash,device_label,expires_at)
  values(v_owner,p_pairing_code_hash,btrim(p_device_label),now()+interval '10 minutes') returning id into v_id;
  return v_id;
end; $$;

create function public.consume_device_pairing(p_pairing_code_hash text,p_token_hash text)
returns table(token_id bigint,owner_id uuid,device_label text,expires_at timestamptz)
language plpgsql set search_path='' as $$
declare v_pair public.device_pairings%rowtype; v_token_id bigint; v_expires timestamptz:=now()+interval '90 days';
begin
  if p_pairing_code_hash !~ '^[a-f0-9]{64}$' or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid pairing credential' using errcode='22023'; end if;
  select pair.* into v_pair from public.device_pairings pair where pair.pairing_code_hash=p_pairing_code_hash and pair.consumed_at is null and pair.expires_at>now() for update;
  if not found then raise exception 'pairing code is invalid or expired' using errcode='28000'; end if;
  update public.device_pairings set consumed_at=now() where id=v_pair.id;
  insert into public.device_tokens(owner_id,token_hash,device_label,expires_at)
  values(v_pair.owner_id,p_token_hash,v_pair.device_label,v_expires) returning id into v_token_id;
  return query select v_token_id,v_pair.owner_id,v_pair.device_label,v_expires;
end; $$;

create function public.authenticate_device_token(p_token_hash text)
returns table(token_id bigint,owner_id uuid,device_label text)
language plpgsql set search_path='' as $$
begin
  return query update public.device_tokens token set last_used_at=now(),updated_at=now()
  where token.token_hash=p_token_hash and token.revoked_at is null and token.expires_at>now()
  returning token.id,token.owner_id,token.device_label;
end; $$;

create function public.revoke_device_token(p_token_id bigint)
returns boolean language sql security invoker set search_path='' as $$
  with changed as (update public.device_tokens set revoked_at=now(),updated_at=now() where id=p_token_id and owner_id=auth.uid() and revoked_at is null returning 1)
  select exists(select 1 from changed);
$$;

create function public.claim_next_companion_application(p_token_hash text)
returns table(application_id uuid,owner_id uuid,job jsonb,package jsonb)
language plpgsql set search_path='' as $$
declare v_device record; v_application public.applications%rowtype;
begin
  select * into v_device from public.authenticate_device_token(p_token_hash);
  if not found then raise exception 'device token is invalid' using errcode='28000'; end if;
  select app.* into v_application from public.applications app
  where app.owner_id=v_device.owner_id and app.state='package_ready'
  order by app.updated_at,app.id for update skip locked limit 1;
  if not found then return; end if;
  update public.applications set state='filling',updated_at=now() where id=v_application.id;
  insert into public.application_events(owner_id,application_id,event_type,from_state,to_state,sanitized_detail,actor_type)
  values(v_application.owner_id,v_application.id,'companion_claimed','package_ready','filling',jsonb_build_object('device_id',v_device.token_id),'local_agent');
  return query select v_application.id,v_application.owner_id,to_jsonb(job_row),to_jsonb(package_row)
  from public.jobs job_row join lateral (
    select pkg.* from public.application_packages pkg where pkg.application_id=v_application.id and pkg.state='verified' order by pkg.verified_at desc limit 1
  ) package_row on true where job_row.id=v_application.job_id;
end; $$;

create function public.record_companion_event(p_token_hash text,p_application_id uuid,p_event_type text,p_detail jsonb)
returns public.application_state language plpgsql set search_path='' as $$
declare v_device record; v_application public.applications%rowtype; v_next public.application_state;
begin
  select * into v_device from public.authenticate_device_token(p_token_hash);
  if not found then raise exception 'device token is invalid' using errcode='28000'; end if;
  select * into v_application from public.applications where id=p_application_id and owner_id=v_device.owner_id and state in ('filling','needs_input') for update;
  if not found then raise exception 'application is not available to this device' using errcode='23514'; end if;
  if p_event_type='review_ready' then v_next:='ready_for_review';
  elsif p_event_type='paused' then v_next:='needs_input';
  elsif p_event_type='progress' then v_next:=v_application.state;
  else raise exception 'unsupported companion event' using errcode='22023'; end if;
  update public.applications set state=v_next,updated_at=now() where id=p_application_id;
  insert into public.application_events(owner_id,application_id,event_type,from_state,to_state,sanitized_detail,actor_type)
  values(v_application.owner_id,p_application_id,p_event_type,v_application.state,v_next,coalesce(p_detail,'{}'::jsonb)-'answer'-'value','local_agent');
  return v_next;
end; $$;
