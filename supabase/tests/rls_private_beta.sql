begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-00000000a001', 'authenticated', 'authenticated',
    'sistrum-rls-a@example.invalid', 'test-only', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"RLS Artist A"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-00000000a002', 'authenticated', 'authenticated',
    'sistrum-rls-b@example.invalid', 'test-only', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"RLS Artist B"}'::jsonb, now(), now()
  );

insert into public.tracks (id, owner_id, title, artist_name, is_public) values
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000a001', 'Public test track', 'RLS Artist A', true),
  ('00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-00000000a001', 'Private A track', 'RLS Artist A', false),
  ('00000000-0000-0000-0000-00000000b003', '00000000-0000-0000-0000-00000000a002', 'Private B track', 'RLS Artist B', false);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', true);

do $$
declare visible_count integer;
declare affected_count integer;
begin
  select count(*) into visible_count
  from public.tracks
  where id in (
    '00000000-0000-0000-0000-00000000b001',
    '00000000-0000-0000-0000-00000000b002',
    '00000000-0000-0000-0000-00000000b003'
  );
  if visible_count <> 2 then
    raise exception 'User A visibility failed: expected 2, got %', visible_count;
  end if;

  update public.tracks
  set title = 'Unauthorized update'
  where id = '00000000-0000-0000-0000-00000000b003';
  get diagnostics affected_count = row_count;
  if affected_count <> 0 then
    raise exception 'User A updated User B track';
  end if;

  begin
    insert into public.tracks (owner_id, title, artist_name)
    values ('00000000-0000-0000-0000-00000000a002', 'Unauthorized insert', 'Wrong owner');
    raise exception 'User A inserted a User B track';
  exception when insufficient_privilege then
    null;
  end;

  insert into public.track_likes (user_id, track_id)
  values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000b001');

  insert into public.comments (user_id, track_id, body, timestamp_seconds)
  values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000b001', 'RLS test', 10);

  begin
    insert into public.comments (user_id, track_id, body, timestamp_seconds)
    values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000b003', 'Unauthorized comment', 0);
    raise exception 'User A commented on hidden User B track';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a002', true);

do $$
declare visible_count integer;
begin
  select count(*) into visible_count
  from public.tracks
  where id in (
    '00000000-0000-0000-0000-00000000b001',
    '00000000-0000-0000-0000-00000000b002',
    '00000000-0000-0000-0000-00000000b003'
  );
  if visible_count <> 2 then
    raise exception 'User B visibility failed: expected 2, got %', visible_count;
  end if;
end;
$$;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);

do $$
declare visible_count integer;
begin
  select count(*) into visible_count
  from public.tracks
  where id in (
    '00000000-0000-0000-0000-00000000b001',
    '00000000-0000-0000-0000-00000000b002',
    '00000000-0000-0000-0000-00000000b003'
  );
  if visible_count <> 1 then
    raise exception 'Anonymous visibility failed: expected 1, got %', visible_count;
  end if;
end;
$$;

reset role;
rollback;

select 'passed' as rls_private_beta_test;
