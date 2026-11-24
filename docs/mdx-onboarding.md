# Music Data Exchange (MDX) onboarding — NRN / SEYDANIC

Status: **staging/preflight only; NOT connected; no data transmitted** (2026-11-23).

## Verified provider workflow
- MDX is administered by SoundExchange and offers API-based DDEX Musical Work Notification (MWN) messages for label/publisher recording-composition information.
- MDX registration is free, restricted to recording or musical-work copyright owners. If operating as both label and publisher, obtain **separate label and publisher accounts**.
- Official onboarding: https://musicdataexchange.com/account
- MDX support: info@musicdataexchange.com
- The MDX FAQ confirms CWR publisher feeds, spreadsheet UI import, and DDEX MWN; implementation details and credentials require provider onboarding.
- **Do not assume** generic SoundExchange ISRC/repertoire API access grants access to MDX. These are different services.

## Registration form — information to collect privately
1. Entity: SEYDANIC (confirm registered legal entity and actual sound-recording/publishing ownership).
2. Account types: label and publisher (only where the entity administers each set of rights).
3. Primary contact name, working email, phone, physical business address, and entity website.
4. DDEX Party Identifier (DPID), or request MDX obtain a DPID on your behalf.
5. Existing MDX account status, signatory authority, support correspondence and implementation agreement.
Do not put contact details, API credentials, addresses, or contract documents into public GitHub.

## Ask MDX support for
- Label and publisher onboarding, permissions, DPID guidance and a non-production environment if provided.
- Official *current* endpoint/base URL, authentication method, credential provisioning, schemas and exact DDEX MWN version/profile, sample XML and transport choreography.
- Supported workflows: creating requests, receiving publisher claims, linking recordings to works, statuses/acknowledgments, corrections and duplicate handling.
- CWR feed format/version and submission procedure for publisher catalog; whether bulk upload is supported for this account.
- Rate/size limits, idempotency expectations, validation rules, error codes, retention, audit logging, and data-sharing/privacy terms.
- Whether released NRN recordings can be imported in bulk and how to handle preexisting MDX matches.

## Sistrum source data / gap mapping (NOT final MDX schema)
Existing Sistrum bridge: supabase/002_nrn_catalog_bridge.sql adds `catalog_track_id`, `catalog_source`, `isrc`, and `catalog_synced_at` on `public.tracks`.
Review input fields: `title`, `artist_name`, `isrc`, `catalog_track_id`, `recording_rights_owner`, `work_title`, `iswc`, `writer_name`, `publisher_name`, `publisher_share_percent`.
Several publishing fields are NOT confirmed to exist in the current database. Do not auto-infer or overwrite rights claims or assign splits.
Keep separate durable sound-recording identity (ISRC) from musical-work identity (ISWC or local work ID), and maintain a many-to-many linking model where needed.
CWR and MWN are separate workflows; ask MDX which is appropriate for the requested registration and claim types.

## Safe implementation sequence
1. Complete registration/authorization with MDX. Save secrets only in secret manager, never `VITE_*` or client bundles.
2. Export an owner-authorized, read-only catalog snapshot from NRN/Sistrum. Reconcile ISRC duplicates, owner, writers, compositions and shares. Restrict access.
3. Run `prepareMdxCatalog(records)` from `integrations/mdx/prepare.mjs` on the snapshot as preflight; resolve blocked records and manually review warnings. No API calls occur.
4. Following official specification receipt, implement a **server-only** serializer, authenticated adapter and acknowledgments with unique submission IDs, bounded retries, manual approval, audit trail and deduplication.
5. Validate one authorized example recording and its work identity in MDX test/sandbox if offered. Confirm round-trip status and claims before any bulk action.
6. Explicitly approve any production transmission separately. No deployment or bulk submission in this branch.

## Non-goals / release gates
- No audio transfer or DSP distribution.
- No claims that MDX writes to ASCAP, The MLC or SoundExchange Direct.
- No invented URLs, XML payloads, tokens, CWR requirements or transfer success statements.
- No production deployment, token storage, catalog transmission or ownership claims without validated rights and operator sign-off.

Official references:
- https://musicdataexchange.com/faq
- https://musicdataexchange.com/account
- https://www.soundexchange.com/news/soundexchange-unveils-upgraded-data-exchange-system-for-record-labels-and-music-publishers/
