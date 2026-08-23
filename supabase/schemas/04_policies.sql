do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'profile_evidence',
    'companies',
    'source_endpoints',
    'source_runs',
    'jobs',
    'job_sources',
    'job_snapshots',
    'job_scores',
    'applications',
    'application_packages',
    'screening_answers',
    'application_events',
    'email_outbox',
    'email_deliveries',
    'resend_webhook_events',
    'email_suppressions',
    'device_pairings',
    'device_tokens'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = owner_id)',
      table_name || '_owner_select',
      table_name
    );
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'profile_evidence',
    'companies',
    'source_endpoints',
    'jobs',
    'applications',
    'screening_answers'
  ]
  loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = owner_id)',
      table_name || '_owner_insert',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)',
      table_name || '_owner_update',
      table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = owner_id)',
      table_name || '_owner_delete',
      table_name
    );
  end loop;
end;
$$;

create policy application_packages_owner_delete
on public.application_packages for delete
to authenticated
using ((select auth.uid()) = owner_id);

create policy application_events_owner_insert
on public.application_events for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy device_pairings_owner_insert
on public.device_pairings for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy device_pairings_owner_delete
on public.device_pairings for delete
to authenticated
using ((select auth.uid()) = owner_id);

create policy device_tokens_owner_update
on public.device_tokens for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);
