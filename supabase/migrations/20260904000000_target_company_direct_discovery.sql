alter type public.ats_type add value if not exists 'career_page';

create type public.source_render_mode as enum ('http', 'browser');

alter table public.source_endpoints
  add column render_mode public.source_render_mode not null default 'http';
