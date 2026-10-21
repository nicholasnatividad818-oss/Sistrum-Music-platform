-- Fixed-fee promotional work. No payment processing or escrow is implied.
begin;
create table public.signal_campaigns (
 id uuid primary key default gen_random_uuid(),
 artist_id uuid not null references auth.users(id),
 track_id uuid not null references public.tracks(id),
 title text not null check(length(trim(title)) between 3 and 120),
 brief text not null check(length(trim(brief)) between 20 and 5000),
 kind text not null check(kind in ('share','content','campaign')),
 budget_cents integer not null check(budget_cents between 100 and 10000000),
 fee_cents integer not null check(fee_cents between 100 and budget_cents),
 currency text not null default 'USD' check(currency = 'USD'),
 deadline timestamptz not null check(deadline > created_at),
 created_at timestamptz not null default now()
);
create table public.signal_jobs (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.signal_campaigns(id),
 promoter_id uuid not null references auth.users(id),
 pitch text not null check(length(trim(pitch)) between 10 and 2000),
 status text not null default 'applied' check(status in ('applied','selected','submitted','revision','approved','declined')),
 proof_url text check(proof_url ~ '^https://[^[:space:]]+$' and length(proof_url) <= 2000),
 proof_notes text not null default '' check(length(proof_notes) <= 3000),
 review_notes text not null default '' check(length(review_notes) <= 3000),
 fee_cents integer not null,
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 unique(campaign_id,promoter_id)
);
alter table public.signal_campaigns enable row level security;
alter table public.signal_jobs enable row level security;
revoke all on public.signal_campaigns, public.signal_jobs from anon, authenticated;
grant select on public.signal_campaigns, public.signal_jobs to authenticated;
grant insert(artist_id,track_id,title,brief,kind,budget_cents,fee_cents,deadline) on public.signal_campaigns to authenticated;
-- UPDATE privilege is needed for SELECT FOR UPDATE; immutable trigger disallows edits.
grant update(title) on public.signal_campaigns to authenticated;
grant insert(campaign_id,promoter_id,pitch) on public.signal_jobs to authenticated;
grant update(status,proof_url,proof_notes,review_notes) on public.signal_jobs to authenticated;
create policy signal_campaign_read on public.signal_campaigns for select to authenticated using(true);
create policy signal_campaign_create on public.signal_campaigns for insert to authenticated with check(
 artist_id = (select auth.uid()) and exists(select 1 from public.tracks t where t.id=track_id and t.owner_id=(select auth.uid()))
);
create policy signal_campaign_lock on public.signal_campaigns for update to authenticated using(artist_id=(select auth.uid())) with check(artist_id=(select auth.uid()));
create policy signal_job_read on public.signal_jobs for select to authenticated using(
 promoter_id=(select auth.uid()) or exists(select 1 from public.signal_campaigns c where c.id=campaign_id and c.artist_id=(select auth.uid()))
);
create policy signal_job_create on public.signal_jobs for insert to authenticated with check(promoter_id=(select auth.uid()));
create policy signal_job_update on public.signal_jobs for update to authenticated using(
 promoter_id=(select auth.uid()) or exists(select 1 from public.signal_campaigns c where c.id=campaign_id and c.artist_id=(select auth.uid()))
) with check(promoter_id=(select auth.uid()) or exists(select 1 from public.signal_campaigns c where c.id=campaign_id and c.artist_id=(select auth.uid())));
create schema if not exists signal_private;
revoke all on schema signal_private from public;
create function signal_private.immutable_campaign() returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'Campaign terms are immutable; create a new campaign.'; end $$;
create trigger signal_campaign_immutable before update on public.signal_campaigns for each row execute function signal_private.immutable_campaign();
create function signal_private.guard_job() returns trigger language plpgsql security invoker set search_path='' as $$
declare c public.signal_campaigns; committed bigint;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into c from public.signal_campaigns where id=new.campaign_id;
 if c.id is null then raise exception 'Campaign unavailable'; end if;
 if tg_op='INSERT' then
  if new.promoter_id<>auth.uid() or new.promoter_id=c.artist_id or c.deadline<=now() then raise exception 'Application not permitted'; end if;
  new.status:='applied'; new.fee_cents:=c.fee_cents; new.approved_at:=null;
  new.proof_url:=null; new.proof_notes:=''; new.review_notes:='';
  return new;
 end if;
 if row(new.id,new.campaign_id,new.promoter_id,new.pitch,new.fee_cents,new.created_at) is distinct from row(old.id,old.campaign_id,old.promoter_id,old.pitch,old.fee_cents,old.created_at) then raise exception 'Contract terms cannot change'; end if;
 if auth.uid()=c.artist_id then
  if row(new.proof_url,new.proof_notes) is distinct from row(old.proof_url,old.proof_notes) then raise exception 'Artist cannot edit proof'; end if;
  if not ((old.status='applied' and new.status in ('selected','declined')) or (old.status='submitted' and new.status in ('approved','revision'))) then raise exception 'Invalid artist transition'; end if;
  if new.status='selected' then
   select * into c from public.signal_campaigns where id=new.campaign_id for update;
   if c.deadline<=now() then raise exception 'Campaign has expired'; end if;
   select coalesce(sum(fee_cents),0) into committed from public.signal_jobs where campaign_id=c.id and status in ('selected','submitted','revision','approved');
   if committed+new.fee_cents>c.budget_cents then raise exception 'Campaign budget exceeded'; end if;
  end if;
  if new.status='revision' and length(trim(new.review_notes))<5 then raise exception 'Explain the requested revision'; end if;
  if new.status='approved' then new.approved_at:=now(); end if;
 elsif auth.uid()=new.promoter_id then
  if not (old.status in ('selected','revision') and new.status='submitted') or new.proof_url is null then raise exception 'Submit proof for an accepted assignment'; end if;
  if new.review_notes is distinct from old.review_notes then raise exception 'Review belongs to artist'; end if;
 else raise exception 'Not a contract participant';
 end if;
 if new.status<>'approved' then new.approved_at:=old.approved_at; end if;
 return new;
end $$;
create trigger signal_job_guard before insert or update on public.signal_jobs for each row execute function signal_private.guard_job();
revoke all on function signal_private.guard_job(), signal_private.immutable_campaign() from public;
create index signal_jobs_promoter on public.signal_jobs(promoter_id);
create index signal_campaign_artist on public.signal_campaigns(artist_id);
commit;
