-- ============================================================
-- Sistrum usage limits and Sistrum Pro entitlements
-- Run this in the Supabase SQL editor after 001 and 002.
-- The webhook (service role) is the only writer of entitlements.
-- ============================================================

alter table public.tracks
  add column if not exists audio_bytes bigint not null default 0;

create table if not exists public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'active' check (status in ('active', 'trialing', 'canceled', 'past_due', 'incomplete')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists entitlements_stripe_customer_uidx
  on public.entitlements(stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists entitlements_stripe_subscription_uidx
  on public.entitlements(stripe_subscription_id)
  where stripe_subscription_id is not null;

alter table public.entitlements enable row level security;

drop policy if exists "Users read own entitlement" on public.entitlements;
create policy "Users read own entitlement"
on public.entitlements
for select
to authenticated
using (auth.uid() = user_id);

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,
  call_count integer not null default 0,
  primary key (user_id, month)
);

alter table public.ai_usage enable row level security;

drop policy if exists "Users read own AI usage" on public.ai_usage;
create policy "Users read own AI usage"
on public.ai_usage
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.plan_caps(p_plan text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_plan = 'pro' then
      '{"trackCap":100,"byteCap":5368709120,"aiCap":300,"fileCap":83886080}'::jsonb
    else
      '{"trackCap":3,"byteCap":104857600,"aiCap":20,"fileCap":83886080}'::jsonb
  end;
$$;

create or replace function public.billing_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ent_plan text;
  ent_status text := 'active';
  ent_customer text;
  ent_period timestamptz;
  plan text := 'free';
  caps jsonb;
  used integer := 0;
  track_count integer := 0;
  audio_total bigint := 0;
  month_start date := date_trunc('month', now())::date;
begin
  if uid is null then
    return jsonb_build_object('authenticated', false);
  end if;

  select e.plan, e.status, e.stripe_customer_id, e.current_period_end
  into ent_plan, ent_status, ent_customer, ent_period
  from public.entitlements e
  where e.user_id = uid;

  if found
    and ent_plan = 'pro'
    and ent_status in ('active', 'trialing')
    and (ent_period is null or ent_period > now())
  then
    plan := 'pro';
  end if;
  if not found then
    ent_status := 'active';
  end if;

  caps := public.plan_caps(plan);

  select coalesce(call_count, 0) into used
  from public.ai_usage
  where user_id = uid and month = month_start;

  select count(*)::integer, coalesce(sum(audio_bytes), 0)
  into track_count, audio_total
  from public.tracks
  where owner_id = uid;

  return jsonb_build_object(
    'authenticated', true,
    'plan', plan,
    'status', coalesce(ent.status, 'active'),
    'trackCount', track_count,
    'audioBytes', audio_total,
    'trackCap', (caps->>'trackCap')::integer,
    'byteCap', (caps->>'byteCap')::bigint,
    'fileCap', (caps->>'fileCap')::bigint,
    'aiUsed', coalesce(used, 0),
    'aiCap', (caps->>'aiCap')::integer,
    'stripeCustomerId', ent_customer,
    'currentPeriodEnd', ent_period
  );
end;
$$;

create or replace function public.assert_upload_allowed(p_bytes bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  status jsonb;
  track_count integer;
  audio_total bigint;
  track_cap integer;
  byte_cap bigint;
  file_cap bigint;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_bytes is null or p_bytes < 0 then
    raise exception 'Invalid file size' using errcode = '22023';
  end if;

  status := public.billing_status();
  track_count := (status->>'trackCount')::integer;
  audio_total := (status->>'audioBytes')::bigint;
  track_cap := (status->>'trackCap')::integer;
  byte_cap := (status->>'byteCap')::bigint;
  file_cap := (status->>'fileCap')::bigint;

  if p_bytes > file_cap then
    raise exception 'File is larger than the 80 MB upload limit' using errcode = 'P0001';
  end if;
  if track_count >= track_cap then
    raise exception 'Track limit reached for your plan' using errcode = 'P0001';
  end if;
  if audio_total + p_bytes > byte_cap then
    raise exception 'Storage limit reached for your plan' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.create_track(payload jsonb)
returns public.tracks
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_row public.tracks%rowtype;
  audio_url text := nullif(payload->>'audio_url', '');
  cover_url text := nullif(payload->>'cover_art_url', '');
  title text := left(btrim(coalesce(payload->>'title', '')), 200);
  artist_name text := left(btrim(coalesce(payload->>'artist_name', '')), 120);
  audio_bytes bigint := coalesce((payload->>'audio_bytes')::bigint, 0);
  preset text := nullif(payload->>'synth_preset', '');
  waveform jsonb := coalesce(payload->'waveform_data', '[]'::jsonb);
  tags text[];
  catalog_id uuid;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if title = '' then
    raise exception 'Title is required' using errcode = '22023';
  end if;
  if preset is not null and preset not in ('lofi', 'synthwave', 'house', 'ambient', 'trap', 'futurebass', 'chillhop') then
    raise exception 'Unknown synth preset' using errcode = '22023';
  end if;
  if audio_url is null and preset is null then
    raise exception 'Upload an audio file or choose a studio preset' using errcode = '22023';
  end if;
  if audio_url is not null and position('/audio/' || uid::text || '/' in audio_url) = 0 then
    raise exception 'Audio must be uploaded to your storage folder' using errcode = '22023';
  end if;
  if cover_url is not null
    and cover_url like '%/storage/v1/object/public/cover-art/%'
    and position('/cover-art/' || uid::text || '/' in cover_url) = 0
  then
    raise exception 'Cover art must be uploaded to your storage folder' using errcode = '22023';
  end if;
  if jsonb_typeof(waveform) <> 'array' or jsonb_array_length(waveform) > 200 then
    raise exception 'Invalid waveform' using errcode = '22023';
  end if;

  perform public.assert_upload_allowed(audio_bytes);

  select coalesce(array_agg(tag), '{}')
  into tags
  from (
    select left(value, 32) as tag
    from jsonb_array_elements_text(coalesce(payload->'tags', '[]'::jsonb))
    where length(btrim(value)) > 0
    limit 12
  ) limited;

  if nullif(payload->>'catalog_track_id', '') is not null then
    catalog_id := (payload->>'catalog_track_id')::uuid;
  end if;

  insert into public.tracks (
    owner_id,
    title,
    artist_name,
    artist_avatar_url,
    cover_art_url,
    audio_url,
    duration_seconds,
    bpm,
    genre,
    tags,
    waveform_data,
    description,
    synth_preset,
    is_public,
    audio_bytes,
    catalog_track_id,
    catalog_source,
    isrc,
    catalog_synced_at
  )
  values (
    uid,
    title,
    coalesce(nullif(artist_name, ''), 'Sistrum artist'),
    nullif(payload->>'artist_avatar_url', ''),
    cover_url,
    audio_url,
    least(greatest(coalesce((payload->>'duration_seconds')::integer, 0), 0), 86400),
    least(greatest(coalesce((payload->>'bpm')::integer, 0), 0), 400),
    left(coalesce(nullif(payload->>'genre', ''), 'Electronic'), 40),
    tags,
    waveform,
    left(coalesce(payload->>'description', ''), 2000),
    preset,
    coalesce((payload->>'is_public')::boolean, true),
    audio_bytes,
    catalog_id,
    case when catalog_id is null then null else coalesce(nullif(payload->>'catalog_source', ''), 'nrn-catalog') end,
    nullif(left(coalesce(payload->>'isrc', ''), 32), ''),
    case when catalog_id is null then null else now() end
  )
  returning * into new_row;

  return new_row;
end;
$$;

create or replace function public.increment_play_count(p_track_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tracks
  set play_count = play_count + 1,
      updated_at = now()
  where id = p_track_id
    and (is_public = true or owner_id = auth.uid());
end;
$$;

create or replace function public.consume_ai_call()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  status jsonb;
  cap integer;
  used integer;
  month_start date := date_trunc('month', now())::date;
begin
  if uid is null then
    return jsonb_build_object('allowed', false, 'error', 'Not authenticated');
  end if;

  status := public.billing_status();
  cap := (status->>'aiCap')::integer;

  insert into public.ai_usage (user_id, month, call_count)
  values (uid, month_start, 1)
  on conflict (user_id, month)
  do update set call_count = public.ai_usage.call_count + 1
  where public.ai_usage.call_count < cap
  returning call_count into used;

  if used is null then
    select call_count into used
    from public.ai_usage
    where user_id = uid and month = month_start;
    return jsonb_build_object(
      'allowed', false,
      'plan', status->>'plan',
      'used', coalesce(used, cap),
      'cap', cap
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'plan', status->>'plan',
    'used', used,
    'cap', cap
  );
end;
$$;

create or replace function public.release_ai_call()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  month_start date := date_trunc('month', now())::date;
begin
  if uid is null then
    return;
  end if;
  update public.ai_usage
  set call_count = greatest(call_count - 1, 0)
  where user_id = uid and month = month_start;
end;
$$;

revoke all on function public.plan_caps(text) from public;
revoke all on function public.billing_status() from public;
revoke all on function public.assert_upload_allowed(bigint) from public;
revoke all on function public.create_track(jsonb) from public;
revoke all on function public.increment_play_count(uuid) from public;
revoke all on function public.consume_ai_call() from public;
revoke all on function public.release_ai_call() from public;

grant execute on function public.plan_caps(text) to anon, authenticated;
grant execute on function public.billing_status() to authenticated;
grant execute on function public.assert_upload_allowed(bigint) to authenticated;
grant execute on function public.create_track(jsonb) to authenticated;
grant execute on function public.increment_play_count(uuid) to anon, authenticated;
grant execute on function public.consume_ai_call() to authenticated;
grant execute on function public.release_ai_call() to authenticated;
