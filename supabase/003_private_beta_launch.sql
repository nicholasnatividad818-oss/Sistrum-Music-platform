-- Sistrum private-beta launch hardening.
-- NRN Catalog remains the source of truth for rights metadata; only public identity fields live here.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Replace the exposed auth trigger function with a private equivalent.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, username, terms_accepted_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    null,
    nullif(new.raw_user_meta_data ->> 'terms_accepted_at', '')::timestamptz
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

drop function if exists public.handle_new_user();

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;

alter table public.tracks
  add column if not exists catalog_track_id uuid,
  add column if not exists catalog_source text default 'nrn-catalog',
  add column if not exists isrc text,
  add column if not exists catalog_synced_at timestamptz;

create index if not exists tracks_catalog_track_id_idx on public.tracks(catalog_track_id);
create index if not exists tracks_isrc_idx on public.tracks(isrc);
create unique index if not exists tracks_owner_catalog_track_uidx
  on public.tracks(owner_id, catalog_source, catalog_track_id)
  where catalog_track_id is not null;

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.tracks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  timestamp_seconds integer not null default 0 check (timestamp_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comments_track_created_idx
  on public.comments(track_id, created_at);
create index if not exists comments_user_idx on public.comments(user_id);

create table if not exists public.track_likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

create index if not exists track_likes_track_idx on public.track_likes(track_id);

create table if not exists public.track_reposts (
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

create index if not exists track_reposts_track_idx on public.track_reposts(track_id);

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_following_idx on public.follows(following_id);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  cover_art_url text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists playlists_owner_idx on public.playlists(owner_id);

create table if not exists public.playlist_tracks (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  added_at timestamptz not null default now(),
  primary key (playlist_id, track_id)
);

create index if not exists playlist_tracks_track_idx on public.playlist_tracks(track_id);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  track_id uuid references public.tracks(id) on delete set null,
  reason text not null check (reason in ('copyright', 'harassment', 'spam', 'other')),
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists reports_status_created_idx on public.reports(status, created_at);
create index if not exists reports_reporter_idx on public.reports(reporter_id);
create index if not exists reports_track_idx on public.reports(track_id);

alter table public.comments enable row level security;
alter table public.track_likes enable row level security;
alter table public.track_reposts enable row level security;
alter table public.follows enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.reports enable row level security;

-- Replace existing policies with init-plan-friendly ownership checks.
drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable" on public.profiles
for select to anon, authenticated using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Public tracks are readable" on public.tracks;
drop policy if exists "Authenticated users can create tracks" on public.tracks;
drop policy if exists "Owners can update tracks" on public.tracks;
drop policy if exists "Owners can delete tracks" on public.tracks;

create policy "Public tracks are readable" on public.tracks
for select to anon, authenticated
using (is_public or (select auth.uid()) = owner_id);
create policy "Owners can create tracks" on public.tracks
for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Owners can update tracks" on public.tracks
for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);
create policy "Owners can delete tracks" on public.tracks
for delete to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "Visible comments are readable" on public.comments;
drop policy if exists "Users create own comments" on public.comments;
drop policy if exists "Users update own comments" on public.comments;
drop policy if exists "Users delete own comments" on public.comments;
create policy "Visible comments are readable" on public.comments
for select to anon, authenticated
using (exists (
  select 1 from public.tracks t
  where t.id = track_id and (t.is_public or t.owner_id = (select auth.uid()))
));
create policy "Users create own comments" on public.comments
for insert to authenticated
with check ((select auth.uid()) = user_id and exists (
  select 1 from public.tracks t where t.id = track_id and t.is_public
));
create policy "Users update own comments" on public.comments
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "Users delete own comments" on public.comments
for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users read own likes" on public.track_likes;
drop policy if exists "Users create own likes" on public.track_likes;
drop policy if exists "Users delete own likes" on public.track_likes;
create policy "Users read own likes" on public.track_likes
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create own likes" on public.track_likes
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users delete own likes" on public.track_likes
for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users read own reposts" on public.track_reposts;
drop policy if exists "Users create own reposts" on public.track_reposts;
drop policy if exists "Users delete own reposts" on public.track_reposts;
create policy "Users read own reposts" on public.track_reposts
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create own reposts" on public.track_reposts
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users delete own reposts" on public.track_reposts
for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users read own follows" on public.follows;
drop policy if exists "Users create own follows" on public.follows;
drop policy if exists "Users delete own follows" on public.follows;
create policy "Users read own follows" on public.follows
for select to authenticated using ((select auth.uid()) = follower_id);
create policy "Users create own follows" on public.follows
for insert to authenticated with check ((select auth.uid()) = follower_id);
create policy "Users delete own follows" on public.follows
for delete to authenticated using ((select auth.uid()) = follower_id);

drop policy if exists "Visible playlists are readable" on public.playlists;
drop policy if exists "Owners create playlists" on public.playlists;
drop policy if exists "Owners update playlists" on public.playlists;
drop policy if exists "Owners delete playlists" on public.playlists;
create policy "Visible playlists are readable" on public.playlists
for select to anon, authenticated
using (is_public or (select auth.uid()) = owner_id);
create policy "Owners create playlists" on public.playlists
for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Owners update playlists" on public.playlists
for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);
create policy "Owners delete playlists" on public.playlists
for delete to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "Visible playlist tracks are readable" on public.playlist_tracks;
drop policy if exists "Playlist owners add tracks" on public.playlist_tracks;
drop policy if exists "Playlist owners remove tracks" on public.playlist_tracks;
create policy "Visible playlist tracks are readable" on public.playlist_tracks
for select to anon, authenticated
using (exists (
  select 1 from public.playlists p
  where p.id = playlist_id and (p.is_public or p.owner_id = (select auth.uid()))
));
create policy "Playlist owners add tracks" on public.playlist_tracks
for insert to authenticated with check (exists (
  select 1 from public.playlists p
  where p.id = playlist_id and p.owner_id = (select auth.uid())
));
create policy "Playlist owners remove tracks" on public.playlist_tracks
for delete to authenticated using (exists (
  select 1 from public.playlists p
  where p.id = playlist_id and p.owner_id = (select auth.uid())
));

