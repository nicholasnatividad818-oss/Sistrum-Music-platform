begin;
create schema if not exists proposals_private;
revoke all on schema proposals_private from public,anon,authenticated;
grant usage on schema proposals_private to authenticated;

-- Bootstrap operators only through a trusted database administrator. No browser writes.
create table public.proposal_operators (
 user_id uuid primary key references auth.users(id), created_at timestamptz not null default now()
);
alter table public.proposal_operators enable row level security;
revoke all on public.proposal_operators from anon,authenticated;
grant select on public.proposal_operators to authenticated;
create policy proposal_operator_self on public.proposal_operators for select to authenticated using(user_id=(select auth.uid()));
create function proposals_private.is_operator() returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.proposal_operators where user_id=auth.uid());
$$;
-- A narrow trusted lookup is required because auth.users is intentionally inaccessible to clients.
-- No caller-supplied user ID; callers can only check their own confirmed account age.
create function proposals_private.can_vote() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and created_at <= now()-interval '7 days');
$$;
revoke all on function proposals_private.is_operator(),proposals_private.can_vote() from public,anon,authenticated;
grant execute on function proposals_private.is_operator(),proposals_private.can_vote() to authenticated;

create table public.community_proposals (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references auth.users(id),
 title text not null check(length(trim(title)) between 5 and 120),
 problem text not null check(length(trim(problem)) between 20 and 3000),
 solution text not null check(length(trim(solution)) between 20 and 3000),
 success_criteria text not null check(length(trim(success_criteria)) between 10 and 2000),
 category text not null check(category in ('music','community','creator-tools','accessibility','platform')),
 status text not null default 'open' check(status in ('open','reviewing','accepted','deferred','declined','shipped')),
 review_note text not null default '' check(length(review_note)<=3000),
 created_at timestamptz not null default now()
);
create table public.proposal_votes (
 proposal_id uuid not null references public.community_proposals(id),
 voter_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(), primary key(proposal_id,voter_id)
);
create table public.proposal_projects (
 id uuid primary key default gen_random_uuid(),
 proposal_id uuid not null unique references public.community_proposals(id),
 operator_id uuid not null references auth.users(id),
 brief text not null check(length(trim(brief)) between 20 and 5000),
 budget_cents integer not null check(budget_cents between 100 and 10000000),
 deadline timestamptz not null,
 developer_id uuid references auth.users(id),
 created_at timestamptz not null default now(), check(deadline>created_at)
);
create table public.developer_applications (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.proposal_projects(id),
 developer_id uuid not null references auth.users(id),
 plan text not null check(length(trim(plan)) between 20 and 4000),
 portfolio_url text not null check(portfolio_url ~ '^https://[^[:space:]]+$' and length(portfolio_url)<=2000),
 created_at timestamptz not null default now(), unique(project_id,developer_id)
);
create table public.project_milestones (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.proposal_projects(id),
 title text not null check(length(trim(title)) between 5 and 120),
 acceptance_criteria text not null check(length(trim(acceptance_criteria)) between 20 and 3000),
 amount_cents integer not null check(amount_cents between 100 and 10000000),
 status text not null default 'pending' check(status in ('pending','submitted','revision','accepted')),
 pull_request_url text check(pull_request_url ~ '^https://github[.]com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/[0-9]+$'),
 delivery_notes text not null default '' check(length(delivery_notes)<=3000),
 review_note text not null default '' check(length(review_note)<=3000),
 quality_score integer check(quality_score between 1 and 5),
 accepted_at timestamptz,
 created_at timestamptz not null default now()
);

