// Server-only SoundCloud integration for Sistrum. Do not import from Vite/browser code.
// Mount with app.use('/api/soundcloud', createSoundCloudRouter()) on a trusted Express server.
import { Router } from 'express';
import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const API = 'https://api.soundcloud.com';
const AUTH = 'https://secure.soundcloud.com';
const locks = new Map();
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server-side environment variable ${name}`);
  return value;
}
function cipherKey() {
  const key = Buffer.from(required('SOUNDCLOUD_TOKEN_ENCRYPTION_KEY'), 'base64');
  if (key.length !== 32) throw new Error('SOUNDCLOUD_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  return key;
}
export function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', cipherKey(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [b64url(iv), b64url(cipher.getAuthTag()), b64url(data)].join('.');
}
export function decrypt(value) {
  const [iv, tag, data, extra] = String(value).split('.');
  if (!iv || !tag || !data || extra) throw new Error('Invalid encrypted token');
  const decipher = createDecipheriv('aes-256-gcm', cipherKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
const fail = (res, code, message) => res.status(code).json({ error: message });
function safeError(error) {
  // Never send access tokens, OAuth responses, secret configuration, or raw provider URLs to clients.
  return error?.publicMessage || 'SoundCloud operation failed; check server logs';
}
async function parseJson(response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const e = new Error(`SoundCloud upstream HTTP ${response.status}`);
    e.status = response.status;
    e.retryAfter = response.headers.get('retry-after');
    throw e;
  }
  return body;
}
export async function requestWithBackoff(url, options = {}, fetcher = fetch) {
  for (let attempt = 0; attempt <= 3; attempt++) {
    const response = await fetcher(url, options);
    if (response.status !== 429 && response.status < 500) return parseJson(response);
    if (attempt === 3) return parseJson(response);
    const delay = Math.min(8000, 500 * 2 ** attempt);
    const seconds = Number(response.headers.get('retry-after'));
    await sleep(Number.isFinite(seconds) && seconds >= 0 ? Math.min(30000, seconds * 1000) : delay);
  }
}
function authHeader(token) { return { Authorization: `OAuth ${token}`, Accept: 'application/json' }; }
async function tokenExchange(params, fetcher) {
  const response = await fetcher(`${AUTH}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ client_id: required('SOUNDCLOUD_CLIENT_ID'), client_secret: required('SOUNDCLOUD_CLIENT_SECRET'), ...params }),
  });
  return parseJson(response);
}
async function storeTokens(db, userId, payload, existingRefresh) {
  if (!payload.access_token || !(payload.refresh_token || existingRefresh)) throw new Error('Incomplete SoundCloud token response');
  const record = {
    user_id: userId,
    access_token_enc: encrypt(payload.access_token),
    refresh_token_enc: encrypt(payload.refresh_token || existingRefresh),
    expires_at: new Date(Date.now() + Math.max(60, Number(payload.expires_in || 3600)) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from('soundcloud_connections').upsert(record, { onConflict: 'user_id' });
  if (error) throw error;
  return payload.access_token;
}
async function accessToken(db, userId, fetcher, force = false) {
  const previous = locks.get(userId);
  if (previous) await previous;
  const task = (async () => {
    const { data: record, error } = await db.from('soundcloud_connections').select('*').eq('user_id', userId).single();
    if (error || !record) { const e = new Error('Not connected'); e.publicMessage = 'SoundCloud account not connected'; e.status = 409; throw e; }
    if (!force && new Date(record.expires_at).getTime() > Date.now() + 120_000) return decrypt(record.access_token_enc);
    const refresh = await tokenExchange({ grant_type: 'refresh_token', refresh_token: decrypt(record.refresh_token_enc) }, fetcher);
    return storeTokens(db, userId, refresh, decrypt(record.refresh_token_enc));
  })();
  locks.set(userId, task);
  try { return await task; } finally { if (locks.get(userId) === task) locks.delete(userId); }
}
async function authenticatedGet(db, userId, url, fetcher) {
  let token = await accessToken(db, userId, fetcher);
  try { return await requestWithBackoff(url, { headers: authHeader(token) }, fetcher); }
  catch (error) {
    if (error.status !== 401) throw error;
    token = await accessToken(db, userId, fetcher, true);
    return requestWithBackoff(url, { headers: authHeader(token) }, fetcher);
  }
}
export async function listOwnTracks(db, userId, fetcher = fetch) {
  const url = new URL('/me/tracks', API);
  url.searchParams.set('linked_partitioning', 'true');
  url.searchParams.set('limit', '100');
  const all = [], visited = new Set();
  let next = url.toString();
  while (next) {
    const current = new URL(next);
    if (current.origin !== API || current.pathname !== '/me/tracks') throw new Error('Unexpected SoundCloud pagination URL');
    if (visited.has(current.href) || visited.size >= 1000) throw new Error('SoundCloud pagination cycle or excessive pages');
    visited.add(current.href);
    const page = await authenticatedGet(db, userId, current.href, fetcher);
    if (!Array.isArray(page.collection)) throw new Error('Expected linked SoundCloud track collection');
    all.push(...page.collection);
    next = page.next_href || null;
  }
  return all;
}
export function createSoundCloudRouter({ db = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } }), fetcher = fetch } = {}) {
  const router = Router();
  const callbackUrl = required('SOUNDCLOUD_REDIRECT_URI');
  const frontend = new URL(required('SISTRUM_APP_ORIGIN'));
  if (frontend.pathname !== '/' || frontend.search || frontend.hash) throw new Error('SISTRUM_APP_ORIGIN must be an origin');
  if (new URL(callbackUrl).protocol !== 'https:' && !callbackUrl.startsWith('http://localhost:')) throw new Error('OAuth callback must use HTTPS');
  async function session(req, res, next) {
    const match = /^Bearer (.+)$/.exec(req.get('authorization') || '');
    if (!match) return fail(res, 401, 'Sistrum sign-in required');
    const { data, error } = await db.auth.getUser(match[1]);
    if (error || !data?.user) return fail(res, 401, 'Invalid Sistrum session');
    req.sistrumUserId = data.user.id;
    next();
  }
  router.post('/authorize', session, async (req, res) => {
    try {
      const state = b64url(randomBytes(32));
      const verifier = b64url(randomBytes(32));
      const challenge = b64url(createHash('sha256').update(verifier).digest());
      const { error } = await db.from('soundcloud_oauth_states').insert({
        state_hash: createHash('sha256').update(state).digest('hex'),
        user_id: req.sistrumUserId,
        verifier_enc: encrypt(verifier),
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
      if (error) throw error;
      const url = new URL('/authorize', AUTH);
      for (const [key, value] of Object.entries({ client_id: required('SOUNDCLOUD_CLIENT_ID'), redirect_uri: callbackUrl, response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256', state })) url.searchParams.set(key, value);
      res.set('Cache-Control', 'no-store').json({ authorization_url: url.toString() });
    } catch (e) { console.error('SoundCloud authorize:', e.message); fail(res, 500, safeError(e)); }
  });
  router.get('/callback', async (req, res) => {
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const hash = createHash('sha256').update(state).digest('hex');
    let outcome = 'error';
    try {
      if (!state || !code) throw new Error('Missing OAuth parameters');
      const { data: row, error } = await db.from('soundcloud_oauth_states').delete().eq('state_hash', hash).select('*').single();
      if (error || !row || new Date(row.expires_at).getTime() < Date.now()) throw new Error('Expired or invalid state');
      const tokens = await tokenExchange({ grant_type: 'authorization_code', code, redirect_uri: callbackUrl, code_verifier: decrypt(row.verifier_enc) }, fetcher);
      await storeTokens(db, row.user_id, tokens);
      outcome = 'connected';
    } catch (e) { console.error('SoundCloud callback:', e.message); }
    const destination = new URL(frontend.toString());
    destination.searchParams.set('soundcloud', outcome);
    return res.redirect(303, destination.toString());
  });
  router.get('/status', session, async (req, res) => {
    const { data, error } = await db.from('soundcloud_connections').select('expires_at,updated_at').eq('user_id', req.sistrumUserId).maybeSingle();
    if (error) return fail(res, 500, 'Unable to load connection status');
    res.set('Cache-Control', 'no-store').json({ connected: Boolean(data), updated_at: data?.updated_at || null });
  });
  router.post('/sync', session, async (req, res) => {
    try {
      const tracks = await listOwnTracks(db, req.sistrumUserId, fetcher);
      const now = new Date().toISOString();
      const records = tracks.map((t) => ({
        user_id: req.sistrumUserId,
        soundcloud_urn: String(t.urn || (t.id != null ? `soundcloud:tracks:${t.id}` : '')),
        title: String(t.title || ''),
        genre: t.genre || null,
        tags: t.tag_list || null,
        description: t.description || null,
        permalink_url: t.permalink_url || null,
        artwork_url: t.artwork_url || null,
        duration_ms: Number.isFinite(t.duration) ? t.duration : null,
        visibility: t.sharing || null,
        synced_at: now,
      })).filter((t) => t.soundcloud_urn && t.title);
      for (let i = 0; i < records.length; i += 100) {
        const { error } = await db.from('soundcloud_catalog_tracks').upsert(records.slice(i, i + 100), { onConflict: 'user_id,soundcloud_urn' });
        if (error) throw error;
      }
      res.json({ synced: records.length, at: now, note: 'Metadata only; audio is not copied or rehosted' });
    } catch (e) {
      console.error('SoundCloud sync:', e.message);
      fail(res, e.status === 409 ? 409 : e.status === 429 ? 429 : 502, safeError(e));
    }
  });
  return router;
}
