# Sistrum Signal pilot

Signal adds fixed-fee artist-funded promotional opportunities to the existing Sistrum app. Signed-in artists choose an owned track, immutable brief, USD budget, fee and application deadline. Promoters apply, artists select individual applicants, and selected promoters submit HTTPS evidence links. Artists request revisions or approve the agreed fee. Approvals are final and shown as money owed; there is no payment or escrow service connected.

## Installation

Apply `supabase/migrations/20261001043631_signal_marketplace.sql` to a staging Supabase project after the existing foundation migrations. Validate actual API grants, RLS and the artist/promoter journey in staging before applying to production. Build the frontend normally. Signal is available from navigation on desktop and mobile.

`npm run check` validates the frontend and the embedded PostgreSQL access-control workflow. Database tests create simplified auth/track fixtures; they do not replace testing against the real beta database or a concurrency stress test. Contract selection locks the campaign row before summing committed fees, so selection is serialized by campaign. Tests cover ownership, self-applications, unauthorized approval, hidden applications, budget exhaustion, proof/revision/approval transitions, immutable terms and anonymous denial.

Budgets are unenforced funding commitments, not deposits. Selected work reserves contractual capacity but no cash. This pilot deliberately does not offer withdraw, pay, funded, escrow or paid labels. There is no cancellation/dispute flow yet. Contracts are retained and restrict referenced account deletion; production must define account closure and financial retention before launch. Metrics and totals currently cover loaded batches (100 campaigns, 1,000 visible jobs).

## Platform-funded artist achievements

The separate artist achievements panel displays a proposed program, not active monetary offers. Example levels: 1,000 verified organic views unlock a badge; 10,000 organic views could receive $10; 1,000 retained subscribers $25; 10,000 retained subscribers $100. These figures are illustrative and must be set from real economics. Neither self-reported totals nor frontend calculations approve awards.

Suggested pilot pool: `min(monthly cap, 10% of realized contribution profit)`. Contribution profit must account for hosting/audio delivery, processors, support, refunds and the operating reserve. Subtract already-reserved awards before offering new funded slots. If there is no profit or sponsorship funding, begin with noncash rewards. Reserve awards at approval and publish queue/pool availability; do not advertise guaranteed cash for every artist at unlimited scale.

A production awards backend needs: administrator-set funded programs; a verified artist identity; provider-authorized metric snapshots with source and observation date; a definition of organic growth and exclusions; retained subscriber checks; unique artist/program/milestone awards; an append-only award ledger; atomic pool reservation; manual review for the pilot; audit records; and a payout reconciliation service. Existing gross view counts do not prove organic traffic. Do not merge follower counts across networks and label them unique subscribers.

Avoid per-stream cash rewards. Reward broader artist development with one-time milestone bonuses and retained fan/customer outcomes. Ban bought followers, bots, self-referrals and undisclosed paid placement. Use manual evidence review initially rather than costly continuous polling; automate provider reads only where authorized APIs supply reliable evidence.

## Payment launch requirements

Connect a supported marketplace payout provider, obtain its approval for both creator work and platform-funded bonuses, and configure server-only credentials and signed webhooks. Use an idempotent payout ledger with pending, submitted, paid and failed states. Mark paid only after provider confirmation; reconcile failures and reserves. Establish recipient onboarding, disputes, rights/disclosure terms, accounting and reporting. Never expose a service key or let browser updates mint awards or change paid status.

Batch payouts monthly with a published minimum (for example $50) and clear closure rules for smaller balances. Compare total provider costs, including active recipient fees, before choosing a provider. A $50 threshold reduces transaction overhead but does not remove earned liabilities. Platform campaign fees or sponsors can contribute to the reward pool only once funds settle; marketplace client budgets remain separately accounted for.