drop policy if exists "Users create reports" on public.reports;
create policy "Users create reports" on public.reports
for insert to authenticated with check ((select auth.uid()) = reporter_id);

-- Maintain counts without exposing counter columns to clients.
create or replace function private.sync_track_social_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_track uuid := coalesce(new.track_id, old.track_id);
begin
  update public.tracks
  set like_count = (select count(*) from public.track_likes where track_id = target_track),
      repost_count = (select count(*) from public.track_reposts where track_id = target_track),
      updated_at = now()
  where id = target_track;
  return coalesce(new, old);
end;
$$;
revoke all on function private.sync_track_social_counts() from public, anon, authenticated;

drop trigger if exists sync_track_likes on public.track_likes;
create trigger sync_track_likes after insert or delete on public.track_likes
for each row execute function private.sync_track_social_counts();
drop trigger if exists sync_track_reposts on public.track_reposts;
create trigger sync_track_reposts after insert or delete on public.track_reposts
for each row execute function private.sync_track_social_counts();

create or replace function private.sync_track_comment_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_track uuid := coalesce(new.track_id, old.track_id);
begin
  update public.tracks
  set comment_count = (select count(*) from public.comments where track_id = target_track),
      updated_at = now()
  where id = target_track;
  return coalesce(new, old);
end;
$$;
revoke all on function private.sync_track_comment_count() from public, anon, authenticated;
drop trigger if exists sync_track_comments on public.comments;
create trigger sync_track_comments after insert or delete on public.comments
for each row execute function private.sync_track_comment_count();

