-- ============================================================
-- SISTRUM BACKEND FOUNDATION
-- Profiles + tracks + RLS + Storage
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- PROFILES
-- ------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  banner_url text,
  bio text,
  location text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are publicly readable"
on public.profiles;

create policy "Profiles are publicly readable"
on public.profiles
for select
using (true);

drop policy if exists "Users can insert own profile"
on public.profiles;

create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update own profile"
on public.profiles;

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);


-- ------------------------------------------------------------
-- AUTOMATIC PROFILE CREATION
-- ------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    display_name
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created
on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();


-- ------------------------------------------------------------
-- TRACKS
-- ------------------------------------------------------------

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),

  owner_id uuid not null
    references auth.users(id)
    on delete cascade,

  title text not null,

  artist_name text not null default '',

  artist_avatar_url text,

  cover_art_url text,

  audio_url text,

  duration_seconds integer not null default 0,

  bpm integer not null default 0,

  genre text not null default '',

  tags text[] not null default '{}',

  waveform_data jsonb not null default '[]'::jsonb,

  play_count bigint not null default 0,

  like_count bigint not null default 0,

  repost_count bigint not null default 0,

  comment_count bigint not null default 0,

  description text,

  synth_preset text,

  is_public boolean not null default true,

  release_date timestamptz not null default now(),

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);

create index if not exists tracks_owner_id_idx
on public.tracks(owner_id);

create index if not exists tracks_release_date_idx
on public.tracks(release_date desc);

create index if not exists tracks_genre_idx
on public.tracks(genre);


alter table public.tracks enable row level security;

drop policy if exists "Public tracks are readable"
on public.tracks;

create policy "Public tracks are readable"
on public.tracks
for select
using (
  is_public = true
  or auth.uid() = owner_id
);

drop policy if exists "Authenticated users can create tracks"
on public.tracks;

create policy "Authenticated users can create tracks"
on public.tracks
for insert
to authenticated
with check (
  auth.uid() = owner_id
);

drop policy if exists "Owners can update tracks"
on public.tracks;

create policy "Owners can update tracks"
on public.tracks
for update
to authenticated
using (
  auth.uid() = owner_id
)
with check (
  auth.uid() = owner_id
);

drop policy if exists "Owners can delete tracks"
on public.tracks;

create policy "Owners can delete tracks"
on public.tracks
for delete
to authenticated
using (
  auth.uid() = owner_id
);


-- ------------------------------------------------------------
-- STORAGE BUCKETS
-- ------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public
)
values (
  'audio',
  'audio',
  true
)
on conflict (id)
do update set public = excluded.public;

insert into storage.buckets (
  id,
  name,
  public
)
values (
  'cover-art',
  'cover-art',
  true
)
on conflict (id)
do update set public = excluded.public;


-- ------------------------------------------------------------
-- AUDIO STORAGE POLICIES
-- Files must be stored under:
-- USER_UUID/file-name.mp3
-- ------------------------------------------------------------

drop policy if exists "Authenticated users upload own audio"
on storage.objects;

create policy "Authenticated users upload own audio"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'audio'
  and
  (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users update own audio"
on storage.objects;

create policy "Users update own audio"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'audio'
  and
  (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users delete own audio"
on storage.objects;

create policy "Users delete own audio"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'audio'
  and
  (storage.foldername(name))[1] = auth.uid()::text
);


-- ------------------------------------------------------------
-- COVER ART STORAGE POLICIES
-- ------------------------------------------------------------

drop policy if exists "Authenticated users upload own cover art"
on storage.objects;

create policy "Authenticated users upload own cover art"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'cover-art'
  and
  (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users update own cover art"
on storage.objects;

create policy "Users update own cover art"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'cover-art'
  and
  (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users delete own cover art"
on storage.objects;

create policy "Users delete own cover art"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'cover-art'
  and
  (storage.foldername(name))[1] = auth.uid()::text
);
