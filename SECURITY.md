# Security Policy

## Supported versions

Only the current `main` branch, which is what runs in production, receives security fixes.

## Reporting a vulnerability

Please do not post details of a security problem in a public issue. Instead, open an issue
titled "Security contact request" with no technical details, and the maintainer
(@nicholasnatividad818-oss) will reply with a private way to share the report, including
steps to reproduce and the affected URL or file.

You can expect an acknowledgement within 7 days. Confirmed issues are fixed on a branch,
reviewed through a pull request, and deployed once approved.

## Handling secrets

Keys and tokens are never committed. If one is exposed, it is rotated at the issuing
service (Supabase, Spotify, Stripe, and so on), not just removed from the code.
See `CONTRIBUTING.md`.
