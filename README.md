# Sistrum Music Platform

Sistrum is an artist-first music streaming and creation platform from NRN / SEYDANIC. The current release is a controlled private beta.

## Private-beta capabilities

- Public discovery and streaming
- Supabase email authentication
- Durable audio and cover-art storage
- Artist profiles and public tracks
- Persisted likes, reposts, follows, timed comments, and playlists
- Track reporting and authenticated account deletion
- NRN Catalog identity fields without exposing private rights or split data
- Row Level Security, least-privilege Data API grants, upload limits, and abuse quotas

## Local setup

Requirements: Node.js 22 and npm.

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Run `npm ci`.
4. Run `npm run dev`.

Never place a Supabase secret or service-role key in a `VITE_` environment variable.

## Verification

Run:

```bash
npm test
```

This performs the TypeScript check and production Vite build. GitHub Actions runs the same checks plus a production dependency audit.

Database changes are documented in `supabase/`. The two-user isolation test is in `supabase/tests/rls_private_beta.sql` and is designed to run inside a transaction that rolls back all test records.

## Beta limits

- Audio: 100 MB per file
- Artwork: 10 MB per file
- Tracks: 5 per 24 hours and 25 per account
- Comments: 30 per hour

Creators should keep their own original masters and artwork. Sistrum is not a backup service.
