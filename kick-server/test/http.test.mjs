import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Browser, kickEnv, startServer } from './helpers.mjs';

let app;
const kickUsers = new Map();
async function fakeKick(url, init = {}) {
  const u = String(url);
  if (u.startsWith('https://id.kick.com/oauth/token')) {
    const code = new URLSearchParams(init.body.toString()).get('code');
    return Response.json({ access_token: `token-for-${code}` });
  }
  if (u.startsWith('https://api.kick.com/public/v1/users')) {
    const code = init.headers.Authorization.replace('Bearer token-for-', '');
    return Response.json({ data: [kickUsers.get(code)] });
  }
  return new Response('{}');
}

before(async () => { app = await startServer({ env: kickEnv, fetchImpl: fakeKick }); });
after(() => app.close());

async function demoVisitor() {
  const b = new Browser(app.base);
  await b.get('/');
  const start = await b.post('/demo/start');
  assert.equal(start.status, 303);
  return b;
}

async function kickLogin(b, code, user) {
  kickUsers.set(code, user);
  const login = await b.get('/auth/kick/login');
  assert.equal(login.status, 303);
  const state = new URL(login.location).searchParams.get('state');
  const before = b.cookies.get('vw_session');
  const callback = await b.get(`/auth/kick/callback?code=${code}&state=${encodeURIComponent(state)}`);
  assert.equal(callback.status, 303, callback.text);
  assert.notEqual(b.cookies.get('vw_session'), before, 'session id rotates on login');
  await b.get('/settings'); // picks up the rotated session's CSRF token
  return state;
}