alter table public.community_proposals enable row level security;
alter table public.proposal_votes enable row level security;
alter table public.proposal_projects enable row level security;
alter table public.developer_applications enable row level security;
alter table public.project_milestones enable row level security;
revoke all on public.community_proposals,public.proposal_votes,public.proposal_projects,public.developer_applications,public.project_milestones from anon,authenticated;
grant select on public.community_proposals,public.proposal_votes,public.proposal_projects,public.developer_applications,public.project_milestones to authenticated;
grant insert(author_id,title,problem,solution,success_criteria,category) on public.community_proposals to authenticated;
grant update(status,review_note) on public.community_proposals to authenticated;
grant insert(proposal_id,voter_id) on public.proposal_votes to authenticated;
grant delete on public.proposal_votes to authenticated;
grant insert(proposal_id,operator_id,brief,budget_cents,deadline) on public.proposal_projects to authenticated;
grant update(developer_id) on public.proposal_projects to authenticated;
grant insert(project_id,developer_id,plan,portfolio_url) on public.developer_applications to authenticated;
grant insert(project_id,title,acceptance_criteria,amount_cents) on public.project_milestones to authenticated;
grant update(status,pull_request_url,delivery_notes,review_note,quality_score) on public.project_milestones to authenticated;

create policy proposals_read on public.community_proposals for select to authenticated using(true);
create policy proposals_create on public.community_proposals for insert to authenticated with check(author_id=(select auth.uid()));
create policy proposals_review on public.community_proposals for update to authenticated using((select proposals_private.is_operator())) with check((select proposals_private.is_operator()));
-- Member votes are transparent to other signed-in members; UI states this explicitly.
create policy votes_read on public.proposal_votes for select to authenticated using(true);
create policy votes_create on public.proposal_votes for insert to authenticated with check(voter_id=(select auth.uid()) and (select proposals_private.can_vote()));
create policy votes_remove on public.proposal_votes for delete to authenticated using(voter_id=(select auth.uid()));
create policy projects_read on public.proposal_projects for select to authenticated using(true);
create policy projects_create on public.proposal_projects for insert to authenticated with check(operator_id=(select auth.uid()) and (select proposals_private.is_operator()));
create policy projects_select on public.proposal_projects for update to authenticated using((select proposals_private.is_operator())) with check((select proposals_private.is_operator()));
create policy applications_read on public.developer_applications for select to authenticated using(developer_id=(select auth.uid()) or (select proposals_private.is_operator()));
create policy applications_create on public.developer_applications for insert to authenticated with check(developer_id=(select auth.uid()));
create policy milestones_read on public.project_milestones for select to authenticated using(true);
create policy milestones_create on public.project_milestones for insert to authenticated with check((select proposals_private.is_operator()));
create policy milestones_deliver on public.project_milestones for update to authenticated using(
 (select proposals_private.is_operator()) or exists(select 1 from public.proposal_projects p where p.id=project_id and p.developer_id=(select auth.uid()))
) with check((select proposals_private.is_operator()) or exists(select 1 from public.proposal_projects p where p.id=project_id and p.developer_id=(select auth.uid())));

create function proposals_private.guard_proposal() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
  if (select count(*) from public.community_proposals where author_id=auth.uid() and created_at>now()-interval '1 day')>=3 then raise exception 'Maximum three proposals per day'; end if;
 else
  if not proposals_private.is_operator() or new.status=old.status then raise exception 'Operator review required'; end if;
  if length(trim(new.review_note))<10 then raise exception 'Explain the review decision'; end if;
  if old.status='shipped' then raise exception 'Shipped proposals are final'; end if;
  if exists(select 1 from public.proposal_projects where proposal_id=new.id) and new.status<>'shipped' then raise exception 'A commissioned proposal can only be marked shipped'; end if;
  if new.status='shipped' and not exists(
   select 1 from public.proposal_projects p where p.proposal_id=new.id and p.developer_id is not null
   and exists(select 1 from public.project_milestones m where m.project_id=p.id)
   and not exists(select 1 from public.project_milestones m where m.project_id=p.id and m.status<>'accepted')
  ) then raise exception 'Accept all project milestones before marking shipped'; end if;
 end if;
 return new;
end $$;
create trigger community_proposals_guard before insert or update on public.community_proposals for each row execute function proposals_private.guard_proposal();
create function proposals_private.guard_vote() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.community_proposals where id=new.proposal_id and status in ('open','reviewing')) then raise exception 'Voting is closed for this proposal'; end if;
 return new;
end $$;
create trigger proposal_votes_guard before insert on public.proposal_votes for each row execute function proposals_private.guard_vote();

