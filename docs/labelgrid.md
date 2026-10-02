# LabelGrid integration

The Distribute tab uses Supabase Edge Functions; it does not require a Next.js server. This initial integration is for one label account and explicitly allowlisted operators. Ordinary Sistrum users cannot access that account's catalog, royalties, or token.

## Activation

1. Use an API-enabled LabelGrid account, ideally sandbox first (sandbox IP allowlisting is required). Generate a token in LabelGrid account settings.
2. Run `supabase/004_labelgrid.sql` in the target Supabase project's SQL editor. It creates two service-role-only tables with RLS enabled and no browser access.
3. Configure Edge Function secrets: `LABELGRID_API_TOKEN`, `LABELGRID_API_BASE`, and `LABELGRID_OPERATOR_IDS` (comma-separated verified operator Supabase user UUIDs). Never put a token in a VITE variable. The permitted bases are `https://api.labelgrid.com/api/public` and `https://api-sandbox.stg.labelgrid.com/api/public`.
4. Deploy `labelgrid` with JWT gateway verification disabled if using publishable keys; the handler validates the bearer token through Auth `getUser` and independently checks operator authorization. Deploy `labelgrid-webhook` with JWT verification disabled because LabelGrid cannot send a Supabase JWT. It authenticates with HMAC instead. For CLI deployment use `supabase functions deploy labelgrid --no-verify-jwt` and `supabase functions deploy labelgrid-webhook --no-verify-jwt` after checking installed CLI help.
5. Register an HTTPS webhook at `https://<your-project-ref>.supabase.co/functions/v1/labelgrid-webhook`. Select delivery/review/transcode events using the current `GET /webhooks/event-types` response. Store its generated secret as `LABELGRID_WEBHOOK_SECRET` before sending a test. Registering through LabelGrid account settings avoids displaying the secret in the app.
6. Sign in as an allowed operator. Confirm catalog reads, create a sandbox release/track, upload a master, check processing status, validate, and submit a sandbox release. Verify a signed test event is stored in `labelgrid_events`. Production activation and these live checks have not been performed by this patch.

## Workspace

The release queue loads the API's first page. The operation editor provides the documented API's query parameters for additional pages, reference data, artists/writers/publishers, metadata creation/update, file registration, review issues/notes, delivery statuses, analytics and accounting JSON endpoints. Use the official schema for payloads; required credits, ownership, licensing and AI disclosures must come from the artist. The code does not invent those values or claim that missing files are ready.

The master uploader requests a presigned URL, PUTs the file without the LabelGrid bearer token, then registers the S3 key. Acceptance is not successful transcoding. Check the returned upload attempt via the operation editor. Artwork and licenses can be registered through their documented JSON endpoints where supported; direct multipart photo/license uploads and binary accounting exports are not implemented in this initial adapter.

Each Submit requires a visible confirmation and a fresh server validation result of `OK`. The database records a unique attempt per release to prevent simultaneous/double submissions. No mutation automatically retries, including 429s and timeouts. After a failed or uncertain submission, reconcile in LabelGrid. A trusted administrator may remove the row in `labelgrid_submissions` only after confirming it is safe to retry. This deliberately also prevents blind resubmission of previously submitted releases.

Webhook verification uses HMAC-SHA256 over raw bytes and the signed JSON body's timestamp with a five-minute window. Header timestamps and webhook IDs are not trusted. Exact duplicate bodies are deduplicated by hash; retries with fresh timestamps may produce separate inbox rows. Events are immutable notifications, not authoritative release state, so late/reordered deliveries cannot overwrite current statuses. Refresh delivery status from LabelGrid; automatic reconciliation workers, Supabase Realtime and catalog-to-LabelGrid ID mapping remain future work.

## Verification and limitations

`npm run check` verifies frontend types, existing tests, integration security tests and production compilation. The Edge Functions require deployment checks and a live sandbox test before production use; local unit tests do not prove remote credentials or account permissions. There is no automatic submission or real artist payout implementation.

Official contracts: https://api.labelgrid.com/docs/api and https://help.labelgrid.com/en/developers/webhooks/