-- Private-beta abuse controls: 5 new tracks/day, 25 total, 30 comments/hour.
create or replace function private.enforce_track_quota()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.tracks where owner_id = new.owner_id) >= 25 then
    raise exception 'Private beta limit reached: 25 tracks per account';
  end if;
  if (select count(*) from public.tracks
      where owner_id = new.owner_id and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Private beta limit reached: 5 uploads per 24 hours';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_track_quota() from public, anon, authenticated;
drop trigger if exists enforce_track_quota on public.tracks;
create trigger enforce_track_quota before insert on public.tracks
for each row execute function private.enforce_track_quota();

create or replace function private.enforce_comment_quota()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.comments
      where user_id = new.user_id and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Private beta limit reached: 30 comments per hour';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_comment_quota() from public, anon, authenticated;
drop trigger if exists enforce_comment_quota on public.comments;
create trigger enforce_comment_quota before insert on public.comments
for each row execute function private.enforce_comment_quota();

-- Explicit Data API privileges; RLS remains the row-level boundary.
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.tracks, public.comments, public.playlists, public.playlist_tracks to anon, authenticated;

grant update (username, display_name, avatar_url, banner_url, bio, location, terms_accepted_at, updated_at)
  on public.profiles to authenticated;
grant insert (owner_id, title, artist_name, artist_avatar_url, cover_art_url, audio_url,
              duration_seconds, bpm, genre, tags, waveform_data, description, synth_preset,
              is_public, release_date)
  on public.tracks to authenticated;
grant update (title, artist_name, artist_avatar_url, cover_art_url, audio_url,
              duration_seconds, bpm, genre, tags, waveform_data, description, synth_preset,
              is_public, release_date, updated_at)
  on public.tracks to authenticated;
grant delete on public.tracks to authenticated;

grant select on public.track_likes, public.track_reposts, public.follows to authenticated;
grant insert (user_id, track_id) on public.track_likes, public.track_reposts to authenticated;
grant delete on public.track_likes, public.track_reposts to authenticated;
grant insert (follower_id, following_id) on public.follows to authenticated;
grant delete on public.follows to authenticated;

grant insert (track_id, user_id, body, timestamp_seconds) on public.comments to authenticated;
grant update (body, timestamp_seconds, updated_at) on public.comments to authenticated;
grant delete on public.comments to authenticated;

grant insert (owner_id, title, description, cover_art_url, is_public) on public.playlists to authenticated;
grant update (title, description, cover_art_url, is_public, updated_at) on public.playlists to authenticated;
grant delete on public.playlists to authenticated;
grant insert (playlist_id, track_id, position) on public.playlist_tracks to authenticated;
grant delete on public.playlist_tracks to authenticated;
grant insert (reporter_id, track_id, reason, details) on public.reports to authenticated;

update storage.buckets
set file_size_limit = 104857600,
    allowed_mime_types = array[
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
      'audio/ogg', 'audio/aac', 'audio/flac', 'audio/x-flac', 'audio/mp4'
    ]
where id = 'audio';

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
where id = 'cover-art';

drop policy if exists "Authenticated users upload own audio" on storage.objects;
drop policy if exists "Users update own audio" on storage.objects;
drop policy if exists "Users delete own audio" on storage.objects;
drop policy if exists "Authenticated users upload own cover art" on storage.objects;
drop policy if exists "Users update own cover art" on storage.objects;
drop policy if exists "Users delete own cover art" on storage.objects;

create policy "Authenticated users upload own audio" on storage.objects
for insert to authenticated
with check (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users update own audio" on storage.objects
for update to authenticated
using (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete own audio" on storage.objects
for delete to authenticated
using (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Authenticated users upload own cover art" on storage.objects
for insert to authenticated
with check (bucket_id = 'cover-art' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users update own cover art" on storage.objects
for update to authenticated
using (bucket_id = 'cover-art' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'cover-art' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete own cover art" on storage.objects
for delete to authenticated
using (bucket_id = 'cover-art' and (storage.foldername(name))[1] = (select auth.uid())::text);
