# Cloud Run deployment readiness

This is the current GitHub React/Vite application, served by Nginx. Do not copy
the Express server or package.json from the older Sistrum-Grok-Handoff ZIP over it.
The container does not need an npm start script.

## Verify locally

```sh
npm ci
npm run check
docker build -t sistrum-check .
docker run --rm -p 8080:8080 sistrum-check
```

In another terminal check `/healthz` (JSON 200), `/catalog` (HTML 200),
`/assets/missing.js` (404), and `/api/profile` (JSON 404).
Docker/container execution must be verified in an environment with Docker.

## Configure the existing Cloud Build trigger

Use root `cloudbuild.yaml`. Set these substitutions to the existing deployment's
actual values, not a guessed region or repository:

| Substitution | Value |
| --- | --- |
| `_AR_HOSTNAME` | Artifact Registry hostname, such as REGION-docker.pkg.dev |
| `_AR_REPOSITORY` | Existing Docker repository name |
| `_SERVICE_NAME` | Existing Cloud Run service, reportedly `nrn`; verify |
| `_DEPLOY_REGION` | Existing Cloud Run service region |
| `_SPOTIFY_CLIENT_ID` | Optional public client ID; blank uses existing code default |
| `_SPOTIFY_REDIRECT_URI` | Optional registered callback; blank uses the site's origin |

The pipeline validates types/tests, builds, pushes a BUILD_ID-tagged image, then
deploys that same image. BUILD_ID also works for manual builds without COMMIT_SHA.
The deployment explicitly uses port 8080 and preserves existing service access
policy: it does not automatically grant public access.

Verify required APIs and the build service account's permissions to write the
Artifact Registry image, deploy Cloud Run, and act as its runtime service account.
Do not grant blanket project-owner access. See:
https://docs.cloud.google.com/build/docs/deploying-builds/deploy-cloud-run

Vite configuration is compiled into public assets. Cloud Run runtime environment
variables do not reconfigure an already built frontend. Never supply private API
keys or bearer tokens as VITE variables or Docker build arguments. Feed integrations
remain unconfigured in this container until their browser credential suitability
and production approval are verified; do not enable them by embedding private tokens.

## Remaining release checks

- Confirm the trigger's project, region, repository and service account settings.
- Run the container checks above and verify the resulting Cloud Run revision URL.
- Register that exact HTTPS callback with Spotify; test a real permitted account.
- Verify mobile navigation, player, reconnect and update/offline behavior in a browser.
- Review real-user functionality separately: current App.tsx still imports mock data
  and stores catalog/playlists/comments locally. Container readiness does not prove
  durable uploads, multi-user authentication, payments or production escrow.

Do not deploy an older ZIP over current main. Merge the reviewed deployment fix
branch through the repository's usual workflow, then inspect Cloud Build and Cloud
Run results. No live deployment is verified solely by a local Vite build.
