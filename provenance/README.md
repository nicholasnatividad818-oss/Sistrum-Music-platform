# Sistrum Track Provenance

A standalone Node 22 web app for checking Suno C2PA credentials. The service streams uploads to Suno, forwards public HTTPS links to Suno's URL detector, and returns a normalized verdict. The app has no database and does not persist the submitted media, URL, or verdict.

## Run

```sh
npm test
npm start
```

Open http://localhost:8080. The dependency-free app also builds with `docker build -t sistrum-provenance .` and runs with `docker run --rm -p 8080:8080 sistrum-provenance`.

## Attach to Sistrum

1. Deploy the container on an HTTPS host that supports streaming uploads and allows outbound HTTPS to studio-api.prod.suno.com. Set PORT to the listening port the host expects. Set ingress limits and timeouts to support uploads up to 99,000,000 bytes and checks up to 90 seconds.
2. Add a navigation link in Sistrum pointing to the checker origin. For example, replace the example hostname with the deployed hostname.

   ```html
   <a href="https://provenance.example.com/">Track provenance</a>
   ```

3. Smoke-test GET /healthz and the UI with an original credential-bearing Suno download and a public direct audio link before exposing the link to users. Verify upload support through the actual ingress, including near the size cap.

The default linkage is an independent page, with no Sistrum authentication or catalog changes. For a public launch, put per-client rate limits at the ingress. Built-in limits apply per process (burst six, one token every ten seconds, two concurrent checks). Keep request bodies and URLs out of ingress logs. The checker forwards links only to Suno's fixed endpoint and delegates URL retrieval to Suno.

## Same-origin API

Send X-Provenance-Request: 1 on both routes. POST /api/check/file accepts the raw file body with Content-Length and X-Audio-Extension (mp3, wav, flac, m4a, aac, ogg, opus). POST /api/check/url accepts JSON with a public HTTPS url. Successful responses contain provider, verdict, and checkedAt. Failures contain error and a non-2xx status. The service intentionally exposes the three provider verdicts without guessing when a request fails.

Only verified_suno indicates verified Suno credentials. no_suno_provenance and inconclusive do not certify human authorship. Do not use these responses as automatic release or moderation gates.

Provider documentation https://suno.com/suno-credentials
