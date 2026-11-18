# Contributing to Sistrum

Sistrum is owned by Nicholas Reyes Natividad (@nicholasnatividad818-oss). These rules apply to
everyone who works in this repo, people and bots alike.

## Workflow

1. Start from the latest `main`: `git fetch && git checkout main && git pull`.
2. Create your own branch: `feat/<topic>`, `fix/<topic>`, or `chore/<topic>`.
3. Run the checks before you push: `npm ci && npm run check` (types, tests, production build).
4. Open a pull request into `main` and fill in the template.
5. Nothing is merged into `main` or deployed without Nicholas's approval.

Never push directly to `main`, force-push to a shared branch, or rewrite published history.

## Checks

Every pull request runs:

- **Sistrum release checks** (`.github/workflows/ci.yml`): `npm run check`, the release review,
  and a production container build with route probes.
- **test** (`.github/workflows/test.yml`): generator tests.
- **CircleCI** (`.circleci/config.yml`): `npm run check`.

A pull request should be green on all of them before it is reviewed.

## Secrets

- Never commit keys, tokens, passwords, or `.env` files. `.gitignore` blocks `.env*` except `.env.example`.
- Add new settings to `.env.example` with a placeholder value only.
- Server-only keys (for example the Supabase service role key) are read from the environment,
  never shipped to the browser.
- If a secret is ever committed, deleting it is not enough: rotate it at the service it came from.

## Deploys

Deploys are manual and happen only after Nicholas approves. See `docs/deployment.md`.
