# Spotify connection

The Spotify button opens a real Web API integration in Sistrum. It supports Authorization Code with PKCE, the current user's basic account profile, track search, NRN artist release browsing with pagination, and links to Spotify. Requests are read-only and ask for no additional private-data or write scopes.

## Existing NRN developer app

- Public Client ID: `ab765959ac7748f992e5394dc6626ef4` (not a secret).
- NRN artist: `6R3hYzwo70wQn0YINK7oFu`.
- Registered redirect observed September 12, 2026: `http://127.0.0.1:8000`.
- Development mode. The app owner must have Premium; test users must be allowed in User Management.

## Local connection

1. Run `npm ci` and `npm run dev:spotify`.
2. Open `http://127.0.0.1:8000` (not localhost; port 8000 is intentional).
3. Select **Spotify → Connect Spotify**, then authorize on Spotify.
4. Confirm the connected account, search a track, and load NRN releases.

## Production activation

1. Deploy this branch to the existing Sistrum hosting project.
2. Add the exact production HTTPS origin to the NRN app's Redirect URIs in Spotify Dashboard. Keep existing URIs intact.
3. By default the app uses `window.location.origin` as the redirect string. Register that exact string, including the absence of a trailing slash. It returns to the root so no new SPA rewrite is required.
4. Optional build settings: `VITE_SPOTIFY_CLIENT_ID` overrides the public NRN ID; `VITE_SPOTIFY_REDIRECT_URI` overrides the callback and must use the current site origin. If a path is used, hosting must serve the SPA there.
5. Rebuild after environment changes. Authorize from the deployed app and verify `/me`, search, and artist albums return successfully.

Never add a Spotify client secret to frontend settings. Tokens and the verifier remain in tab-scoped sessionStorage; they are not written to Sistrum's existing track storage, exported, or logged. Disconnect clears local tokens; revoke server authorization in Spotify's account Apps settings if needed. Same-origin scripts can access sessionStorage, so retain normal XSS protections. No background sync or server-side account association is implemented. `account_id` is available in the profile model for a future durable account link.

## API compatibility and scope

- Search limit is 10; NRN releases use artist albums, not the removed artist top-tracks or multi-get endpoints.
- Optional ISRC fields are displayed only when returned. Removed popularity and follower counts are not assumed.
- Refreshes are deduplicated; expired API authorization retries once. Invalid OAuth state is rejected. Pagination is restricted to Spotify's API origin. Rate-limit responses respect Retry-After; QUOTA_EXCEEDED is surfaced without retry loops.
- This Web API connection does not provide Spotify for Artists stream counts, royalties, profile editing, audio analysis, or audio downloads. Spotify content stays linked to Spotify and is not inserted into Sistrum's upload/licensing catalog or audio engine.
- Verification: `npm run test:spotify`, `npm run lint`, `npm run build`. Real account authorization must also be verified in a browser after deployment.

Official references:
- https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
- https://developer.spotify.com/documentation/web-api/references/changes/february-2026
- https://developer.spotify.com/documentation/web-api/references/changes/may-2026
- https://developer.spotify.com/documentation/web-api/references/changes/july-2026
- https://developer.spotify.com/documentation/web-api/concepts/quota-modes
