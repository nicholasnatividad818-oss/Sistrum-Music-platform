-- Run once in the target project's SQL editor before deploying the functions.
create table if not exists public.labelgrid_events (
  id text primary key,
  event text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
create table if not exists public.labelgrid_submissions (
  id uuid primary key default gen_random_uuid(),
  release_id text not null unique,
  operator_id uuid references auth.users(id) on delete set null,
  status text not null default 'attempting' check (status in ('attempting','submitted','reconcile')),
  response jsonb,
  created_at timestamptz not null default now()
);
alter table public.labelgrid_events enable row level security;
alter table public.labelgrid_submissions enable row level security;
revoke all on public.labelgrid_events, public.labelgrid_submissions from anon, authenticated;
grant all on public.labelgrid_events, public.labelgrid_submissions to service_role;
-- No browser policies: operator authorization is checked by the Edge Function.
