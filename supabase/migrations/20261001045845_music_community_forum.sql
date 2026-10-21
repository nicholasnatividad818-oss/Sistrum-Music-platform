begin;
create table public.music_topics (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references auth.users(id),
 kind text not null check(kind in ('discussion','classified')),
 category text not null check(category in ('general','production','songwriting','collaboration','music-lessons','voice-lessons','gear','gigs','services')),
 title text not null check(length(trim(title)) between 5 and 120),
 body text not null check(length(trim(body)) between 20 and 6000),
 location text not null default '' check(length(location)<=120),
 price_text text not null default '' check(length(price_text)<=120),
 status text not null default 'open' check(status in ('open','closed','hidden')),
 expires_at timestamptz,
 created_at timestamptz not null default now(),
 check((kind='discussion' and expires_at is null) or (kind='classified' and expires_at>created_at))
);
create table public.music_replies (
 id uuid primary key default gen_random_uuid(), topic_id uuid not null references public.music_topics(id),
 author_id uuid not null references auth.users(id),
 body text not null check(length(trim(body)) between 2 and 3000),
 status text not null default 'visible' check(status in ('visible','hidden')),
 created_at timestamptz not null default now()
);
create table public.music_reports (
 id uuid primary key default gen_random_uuid(), topic_id uuid not null references public.music_topics(id),
 reporter_id uuid not null references auth.users(id),
 reason text not null check(length(trim(reason)) between 10 and 2000),
 status text not null default 'open' check(status in ('open','reviewed')),
 created_at timestamptz not null default now(), unique(topic_id,reporter_id)
);
alter table public.music_topics enable row level security;
alter table public.music_replies enable row level security;
alter table public.music_reports enable row level security;
revoke all on public.music_topics,public.music_replies,public.music_reports from anon,authenticated;
grant select on public.music_topics,public.music_replies,public.music_reports to authenticated;
grant insert(author_id,kind,category,title,body,location,price_text) on public.music_topics to authenticated;
grant update(status) on public.music_topics to authenticated;
grant insert(topic_id,author_id,body) on public.music_replies to authenticated;
grant update(status) on public.music_replies to authenticated;
grant insert(topic_id,reporter_id,reason) on public.music_reports to authenticated;
grant update(status) on public.music_reports to authenticated;
create policy music_topics_read on public.music_topics for select to authenticated using(status<>'hidden' or author_id=(select auth.uid()) or (select proposals_private.is_operator()));
create policy music_topics_create on public.music_topics for insert to authenticated with check(author_id=(select auth.uid()));
create policy music_topics_moderate on public.music_topics for update to authenticated using(author_id=(select auth.uid()) or (select proposals_private.is_operator())) with check(author_id=(select auth.uid()) or (select proposals_private.is_operator()));
create policy music_replies_read on public.music_replies for select to authenticated using(
 exists(select 1 from public.music_topics t where t.id=topic_id and (t.status<>'hidden' or t.author_id=(select auth.uid()) or (select proposals_private.is_operator())))
 and (status='visible' or author_id=(select auth.uid()) or (select proposals_private.is_operator()))
);
create policy music_replies_create on public.music_replies for insert to authenticated with check(author_id=(select auth.uid()));
create policy music_replies_moderate on public.music_replies for update to authenticated using(author_id=(select auth.uid()) or (select proposals_private.is_operator())) with check(author_id=(select auth.uid()) or (select proposals_private.is_operator()));
create policy music_reports_read on public.music_reports for select to authenticated using(reporter_id=(select auth.uid()) or (select proposals_private.is_operator()));
create policy music_reports_create on public.music_reports for insert to authenticated with check(reporter_id=(select auth.uid()));
create policy music_reports_review on public.music_reports for update to authenticated using((select proposals_private.is_operator())) with check((select proposals_private.is_operator()));

create function proposals_private.guard_music_topic() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,1));
  if (select count(*) from public.music_topics where author_id=auth.uid() and created_at>now()-interval '1 day')>=5 then raise exception 'Maximum five new threads or listings per day'; end if;
  if new.kind='classified' then new.expires_at:=now()+interval '30 days'; end if;
 else
  if not proposals_private.is_operator() and (new.author_id<>auth.uid() or old.status='hidden' or new.status not in ('closed','hidden')) then raise exception 'Only moderators can reopen or restore topics'; end if;
  if new.status=old.status then raise exception 'Topic status has not changed'; end if;
 end if;
 return new;
end $$;
create trigger music_topics_guard before insert or update on public.music_topics for each row execute function proposals_private.guard_music_topic();
create function proposals_private.guard_music_reply() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,2));
  if not exists(select 1 from public.music_topics t where t.id=new.topic_id and t.status='open' and (t.expires_at is null or t.expires_at>now())) then raise exception 'This thread is closed or its listing has expired'; end if;
  if (select count(*) from public.music_replies where author_id=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'Maximum twenty replies per hour'; end if;
 elsif not proposals_private.is_operator() and (new.author_id<>auth.uid() or new.status<>'hidden' or old.status='hidden') then raise exception 'Only moderators can restore replies';
 end if;
 return new;
end $$;
create trigger music_replies_guard before insert or update on public.music_replies for each row execute function proposals_private.guard_music_reply();
create function proposals_private.guard_music_report() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' and not exists(select 1 from public.music_topics where id=new.topic_id) then raise exception 'Thread unavailable'; end if;
 return new;
end $$;
create trigger music_reports_guard before insert on public.music_reports for each row execute function proposals_private.guard_music_report();
revoke all on function proposals_private.guard_music_topic(),proposals_private.guard_music_reply(),proposals_private.guard_music_report() from public;
create index music_topics_created on public.music_topics(created_at);
create index music_topics_author_created on public.music_topics(author_id,created_at);
create index music_replies_topic on public.music_replies(topic_id,created_at);
create index music_replies_author_created on public.music_replies(author_id,created_at);
create index music_reports_status on public.music_reports(status);
commit;
