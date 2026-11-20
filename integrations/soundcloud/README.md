# Sistrum ↔ SoundCloud (review implementation)

Status: **feature branch only**. This does not deploy or configure production SoundCloud access.

## Verified API contract

The official SoundCloud OpenAPI JSON at
https://developers.soundcloud.com/docs/api/explorer/api.json
documents `GET /me` and `GET /me/tracks`, including `linked_partitioning`.
The guide at https://developers.soundcloud.com/docs/api/guide documents
OAuth 2.1, PKCE S256, the `https://secure.soundcloud.com/authorize`
and `/oauth/token` flows, and the `Authorization: OAuth` API header.

## Account registration (do not paste credentials into GitHub)

Use the official credentials CLI before attempting manual registration:

```bash
curl -fsSL https://raw.githubusercontent.com/soundcloud/api/master/scripts/sc-api-auth.mjs | node --input-type=module - --remote --name "Sistrum SoundCloud Integration" --description "Artist-authorized music catalog metadata synchronization" --website "https://instinctinkidentity.com"
```

Register **the exact HTTPS callback URL** for the trusted API service, not a Vite SPA callback.

## Deployment architecture

- Existing Sistrum Dockerfile serves **static Vite assets from Nginx**; it does not execute Node/Express server handlers.
- Separately deploy `node integrations/soundcloud/server.mjs` as a trusted server (Node 22+, `npm ci`).
- Configure your public HTTPS reverse proxy so `/api/soundcloud/*` goes to that backend **without rewriting the path**. Restrict direct backend access where feasible.
- Avoid serving this from an Nginx fallback that returns index.html for API paths.
- Set `VITE_SOUNDCLOUD_INTEGRATION_ENABLED=true` only after the backend, proxy, and database are working. This is a nonsecret frontend feature flag.
- Run `supabase/soundcloud_integration.review.sql` through the standard reviewed schema workflow on the correct Supabase project. This SQL is **not applied** by opening the PR.
- Require a signed-in Sistrum (Supabase) user for authorization and sync; `POST /authorize` returns a SoundCloud authorization URL and `GET /callback` uses one-time PKCE verifier/state.
- Tokens are stored AES-256-GCM encrypted in Supabase. The service-role key, client secret, and encryption key MUST only exist on the trusted server.

## Backend environment (server-only)

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SERVER_SECRET
SOUNDCLOUD_CLIENT_ID=FROM_OFFICIAL_CLI
SOUNDCLOUD_CLIENT_SECRET=SERVER_SECRET
SOUNDCLOUD_REDIRECT_URI=https://YOUR_API_HOST/api/soundcloud/callback
SOUNDCLOUD_TOKEN_ENCRYPTION_KEY=BASE64_OF_32_RANDOM_BYTES
SISTRUM_APP_ORIGIN=https://YOUR_SISTRUM_ORIGIN
PORT=8081
```

Generate encryption key via `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
Keep it in the secrets manager. Losing the key prevents decrypting existing OAuth tokens; rotation requires a planned migration. Never prefix sensitive settings with `VITE_`.

## Routes

| Route | Auth | Behavior |
| --- | --- | --- |
| `POST /api/soundcloud/authorize` | Supabase Bearer JWT | PKCE + one-time state, returns authorization_url |
| `GET /api/soundcloud/callback` | OAuth state + code | Exchanges and encrypts tokens; redirects to Sistrum |
| `GET /api/soundcloud/status` | Supabase Bearer JWT | Returns connected bool, not tokens |
| `POST /api/soundcloud/sync` | Supabase Bearer JWT | Paginates own uploads and upserts metadata scoped by user_id |

The integration does **not** copy, stream, or rehost track audio. It does not automatically publish SoundCloud tracks as Sistrum-uploaded tracks, because those are independent copyright and playback surfaces. Catalog metadata is separate from Sistrum's native `tracks` table; after ownership and rights checks, a reviewed matching process can explicitly link records.

## Verification / production gates

Run `npm ci && npm run check` and check `tests/soundcloud.test.mjs`.
Verify a real PKCE callback and multiple pagination pages against an authorized SoundCloud account in staging, then audit token refresh after expiry and 429 recovery.
Do not run multiple sync workers for the same user simultaneously; single-use refresh token rotation uses an in-process lock and **needs a distributed refresh lock for multi-replica production**.
Add an explicit disconnect/revoke flow, stale-track reconciliation, sync quotas, observability, and per-user sync locking before general availability.
Confirm SoundCloud API Terms of Use, display attribution and branding requirements.
