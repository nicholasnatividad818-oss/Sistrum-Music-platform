# ViewerWorks (KICK server)

A standalone server where viewers do useful creative work for streamers (moment scouting, clip links, captions), creators review it, and approved work lands in an auditable earnings ledger. It implements `2026-10-12-viewerworks-design`.

**It never moves money.** There are no deposits and no payouts. Every balance is a ledger record, and in demo mode a labelled simulation. ViewerWorks is independent and not affiliated with or endorsed by KICK. Running a funded marketplace on the KICK API would need KICK's separate commercial agreement, and that has not been granted.

## Run it

Requires Node 22.5 or later. There are no npm dependencies; it uses the built-in `node:http` and `node:sqlite`.

```bash
cd kick-server
npm start          # http://localhost:8787 (demo mode works with no configuration)
npm test           # 23 tests: domain rules, concurrency, OAuth, HTTP flows
```

Docker: `docker build -t viewerworks . && docker run -p 8080:8080 -v vw-data:/data viewerworks`

## Configuration

Set these in your host's secret settings, never in git or chat:

| Variable | Purpose |
| --- | --- |
| `BASE_URL` | Public origin, e.g. `https://viewerworks.example.com`. Used for the same-origin check, cookie `Secure` flag and default redirect URI. |
| `KICK_CLIENT_ID` / `KICK_CLIENT_SECRET` | From your KICK developer app (scope `user:read`). |
| `KICK_REDIRECT_URI` | Optional; defaults to `${BASE_URL}/auth/kick/callback`. Must match the KICK app exactly. |
| `SESSION_SECRET` | Random 32+ characters (`openssl rand -hex 32`). Keys session-id hashing. |
| `DATABASE_PATH` | SQLite file (default `viewerworks.db`; `/data/viewerworks.db` in Docker). |
| `PORT` | Default 8787 (8080 in Docker). |

If the KICK variables are missing, the server still runs. Demo mode works, and Settings lists the variable names that are missing (never their values).

The KICK endpoints default to `id.kick.com/oauth/{authorize,token,revoke}` and `api.kick.com/public/v1/users`. They can be overridden with `KICK_AUTHORIZE_URL`, `KICK_TOKEN_URL`, `KICK_REVOKE_URL` and `KICK_USER_URL`. Check them against KICK's current docs before going live. docs.kick.com was unreachable from the build environment, so they were written from the known public contract.

## How it works

- **Identity.** KICK login uses the OAuth authorization-code flow with PKCE (S256). The state is single-use, bound to the browser session and expires after 10 minutes. The access token is used once to read the user, then revoked; no tokens are stored. The session id rotates on login. Cookies are HttpOnly and SameSite=Lax (Secure over HTTPS), and only an HMAC of the session id is stored.
- **Demo mode.** Each visitor gets a private workspace with a viewer persona, a creator persona and a sample submission. Switching personas never reaches another workspace or live data, and reset clears only your own workspace.
- **Money rules.** All amounts are integer USD cents. One submission is allowed per viewer per task. Creators can't submit to their own tasks, and nobody can approve their own work.
- **Approval is one atomic step.** Inside a single `BEGIN IMMEDIATE` transaction it takes a slot (`UPDATE … WHERE slots_remaining > 0`), sets the submission to approved and writes exactly one ledger row (`UNIQUE(submission_id)`). Ledger rows cannot be updated. Repeating an approval returns the existing entry. A test runs ten approvals in parallel worker threads and checks the slot limit holds.
- **Security.** Every mutation checks the server-side actor. POSTs need the per-session CSRF token and a same-origin `Origin`/`Sec-Fetch-Site`. Output is escaped through a single tagged-template helper, and a strict CSP is sent. Source links must be http(s), clip links must be https, and the server never fetches user-supplied URLs. Requests are throttled to 40 mutations per minute per session, and logs redact secrets and tokens.

## Known limitations

- Live KICK login is only covered by mocked tests here. It counts as verified only after real credentials are configured and a real consent and callback succeed.
- Rate limiting is in memory, per process.
- There are no payouts, funded campaigns, event subscriptions or webhooks; these are out of scope for v1 per the spec.