test('security headers and health', async () => {
  const res = await new Browser(app.base).get('/');
  assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.match(res.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
  assert.equal((await fetch(`${app.base}/healthz`)).status, 200);
});

test('CSRF: missing token, wrong token and foreign origin are refused', async () => {
  const b = new Browser(app.base);
  await b.get('/');
  assert.equal((await b.post('/demo/start', {}, { csrf: false })).status, 403);
  assert.equal((await b.post('/demo/start', { _csrf: 'forged' }, { csrf: false })).status, 403);
  assert.equal((await b.post('/demo/start', {}, { headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await b.post('/demo/start', {}, { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
  // A token from another browser session does not work either.
  const other = new Browser(app.base);
  await other.get('/');
  assert.equal((await b.post('/demo/start', { _csrf: other.csrf }, { csrf: false })).status, 403);
});

test('demo: viewer submits, creator approves, earnings persist across reloads', async () => {
  const b = await demoVisitor();
  const board = await b.get('/tasks');
  assert.match(board.text, /Demo workspace: every task, balance and approval here is simulated/);
  assert.match(board.text, /demo credit/);
  const taskIds = [...board.text.matchAll(/href="\/tasks\/([\w-]+)"/g)].map(m => m[1]);
  assert.equal(taskIds.length, 4);

  // As the viewer persona, submit a caption to a creator-persona task.
  let captionTask;
  for (const id of taskIds) {
    const page = await b.get(`/tasks/${id}`);
    if (/name="caption"/.test(page.text)) { captionTask = id; break; }
  }
  assert.ok(captionTask);
  const missingRights = await b.post(`/tasks/${captionTask}/submit`, { caption: 'Hello' });
  assert.equal(missingRights.status, 400);
  const submitted = await b.post(`/tasks/${captionTask}/submit`, { caption: 'Studio glow-up <b>live</b>', rights: 'yes' });
  assert.equal(submitted.status, 303);
  const mine = await b.get('/submissions');
  assert.match(mine.text, /Submitted · awaiting review/);
  assert.match(mine.text, /Studio glow-up &lt;b&gt;live&lt;\/b&gt;/, 'user text is escaped');
  assert.equal((await b.post(`/tasks/${captionTask}/submit`, { caption: 'again', rights: 'yes' })).status, 409);

  // Switch to the creator persona and approve the viewer's submission twice (idempotent).
  await b.post('/demo/persona', { persona: 'creator' });
  const review = await b.get(`/creator/tasks/${captionTask}`);
  assert.equal(review.status, 200);
  const subId = review.text.match(/\/creator\/submissions\/([\w-]+)\/approve/)[1];
  assert.ok((await b.post(`/creator/submissions/${subId}/approve`, { reason: 'Love it' })).location.endsWith('msg=approved'));
  assert.ok((await b.post(`/creator/submissions/${subId}/approve`, { reason: 'Love it' })).location.endsWith('msg=approved_again'));
  // The creator persona cannot submit to its own task.
  assert.equal((await b.post(`/tasks/${captionTask}/submit`, { caption: 'me', rights: 'yes' })).status, 403);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM ledger WHERE submission_id = ?').get(subId).n, 1);

  await b.post('/demo/persona', { persona: 'viewer' });
  const earnings = await b.get('/earnings');
  assert.match(earnings.text, /Approved demo credit<\/span><span class="value">\$1\.50/);
  assert.match(earnings.text, /Pending review \(potential\)<\/span><span class="value muted">\$0\.00/);
  assert.match((await b.get('/submissions')).text, /Creator note: Love it/);
  assert.match(earnings.text, /Withdraw unavailable/);
  assert.match(earnings.text, /No payout provider or real funding is connected/);
});

test('demo visitors cannot see or act on another visitor workspace', async () => {
  const a = await demoVisitor();
  const b = await demoVisitor();
  const aTask = (await a.get('/tasks')).text.match(/href="\/tasks\/([\w-]+)"/)[1];
  assert.equal((await b.get(`/tasks/${aTask}`)).status, 404);
  assert.equal((await b.post(`/tasks/${aTask}/submit`, { caption: 'x', rights: 'yes' })).status, 404);
  await a.post('/demo/persona', { persona: 'creator' });
  const aOwn = (await a.get('/creator')).text.match(/href="\/creator\/tasks\/([\w-]+)"/)[1];
  const aSub = (await a.get(`/creator/tasks/${aOwn}`)).text.match(/\/creator\/submissions\/([\w-]+)\/approve/)[1];
  await b.post('/demo/persona', { persona: 'creator' });
  assert.equal((await b.post(`/creator/submissions/${aSub}/approve`)).status, 404);
  assert.equal((await b.get(`/creator/tasks/${aOwn}`)).status, 404);
});

test('demo reset needs confirmation and restores seed data', async () => {
  const b = await demoVisitor();
  assert.equal((await b.post('/demo/reset')).status, 400);
  await b.post('/demo/persona', { persona: 'creator' });
  await b.post('/creator/tasks', { type: 'clip', title: 'Extra', brief: 'b', source_url: 'https://example.com', criteria: 'c', effort_minutes: '5', reward: '1', slots: '1', deadline: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10) });
  assert.equal([...(await b.get('/tasks')).text.matchAll(/href="\/tasks\/[\w-]+"/g)].length, 5);
  assert.equal((await b.post('/demo/reset', { confirm: 'yes' })).status, 303);
  assert.equal([...(await b.get('/tasks')).text.matchAll(/href="\/tasks\/[\w-]+"/g)].length, 4);
});

test('live: KICK login, task posting, cross-user review rules, escaping and logout', async () => {
  const sam = new Browser(app.base);
  await sam.get('/');
  const state = await kickLogin(sam, 'code-sam', { user_id: 1, name: 'Sam' });
  const tasks = await sam.get('/tasks');
  assert.match(tasks.text, /badge live/);
  assert.doesNotMatch(tasks.text, /Demo workspace/);

  // State replay after a successful login is refused.
  const replay = await sam.get(`/auth/kick/callback?code=code-sam&state=${encodeURIComponent(state)}`);
  assert.equal(replay.status, 400);

  const deadline = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  const bad = await sam.post('/creator/tasks', { type: 'clip', title: 'x', brief: 'b', source_url: 'javascript:alert(1)', criteria: 'c', effort_minutes: '5', reward: '1', slots: '1', deadline });
  assert.equal(bad.status, 400);
  assert.match(bad.text, /Source link must use HTTP or HTTPS/);
  const created = await sam.post('/creator/tasks', { type: 'caption', title: '<script>alert(1)</script>', brief: 'b', source_url: 'https://example.com/v', criteria: 'c', effort_minutes: '5', reward: '3', slots: '1', deadline });
  assert.equal(created.status, 303);
  const taskId = created.location.match(/\/creator\/tasks\/([\w-]+)/)[1];
  const board = await sam.get('/tasks');
  assert.ok(!board.text.includes('<script>alert(1)</script>'));
  assert.match(board.text, /&lt;script&gt;/);
  assert.equal((await sam.post(`/tasks/${taskId}/submit`, { caption: 'mine', rights: 'yes' })).status, 403);

  const lee = new Browser(app.base);
  await lee.get('/');
  await kickLogin(lee, 'code-lee', { user_id: 2, name: 'Lee' });
  assert.equal((await lee.post(`/tasks/${taskId}/submit`, { caption: 'Lee caption', rights: 'yes' })).status, 303);
  const subId = app.db.prepare('SELECT id FROM submissions WHERE task_id = ?').get(taskId).id;
  assert.equal((await lee.post(`/creator/submissions/${subId}/approve`)).status, 403, 'viewer cannot approve');
  assert.equal((await sam.post(`/creator/submissions/${subId}/approve`)).status, 303);
  assert.match((await lee.get('/earnings')).text, /Approved ledger total<\/span><span class="value">\$3\.00/);

  // Settings show variable names but never secret values.
  const settings = await sam.get('/settings');
  assert.match(settings.text, /KICK_CLIENT_SECRET/);
  assert.ok(!settings.text.includes(kickEnv.KICK_CLIENT_SECRET));
  assert.ok(!settings.text.includes(kickEnv.SESSION_SECRET));

  await sam.post('/logout');
  const out = await sam.get('/tasks');
  assert.equal(out.status, 303);
});

test('cancelled KICK consent leaves demo usable', async () => {
  const b = await demoVisitor();
  const login = await b.get('/auth/kick/login');
  const state = new URL(login.location).searchParams.get('state');
  const res = await b.get(`/auth/kick/callback?error=access_denied&state=${encodeURIComponent(state)}`);
  assert.equal(res.status, 400);
  assert.match(res.text, /cancelled/);
  assert.equal((await b.get('/tasks')).status, 200);
});

test('unconfigured KICK shows guidance and demo still works', async () => {
  const bare = await startServer();
  try {
    const b = new Browser(bare.base);
    const landing = await b.get('/');
    assert.match(landing.text, /not configured/);
    const login = await b.get('/auth/kick/login');
    assert.equal(login.status, 503);
    assert.match(login.text, /KICK_CLIENT_ID, KICK_CLIENT_SECRET, SESSION_SECRET/);
    await b.post('/demo/start');
    assert.equal((await b.get('/tasks')).status, 200);
  } finally {
    await bare.close();
  }
});

test('mutations are throttled per session', async () => {
  const b = await demoVisitor();
  let last;
  for (let i = 0; i < 45; i++) last = await b.post('/demo/persona', { persona: 'viewer' });
  assert.equal(last.status, 429);
});
