set local check_function_bodies = off;

alter table "public"."profiles"
  drop constraint "profiles_email_caps";

alter table "public"."profiles"
  drop constraint "profiles_resource_limits";

create or replace function public.try_start_source_run (
  p_owner_id        uuid,
  p_workflow_run_id text,
  p_partition_key   text
)
  returns bigint
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_run_id bigint;
begin
  insert into public.source_runs (owner_id, workflow_run_id, partition_key)
  values (p_owner_id, p_workflow_run_id, p_partition_key)
  returning id into v_run_id;
  return v_run_id;
exception
  when unique_violation then
    return null;
end;
$function$;

alter table "public"."profiles"
  add constraint "profiles_email_caps"
    check ((((daily_email_cap >= 1) AND (daily_email_cap <= 50)) AND ((monthly_email_cap >= 1) AND (monthly_email_cap <= 2500)) AND (daily_email_cap <= monthly_email_cap)));

alter table "public"."profiles"
  add constraint "profiles_resource_limits"
    check ((((database_soft_limit_mb >= 1) AND (database_soft_limit_mb <= 400)) AND ((storage_soft_limit_mb >= 1) AND (storage_soft_limit_mb <= 800))));

create unique index source_runs_one_running_per_owner_idx on public.source_runs using btree (owner_id)
  where (outcome = 'running'::public.run_outcome);

revoke all on function "public"."try_start_source_run"(uuid, text, text) from public;

grant execute on function "public"."try_start_source_run"(uuid, text, text) to "postgres", "service_role";
