import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { build } from 'esbuild';
const { outputFiles } = await build({ entryPoints: ['supabase/functions/_shared/labelgrid.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { resolveOperation, labelgridRequest, verifyWebhook } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('only documented operations and safe paths are accepted', () => {
  assert.equal(resolveOperation('POST', '/releases/123/distribute'), true);
  for (const path of ['/tokens/current', '/releases/../tokens', '//evil.example', '/releases/1?url=x', '/releases/1/takedown-all']) assert.equal(resolveOperation('POST', path), false);
  assert.equal(resolveOperation('DELETE', '/releases/123'), false);
});
test('upstream token is server header only, and 429 is returned without retry', async () => {
  let calls = 0;
  const result = await labelgridRequest('https://api.labelgrid.com/api/public', 'private-token', 'POST', '/releases/4/validate', undefined, {}, async (url, init) => {
    calls++; assert.equal(init.headers.Authorization, 'Bearer private-token'); assert.equal(init.redirect, 'error'); assert.equal(init.body, undefined);
    return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { 'Retry-After': '60' } });
  });
  assert.equal(calls, 1); assert.equal(result.status, 429); assert.equal(result.retryAfter, '60');
});
test('arbitrary API hosts and redirect proxies are rejected', async () => {
  await assert.rejects(labelgridRequest('https://evil.example', 'token', 'GET', '/releases'), /Invalid LabelGrid/);
});
const now = Date.parse('2026-10-02T19:00:00Z');
const body = timestamp => JSON.stringify({ timestamp, event: 'delivery.completed', data: { release_id: 1 } });
const sign = raw => createHmac('sha256', 'secret').update(raw).digest('hex');
test('authentic fresh webhook is accepted', async () => {
  const raw = body('2026-10-02T19:00:00Z'); assert.equal((await verifyWebhook(raw, sign(raw), 'secret', now)).event, 'delivery.completed');
});
test('tampering, invalid signatures and signed stale timestamps are rejected', async () => {
  const raw = body('2026-10-02T19:00:00Z');
  await assert.rejects(verifyWebhook(raw.replace('completed','failed'), sign(raw), 'secret', now), /Invalid signature/);
  await assert.rejects(verifyWebhook(raw, 'sha256=' + sign(raw), 'secret', now), /Invalid signature/);
  const stale = body('2026-10-01T19:00:00Z');
  await assert.rejects(verifyWebhook(stale, sign(stale), 'secret', now), /Stale/);
});
async function handler(userId, allowed = 'operator') {
  let captured;
  globalThis.Deno = { env: { get: key => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service', LABELGRID_OPERATOR_IDS: allowed, LABELGRID_API_TOKEN: 'token' })[key] }, serve: fn => { captured = fn; } };
  globalThis.testAdmin = { auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }) } };
  const bundle = await build({ entryPoints: ['supabase/functions/labelgrid/index.ts'], bundle: true, write: false, platform: 'node', format: 'esm', plugins: [{ name: 'mock-admin', setup(b) { b.onResolve({ filter: /^npm:/ }, () => ({ path: 'admin', namespace: 'test' })); b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const createClient = () => globalThis.testAdmin;' })); } }] });
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text + `\n//${Math.random()}`).toString('base64')}`);
  return captured;
}
test('gateway rejects unsigned requests and ordinary signed-in users', async () => {
  const serve = await handler('ordinary-user');
  assert.equal((await serve(new Request('https://local', { method: 'POST' }))).status, 401);
  assert.equal((await serve(new Request('https://local', { method: 'POST', headers: { Authorization: 'Bearer jwt' }, body: '{}' }))).status, 403);
});
test('authorized operator cannot submit without explicit confirmation', async () => {
  const serve = await handler('operator');
  const response = await serve(new Request('https://local', { method: 'POST', headers: { Authorization: 'Bearer jwt' }, body: JSON.stringify({ method: 'POST', path: '/releases/1/distribute' }) }));
  assert.equal(response.status, 400); assert.match((await response.json()).error, /Confirm/);
});
