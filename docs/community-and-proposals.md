# Sistrum Proposals and Music Community

Two member pages extend the existing React/Supabase app:

- `/?page=proposals`: community ideas, one-account voting, operator review, developer opportunities/applications, fixed-price milestones, submission of GitHub pull requests, acceptance/revision and evidence-based quality reputation.
- `/?page=community`: discussion threads and music classifieds. Categories include music lessons, voice lessons, production, songwriting, collaboration, instruments/gear, gigs and services. Search includes post text and location. Classifieds expire after 30 days. Members reply, close or hide their own posts and hide their own replies. Reports are visible only to the reporter and operators. Operators can moderate threads/replies and review reports.

Both pages require signing in to read member records. User content is rendered as React text; no HTML or Markdown execution, attachments, direct messages or automatic external fetches are added.

## Staging setup

Apply `20261001044839_community_proposals.sql` then `20261001045845_music_community_forum.sql`, after the existing migrations. The forum deliberately reuses the trusted operator roster and helper from Proposals. Only a trusted database administrator may insert approved user IDs into `public.proposal_operators`. The client cannot add operators or modify account age. Do not designate accounts from user-editable metadata or an email address typed into a form.

The connected project named Sistrum-Music-platform is inactive. These migrations have not been applied to a production database. Embedded PostgreSQL fixtures test real grants, RLS, triggers and transitions; validate the migrations and API grants in the actual staging project before production release. Run Supabase database advisors in staging, then check both pages with a member, a fresh account, an applicant and an operator.

## Governance and hiring boundaries

Voting requires an email-confirmed account at least seven days old. Unique keys prevent repeat votes for the same proposal. These checks do not establish one-human-one-vote or prevent established account farms. Members can withdraw their votes. Votes are visible to signed-in members, as disclosed in the page. The operator lookup uses a protected roster; a narrow private SECURITY DEFINER function checks only the current user's trusted auth record for age/confirmation. It accepts no user ID argument, has an empty search path, and has explicit execution grants. All other application functions are SECURITY INVOKER.

Ideas are capped at three per account per day. Platform decisions need explanations. An accepted proposal may become a project with a budget commitment, scope and deadline. Milestone creation locks the project to enforce the total budget. Terms are immutable and must be defined before developer selection. Applications are private to the applicant and operators. Selecting oneself is prohibited; a selected developer cannot approve or rate their own work even if they are also an operator. Accepted milestone records are final in this pilot and feed an invoker-security reputation view. Reputation reports average quality, accepted milestone count and contributing-project count, not an opaque loyalty score or a claim of production access.

Project budgets are not deposits. Accepted milestones record fees owed, not paid funds. There is no payment processor or verified reserve check. Finalize funded payment terms before implementation. Production still needs payment reservation/reconciliation, cancellation/reassignment, disputes/appeals, private supporting documents, independent reviewer assignment, and a defined retention/account-closure policy. Financial rows restrict deletion of referenced accounts. A shipped proposal requires all defined milestones accepted; this records the operator's release decision and does not itself deploy code.

## Community boundaries

New topics/listings are capped at five per account per day; replies at twenty per hour. Advisory transaction locks serialize per-account inserts so concurrent submissions cannot bypass the caps. Classified expiry is assigned by the database rather than user input. Closed, hidden or expired threads reject new replies. Hidden records remain available to the author and operators but are filtered from other members by RLS. Users cannot restore hidden material or reopen threads. Operators may restore them, without changing listing expiry. Reports are unique per member/thread and are never shared with the reported author unless that person is an operator.

No instructor/seller checks, booking/payment processing, private contact delivery, scam detection, report notifications or moderator staffing are implemented. Member offers are explicitly described as unverified. Members are told not to publish private contact details. Production needs clear community rules, moderator coverage, appeals and abuse handling; rate limits alone cannot prevent determined abuse. Posts/replies are immutable except visibility/closure in this initial version; editing and renewal can be added with moderation history.

## Verification

`npm run check` runs TypeScript, unit tests, PostgreSQL access-control tests and a production build. Focused tests exercise duplicate and fresh-account vote rejection, operator-only hiring, milestone budget limits, developer self-approval denial, acceptance/reputation, impersonation denial, report privacy, moderation visibility, listing expiry assignment, closed-thread rejection and topic rate limits. An SSR smoke test verifies both member-page shells and forum navigation. These checks do not replace browser interaction tests or concurrency stress testing against staging.
