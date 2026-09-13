# Make Sistrum global

Code for PWA, persistent Spotify session, legal pages, and package rename is in this branch.
You still have to finish these in vendor dashboards.

## 1. Domain
In Vercel → Sistrum project → Domains, add `real.music` or the Sistrum hostname you own.
Point DNS as Vercel shows. Then add that exact HTTPS origin (no trailing slash) to Spotify Redirect URIs.

## 2. Spotify production
Dashboard app `ab765959ac7748f992e5394dc6626ef4`:
- Keep `http://127.0.0.1:8000`
- Add `https://sistrum-music-platform.vercel.app`
- Add the custom domain origin when it is live
- Request Extended Quota so users outside User Management can connect
Owner needs Premium. Do not add a client secret to Vercel.

## 3. Feed.fm production
When Feed.fm approves production, set on the Vercel project and redeploy:
- `VITE_FEEDFM_TOKEN`
- `VITE_FEEDFM_SECRET`
- `VITE_FEED_CLIPS_TOKEN`

Do not commit the values.
