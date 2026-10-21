import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { kickEnv, testConfig } from './helpers.mjs';
import { openDatabase } from '../src/db.js';
import { OAuthError, beginLogin, completeLogin, consumeState, createPkcePair } from '../src/oauth.js';

const NOW = Date.parse('2026-10-12T12:00:00Z');
const config = testConfig(kickEnv);

function mockKick({ token = { status: 200, body: { access_token: 'at-1', token_type: 'Bearer' } }, user = { status: 200, body: { data: [{ user_id: 4242, name: 'StreamerSam' }] } }, throwOn } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (throwOn && String(url).startsWith(throwOn)) throw new Error('network down');
    const reply = String(url).startsWith(config.kick.tokenUrl) ? token : String(url).startsWith(config.kick.userUrl) ? user : { status: 200, body: {} };
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } });
  };
  return { fetchImpl, calls };
}

function start(db, session = 'session-1', now = NOW) {
  return new URL(beginLogin(db, config, session, now)).searchParams;
}

test('PKCE uses S256 with a 43-128 character verifier', () => {
  const { verifier, challenge } = createPkcePair();
  assert.ok(verifier.length >= 43 && verifier.length <= 128);
  assert.match(verifier, /^[A-Za-z0-9_-]+$/);
  assert.equal(challenge, createHash('sha256').update(verifier).digest('base64url'));
});

test('login URL carries client, exact redirect, user:read scope, state and challenge', () => {
  const db = openDatabase();
  const params = start(db);
  assert.equal(params.get('response_type'), 'code');
  assert.equal(params.get('client_id'), 'client-123');
  assert.equal(params.get('redirect_uri'), 'http://127.0.0.1/auth/kick/callback');
  assert.equal(params.get('scope'), 'user:read');
  assert.equal(params.get('code_challenge_method'), 'S256');
  assert.ok(params.get('state').length >= 40);
  assert.ok(!params.has('client_secret'));
  // The stored verifier matches the challenge sent to KICK.
  const verifier = consumeState(db, params.get('state'), 'session-1', NOW);
  assert.equal(createHash('sha256').update(verifier).digest('base64url'), params.get('code_challenge'));
});

test('missing configuration produces an actionable error', () => {
  const bare = testConfig();
  assert.throws(() => beginLogin(openDatabase(), bare, 's', NOW), e => e instanceof OAuthError && e.status === 503 && /KICK_CLIENT_ID/.test(e.message));
});

test('successful callback exchanges the code with the verifier, reads the user, revokes and never stores the token', async () => {
  const db = openDatabase();
  const params = start(db);
  const { fetchImpl, calls } = mockKick();
  const userId = await completeLogin({ db, config, fetchImpl, query: { code: 'auth-code', state: params.get('state') }, sessionHash: 'session-1', now: NOW });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  assert.equal(user.provider_user_id, '4242');
  assert.equal(user.display_name, 'StreamerSam');

  const tokenCall = calls.find(c => c.url === config.kick.tokenUrl);
  const body = new URLSearchParams(tokenCall.init.body.toString());
  assert.equal(body.get('grant_type'), 'authorization_code');
  assert.equal(body.get('code'), 'auth-code');
  assert.equal(body.get('client_secret'), 'super-secret-value');
  assert.ok(body.get('code_verifier').length >= 43);
  assert.equal(calls.find(c => c.url === config.kick.userUrl).init.headers.Authorization, 'Bearer at-1');
  await new Promise(r => setTimeout(r, 10));
  assert.ok(calls.some(c => c.url.startsWith(config.kick.revokeUrl)), 'token revoked');

  const dump = JSON.stringify(db.prepare('SELECT * FROM sessions').all()) + JSON.stringify(db.prepare('SELECT * FROM users').all());
  assert.ok(!dump.includes('at-1'));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM oauth_states').get().n, 0);
});

test('state is single-use, bound to the session, and expires', async () => {
  const db = openDatabase();
  const { fetchImpl } = mockKick();
  const state = start(db).get('state');
  await completeLogin({ db, config, fetchImpl, query: { code: 'c', state }, sessionHash: 'session-1', now: NOW });
  await assert.rejects(completeLogin({ db, config, fetchImpl, query: { code: 'c', state }, sessionHash: 'session-1', now: NOW }), /already used/);

  const foreign = start(db, 'session-1').get('state');
  await assert.rejects(completeLogin({ db, config, fetchImpl, query: { code: 'c', state: foreign }, sessionHash: 'attacker', now: NOW }), /invalid/);

  const old = start(db, 'session-1').get('state');
  await assert.rejects(completeLogin({ db, config, fetchImpl, query: { code: 'c', state: old }, sessionHash: 'session-1', now: NOW + 11 * 60_000 }), /expired/);
  await assert.rejects(completeLogin({ db, config, fetchImpl, query: { code: 'c' }, sessionHash: 'session-1', now: NOW }), /missing its security state/);
});

test('cancelled consent is reported and consumes the state', async () => {
  const db = openDatabase();
  const { fetchImpl, calls } = mockKick();
  const state = start(db).get('state');
  await assert.rejects(completeLogin({ db, config, fetchImpl, query: { error: 'access_denied', state }, sessionHash: 'session-1', now: NOW }), /cancelled/);
  assert.equal(calls.length, 0);
  await assert.rejects(completeLogin({ db, config, fetchImpl, query: { code: 'c', state }, sessionHash: 'session-1', now: NOW }), /already used/);
});

test('token and user lookup failures are handled without creating users', async () => {
  const db = openDatabase();
  const cases = [
    [mockKick({ token: { status: 400, body: { error: 'invalid_grant' } } }), /rejected the login/],
    [mockKick({ token: { status: 200, body: { nope: true } } }), /rejected the login/],
    [mockKick({ throwOn: config.kick.tokenUrl }), /Could not reach KICK/],
    [mockKick({ user: { status: 401, body: {} } }), /account details/],
    [mockKick({ user: { status: 200, body: { data: [] } } }), /account details/],
    [mockKick({ throwOn: config.kick.userUrl }), /account details/],
  ];
  for (const [{ fetchImpl }, expected] of cases) {
    const state = start(db).get('state');
    await assert.rejects(completeLogin({ db, config, fetchImpl, query: { code: 'c', state }, sessionHash: 'session-1', now: NOW }), e => e instanceof OAuthError && expected.test(e.message));
  }
  await assert.rejects(completeLogin({ db, config, fetchImpl: mockKick().fetchImpl, query: { state: start(db).get('state') }, sessionHash: 'session-1', now: NOW }), /authorization code/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users WHERE provider = \'kick\'').get().n, 0);
});
