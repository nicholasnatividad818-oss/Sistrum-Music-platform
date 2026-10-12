import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { log } from './log.js';

const STATE_TTL = 10 * 60_000;

export class OAuthError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function createPkcePair() {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

const sha256 = value => createHash('sha256').update(value).digest('hex');

/** Starts the authorization-code + PKCE flow and returns the KICK consent URL. */
export function beginLogin(db, config, sessionHash, now = Date.now()) {
  if (!config.kickConfigured) throw new OAuthError(`KICK login is not configured. Missing: ${config.missingKickVars.join(', ')}.`, 503);
  const state = randomBytes(32).toString('base64url');
  const { verifier, challenge } = createPkcePair();
  db.prepare('INSERT INTO oauth_states (state_hash, session_hash, code_verifier, expires_at) VALUES (?, ?, ?, ?)')
    .run(sha256(state), sessionHash, verifier, now + STATE_TTL);
  const url = new URL(config.kick.authorizeUrl);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.kick.clientId,
    redirect_uri: config.kick.redirectUri,
    scope: config.kick.scope,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  return url.href;
}

/** Consumes a state exactly once. It must belong to this browser session and be unexpired. */
export function consumeState(db, state, sessionHash, now = Date.now()) {
  if (typeof state !== 'string' || !state || state.length > 200) throw new OAuthError('The login request is missing its security state. Please start again.');
  const row = db.prepare('DELETE FROM oauth_states WHERE state_hash = ? RETURNING *').get(sha256(state));
  if (!row || row.session_hash !== sessionHash) throw new OAuthError('This login link is invalid or was already used. Please start again.');
  if (row.expires_at <= now) throw new OAuthError('This login request expired. Please start again.');
  return row.code_verifier;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** Handles the OAuth callback and returns the internal user id. Access tokens are revoked and never stored. */
export async function completeLogin({ db, config, fetchImpl = fetch, query, sessionHash, now = Date.now() }) {
  if (!config.kickConfigured) throw new OAuthError('KICK login is not configured.', 503);
  if (query.error) {
    // Still consume the state so the link cannot be replayed.
    try { consumeState(db, query.state, sessionHash, now); } catch { /* already invalid */ }
    throw new OAuthError(query.error === 'access_denied' ? 'KICK login was cancelled. Demo mode is still available.' : 'KICK did not authorize the login. Please try again.');
  }
  const verifier = consumeState(db, query.state, sessionHash, now);
  if (typeof query.code !== 'string' || !query.code || query.code.length > 2000) throw new OAuthError('KICK did not return an authorization code. Please try again.');

  let tokenResponse;
  try {
    tokenResponse = await fetchImpl(config.kick.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.kick.clientId,
        client_secret: config.kick.clientSecret,
        redirect_uri: config.kick.redirectUri,
        code_verifier: verifier,
        code: query.code,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    log('error', 'KICK token exchange failed', { error });
    throw new OAuthError('Could not reach KICK to finish login. Please try again.', 502);
  }
  const token = await readJson(tokenResponse);
  if (!tokenResponse.ok || typeof token?.access_token !== 'string') {
    log('error', 'KICK token exchange rejected', { status: tokenResponse.status });
    throw new OAuthError('KICK rejected the login. Please try again.', 502);
  }

  let user;
  try {
    const userResponse = await fetchImpl(config.kick.userUrl, {
      headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await readJson(userResponse);
    user = userResponse.ok ? body?.data?.[0] : null;
  } catch (error) {
    log('error', 'KICK user lookup failed', { error });
  } finally {
    revokeToken(config, fetchImpl, token.access_token);
  }
  const providerUserId = user?.user_id ?? user?.id;
  if (providerUserId == null || !/^[\w-]{1,64}$/.test(String(providerUserId))) throw new OAuthError('KICK did not return your account details. Please try again.', 502);
  const name = String(user.name ?? user.username ?? `KICK user ${providerUserId}`).slice(0, 60);

  db.prepare(`INSERT INTO users (id, provider, provider_user_id, display_name, workspace_id, created_at) VALUES (?, 'kick', ?, ?, NULL, ?)
    ON CONFLICT (provider, provider_user_id) DO UPDATE SET display_name = excluded.display_name`)
    .run(randomUUID(), String(providerUserId), name, now);
  return db.prepare('SELECT id FROM users WHERE provider = \'kick\' AND provider_user_id = ?').get(String(providerUserId)).id;
}

/** Best-effort revocation; ViewerWorks only needs the token to read the user once. */
function revokeToken(config, fetchImpl, accessToken) {
  const url = new URL(config.kick.revokeUrl);
  url.search = new URLSearchParams({ token: accessToken, token_hint_type: 'access_token' }).toString();
  Promise.resolve()
    .then(() => fetchImpl(url.href, { method: 'POST', signal: AbortSignal.timeout(5_000) }))
    .catch(error => log('warn', 'KICK token revocation failed', { error }));
}
