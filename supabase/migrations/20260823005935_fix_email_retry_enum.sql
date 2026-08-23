set local check_function_bodies = off;

alter table "public"."profiles"
  drop constraint "profiles_email_caps";

alter table "public"."profiles"
  drop constraint "profiles_resource_limits";

create or replace function public.record_email_failure (
  p_outbox_id  bigint,
  p_retryable  boolean,
  p_error_code text
)
  returns public.email_outbox_state
  language plpgsql
  set search_path to ''
  AS $function$
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
$function$;

alter table "public"."profiles"
  add constraint "profiles_email_caps"
    check ((((daily_email_cap >= 1) AND (daily_email_cap <= 50)) AND ((monthly_email_cap >= 1) AND (monthly_email_cap <= 2500)) AND (daily_email_cap <= monthly_email_cap)));

alter table "public"."profiles"
  add constraint "profiles_resource_limits"
    check ((((database_soft_limit_mb >= 1) AND (database_soft_limit_mb <= 400)) AND ((storage_soft_limit_mb >= 1) AND (storage_soft_limit_mb <= 800))));
