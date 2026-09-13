import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { webcrypto } from 'node:crypto';
const { outputFiles } = await build({ entryPoints: ['src/services/spotify.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', define: { 'import.meta.env': '{}' } });
let counter = 0;
async function setup() {
  const storage = new Map();
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  globalThis.sessionStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  globalThis.window = { location: { origin: 'http://127.0.0.1:8000', search: '', href: 'http://127.0.0.1:8000/', assign: value => { window.assigned = value; } }, history: { replaceState: (_a, _b, url) => { window.cleaned = url; window.location.search = ''; } } };
  const client = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text + `\n//${counter++}`).toString('base64')}`);
  return { client, storage };
}
function session(storage, overrides = {}) {
  storage.set('sistrum.spotify.session.v1', JSON.stringify({ access_token: 'old-token', refresh_token: 'refresh-token', expires_at: Date.now() + 3600000, ...overrides }));
}
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
test('PKCE matches S256 challenge and requests no extra scopes or secret', async () => {
  const { client, storage } = await setup(); await client.connectSpotify();
  const url = new URL(window.assigned); const pending = JSON.parse(storage.get('sistrum.spotify.pending.v1'));
  assert.equal(url.origin, 'https://accounts.spotify.com');
  assert.equal(url.searchParams.get('redirect_uri'), 'http://127.0.0.1:8000');
  assert.equal(url.searchParams.get('state'), pending.state);
  assert.equal(url.searchParams.get('code_challenge'), Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(pending.verifier))).toString('base64url'));
  assert.equal(url.searchParams.has('scope'), false); assert.equal(url.searchParams.has('client_secret'), false);
});
test('rejects bad OAuth state before sending code and removes callback data', async () => {
  const { client } = await setup(); await client.connectSpotify();
  window.location.search = '?code=private-code&state=wrong'; window.location.href += window.location.search;
  globalThis.fetch = () => { throw new Error('must not fetch'); };
  await assert.rejects(client.finishSpotifyConnection(), /could not be verified/); assert.equal(window.cleaned, '/');
});
test('deduplicates callback exchange and stores session only after successful exchange', async () => {
  const { client, storage } = await setup(); await client.connectSpotify();
  const pending = JSON.parse(storage.get('sistrum.spotify.pending.v1'));
  window.location.search = `?code=private-code&state=${pending.state}`; window.location.href += window.location.search;
  let calls = 0;
  globalThis.fetch = async (url, options) => { calls++; assert.equal(options.body.get('code_verifier'), pending.verifier); assert.equal(options.body.get('client_secret'), null); return json({ access_token: 'token', refresh_token: 'refresh', expires_in: 3600 }); };
  assert.deepEqual(await Promise.all([client.finishSpotifyConnection(), client.finishSpotifyConnection()]), [true, true]);
  assert.equal(calls, 1); assert.equal(client.isSpotifyConnected(), true);
});
test('concurrent expired requests share refresh and preserve omitted refresh token', async () => {
  const { client, storage } = await setup(); session(storage, { expires_at: 1 }); let refreshes = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('/api/token')) { refreshes++; return json({ access_token: 'new-token', expires_in: 3600 }); }
    assert.equal(options.headers.Authorization, 'Bearer new-token'); return json({ id: 'user', account_id: 'stable-account' });
  };
  await Promise.all([client.getSpotifyProfile(), client.getSpotifyProfile()]); assert.equal(refreshes, 1);
  assert.equal(JSON.parse(storage.get('sistrum.spotify.session.v1')).refresh_token, 'refresh-token');
});
test('uses current search limit and artist albums endpoint', async () => {
  const { client, storage } = await setup(); session(storage); const urls = [];
  globalThis.fetch = async url => { urls.push(new URL(url)); return json({ items: [], next: null }); };
  await client.searchSpotifyTracks('NRN'); await client.getNRNReleases();
  assert.equal(urls[0].searchParams.get('limit'), '10'); assert.equal(urls[1].pathname, '/v1/artists/6R3hYzwo70wQn0YINK7oFu/albums');
});
test('rejects hostile pagination URLs before token can be disclosed', async () => {
  const { client, storage } = await setup(); session(storage);
  globalThis.fetch = () => { throw new Error('must not fetch'); };
  await assert.rejects(client.getNRNReleases('https://evil.example/steal'), /Invalid Spotify API URL/);
});
test('quota errors respect Retry-After and do not retry in a loop', async () => {
  const { client, storage } = await setup(); session(storage); let calls = 0;
  globalThis.fetch = async () => { calls++; return json({ error: { reason: 'QUOTA_EXCEEDED' } }, 429, { 'Retry-After': '120' }); };
  await assert.rejects(client.getSpotifyProfile(), /quota is exhausted/);
  await assert.rejects(client.getSpotifyProfile(), /rate limiting/); assert.equal(calls, 1);
});
test('persistent 401 retries once then disconnects', async () => {
  const { client, storage } = await setup(); session(storage); let calls = 0;
  globalThis.fetch = async url => { calls++; return String(url).includes('/api/token') ? json({ access_token: 'new', expires_in: 3600 }) : json({}, 401); };
  await assert.rejects(client.getSpotifyProfile(), /session expired/); assert.equal(calls, 3); assert.equal(client.isSpotifyConnected(), false);
});
test('disconnect during refresh cannot restore tokens', async () => {
  const { client, storage } = await setup(); session(storage, { expires_at: 1 }); let resolve;
  globalThis.fetch = () => new Promise(done => { resolve = done; });
  const pending = client.getSpotifyProfile(); client.disconnectSpotify(); resolve(json({ access_token: 'new', expires_in: 3600 }));
  await assert.rejects(pending, /disconnected/); assert.equal(client.isSpotifyConnected(), false);
});
test('403 gives actionable developer-mode guidance', async () => {
  const { client, storage } = await setup(); session(storage); globalThis.fetch = async () => json({}, 403);
  await assert.rejects(client.getSpotifyProfile(), /Premium.*User Management/);
});
