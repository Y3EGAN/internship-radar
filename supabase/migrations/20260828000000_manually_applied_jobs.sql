alter table public.jobs
  add column applied_at timestamptz;

create index jobs_owner_applied_idx
  on public.jobs (owner_id, applied_at desc, id desc)
  where applied_at is not null;