create function proposals_private.guard_project() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not proposals_private.is_operator() then raise exception 'Operator required'; end if;
 if tg_op='INSERT' then
  perform 1 from public.community_proposals where id=new.proposal_id and status='accepted' for update;
  if not found then raise exception 'Accept the proposal first'; end if;
 else
  if old.developer_id is not null or new.developer_id is null then raise exception 'Developer selection is final in this pilot'; end if;
  if new.developer_id=auth.uid() then raise exception 'An operator cannot select themselves'; end if;
  if new.deadline<=now() or not exists(select 1 from public.developer_applications where project_id=new.id and developer_id=new.developer_id) then raise exception 'Choose an applicant before the deadline'; end if;
  if not exists(select 1 from public.project_milestones where project_id=new.id) then raise exception 'Define milestones before hiring'; end if;
 end if;
 return new;
end $$;
create trigger proposal_projects_guard before insert or update on public.proposal_projects for each row execute function proposals_private.guard_project();
create function proposals_private.guard_application() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.proposal_projects where id=new.project_id and developer_id is null and deadline>now()) then raise exception 'Applications are closed'; end if;
 return new;
end $$;
create trigger developer_applications_guard before insert on public.developer_applications for each row execute function proposals_private.guard_application();

create function proposals_private.guard_milestone() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.proposal_projects; total bigint;
begin
 select * into p from public.proposal_projects where id=new.project_id;
 if tg_op='INSERT' then
  select * into p from public.proposal_projects where id=new.project_id for update;
  if p.id is null or p.developer_id is not null then raise exception 'Define scope before selecting a developer'; end if;
  select coalesce(sum(amount_cents),0) into total from public.project_milestones where project_id=p.id;
  if total+new.amount_cents>p.budget_cents then raise exception 'Milestones exceed project budget'; end if;
 else
  if p.developer_id=auth.uid() then
   if old.status not in ('pending','revision') or new.status<>'submitted' or new.pull_request_url is null then raise exception 'Submit a pull request for your assigned milestone'; end if;
   if row(new.review_note,new.quality_score) is distinct from row(old.review_note,old.quality_score) then raise exception 'Developer cannot rate their work'; end if;
  elsif proposals_private.is_operator() then
   if row(new.pull_request_url,new.delivery_notes) is distinct from row(old.pull_request_url,old.delivery_notes) then raise exception 'Operator cannot edit developer evidence'; end if;
   if old.status<>'submitted' or new.status not in ('revision','accepted') then raise exception 'Only submitted work can be reviewed'; end if;
   if length(trim(new.review_note))<20 then raise exception 'Provide meaningful review notes'; end if;
   if new.status='accepted' then
    if new.quality_score is null then raise exception 'Score accepted work from 1 to 5'; end if;
    new.accepted_at:=now();
   else new.quality_score:=null; end if;
  else raise exception 'Not an assigned developer or operator'; end if;
 end if;
 return new;
end $$;
create trigger project_milestones_guard before insert or update on public.project_milestones for each row execute function proposals_private.guard_milestone();
revoke all on function proposals_private.guard_proposal(),proposals_private.guard_vote(),proposals_private.guard_project(),proposals_private.guard_application(),proposals_private.guard_milestone() from public;

create view public.developer_reputation with(security_invoker=true) as
 select p.developer_id, count(m.id)::integer as accepted_milestones,
 count(distinct p.id)::integer as contributing_projects,
 round(avg(m.quality_score)::numeric,2) as average_quality,
 sum(m.amount_cents)::bigint as approved_fees_cents
 from public.proposal_projects p join public.project_milestones m on m.project_id=p.id
 where p.developer_id is not null and m.status='accepted' group by p.developer_id;
revoke all on public.developer_reputation from anon,authenticated;
grant select on public.developer_reputation to authenticated;
create index community_proposal_author_created on public.community_proposals(author_id,created_at);
create index proposal_votes_voter on public.proposal_votes(voter_id);
create index developer_applications_developer on public.developer_applications(developer_id);
create index milestones_project on public.project_milestones(project_id);
commit;
