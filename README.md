# Sistrum

Sistrum is a music workspace: discover and play public tracks, upload your own, and use the beat studio. Accounts, tracks, and audio files live in Supabase. The site is a Vite app, and `/api` routes run as Vercel functions for the assistant, Sistrum Pro checkout, and NRN Catalog search.

Listening and uploading need Supabase. Stripe, OpenAI, Gemini, and the NRN catalog are optional.

Playlists, comments, and follows are stored in the browser. Other people do not see those yet. Artist cards on Discover still include sample profiles from `src/data/mockData.ts`.

## Run it locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://127.0.0.1:3000. Fill `.env.local` with a real Supabase project before sign-up or upload will work. Do not commit `.env` or `.env.local`.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 3000. Also serves `/api` from the `api/` folder. |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | Typecheck with `tsc --noEmit` |

## Supabase

Create a project, then run these files in the SQL editor in order:

1. `supabase/001_sistrum_foundation.sql` — profiles, tracks, storage buckets, row-level security
2. `supabase/002_nrn_catalog_bridge.sql` — optional link from a Sistrum track to an NRN Catalog track
3. `supabase/003_usage_and_billing.sql` — free and Pro limits, play counts, AI quota

In Authentication → URL configuration:

- Add `http://127.0.0.1:3000` to Redirect URLs.
- After deploy, set Site URL to the public origin and add that origin to Redirect URLs too.

Leave email confirmation on. The confirmation link uses the Site URL, so a wrong Site URL sends people to localhost.

From the Supabase Connect panel, copy the project URL and the publishable key into `.env.local`:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SISTRUM_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SISTRUM_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

`SISTRUM_SUPABASE_SERVICE_ROLE_KEY` is server-only. It is required for the Stripe webhook, not for listening or uploading. Never prefix a secret with `VITE_`.

Free accounts can publish 3 tracks, 100 MB of audio in total, and 20 assistant calls a month. Each file is capped at 80 MB in the app. Supabase free projects reject uploads over 50 MB, so use a shorter file on that plan.

Public tracks are readable by anyone. Only the owner can change or delete a track. Audio and cover art upload into that user's folder in the `audio` and `cover-art` buckets. If a public audio URL returns 403, add a `select` policy on `storage.objects` for those two buckets.

## Deploy

The GitHub repo is `nicholasnatividad818-oss/Sistrum-Music-platform`. This multi-user app is on `feat/supabase-foundation`. `main` does not include it. Set the Vercel production branch to `feat/supabase-foundation`.

Vercel settings: Vite, build command `npm run build`, output directory `dist`. `vercel.json` sends every non-API path to `index.html`, so a refresh on a client route still loads the app.

Set these, then deploy. Changing a `VITE_` variable requires a new build.

| Name | Required to let other people listen and upload |
| --- | --- |
| `VITE_SUPABASE_URL` | yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | yes |
| `SISTRUM_SUPABASE_URL` | yes, same URL, used by `/api` |
| `SISTRUM_SUPABASE_PUBLISHABLE_KEY` | yes, same key, used by `/api` |
| `APP_URL` | yes, the public origin with no trailing slash |
| `SISTRUM_SUPABASE_SERVICE_ROLE_KEY` | Stripe webhook only |
| `OPENAI_API_KEY`, `GEMINI_API_KEY` | assistant only |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_WEBHOOK_SECRET` | Sistrum Pro only |
| `NRN_CATALOG_SUPABASE_URL`, `NRN_CATALOG_SUPABASE_SERVICE_ROLE_KEY`, `NRN_CATALOG_USER_ID` | catalog search only |

Names and comments for every variable are in `.env.example`.

Sistrum Pro is $15/month. Webhook path: `/api/billing/webhook`. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Use Stripe test mode until a checkout updates `entitlements` to `pro`.

## Check that someone else can use it

On the public URL:

1. Sign up with a real inbox. The confirmation link should open that site, signed in.
2. Upload a short MP3 and play it.
3. In a private window, signed out, play the same track.
4. Sign up as a second person and upload one track. Both accounts should see both public tracks.
5. Refresh. The session should still be there.
