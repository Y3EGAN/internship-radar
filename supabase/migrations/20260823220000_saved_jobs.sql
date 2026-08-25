alter table public.jobs
  add column saved_at timestamptz;

create index jobs_owner_saved_idx
  on public.jobs (owner_id, saved_at desc, id desc)
  where saved_at is not null;
