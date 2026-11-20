-- REVIEW BEFORE APPLYING. The integration writes only server-side using the service-role key.
-- Do not expose OAuth tokens or PKCE verifiers to the Supabase Data API.
create table if not exists public.soundcloud_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token_enc text not null,
  refresh_token_enc text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.soundcloud_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  verifier_enc text not null,
  expires_at timestamptz not null
);
create index if not exists soundcloud_oauth_states_expires_idx on public.soundcloud_oauth_states(expires_at);
create table if not exists public.soundcloud_catalog_tracks (
  user_id uuid not null references auth.users(id) on delete cascade,
  soundcloud_urn text not null,
  title text not null,
  genre text,
  tags text,
  description text,
  permalink_url text,
  artwork_url text,
  duration_ms bigint,
  visibility text,
  synced_at timestamptz not null default now(),
  primary key (user_id, soundcloud_urn)
);
create index if not exists soundcloud_catalog_tracks_user_synced_idx on public.soundcloud_catalog_tracks(user_id, synced_at desc);
alter table public.soundcloud_connections enable row level security;
alter table public.soundcloud_oauth_states enable row level security;
alter table public.soundcloud_catalog_tracks enable row level security;
-- No anon/authenticated policies: only trusted server-side service role can access these tables.
revoke all on public.soundcloud_connections from anon, authenticated;
revoke all on public.soundcloud_oauth_states from anon, authenticated;
revoke all on public.soundcloud_catalog_tracks from anon, authenticated;
