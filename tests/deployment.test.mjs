import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { exitCodeForReview, parseReview, redact, reviewRequest } from '../scripts/deploy-review.mjs';

function worker(fetch = async () => { throw new Error('offline'); }) {
  const handlers = {};
  const deleted = [];
  vm.runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    self: { location: { origin: 'https://sistrum.test' }, addEventListener: (name, handler) => { handlers[name] = handler; }, clients: { claim() {} } },
    URL, Response, fetch,
    caches: { match: async () => undefined, keys: async () => ['sistrum-shell-v1', 'sistrum-shell-v2', 'other-app'], delete: async name => { deleted.push(name); } },
  });
  return { handlers, deleted };
}

test('worker bypasses OAuth callbacks, APIs, health checks and private requests', () => {
  const { handlers } = worker();
  for (const [path, headers] of [['/?code=secret&state=test', {}], ['/api/profile', {}], ['/healthz', {}], ['/assets/music.mp3', { Authorization: 'Bearer private' }]]) {
    handlers.fetch({ request: { method: 'GET', mode: 'navigate', url: `https://sistrum.test${path}`, headers: new Headers(headers) }, respondWith() { assert.fail(`intercepted ${path}`); } });
  }
});

test('missing offline assets never receive HTML fallback', async () => {
  const { handlers } = worker();
  let result;
  handlers.fetch({ request: { method: 'GET', mode: 'cors', url: 'https://sistrum.test/assets/missing.js', headers: new Headers() }, respondWith(promise) { result = promise; } });
  assert.equal((await result).type, 'error');
});

test('worker upgrade deletes only old Sistrum caches', async () => {
  const { handlers, deleted } = worker();
  let completion;
  handlers.activate({ waitUntil(promise) { completion = promise; } });
  await completion;
  assert.deepEqual(deleted, ['sistrum-shell-v1']);
});

test('deployment includes validation and explicit deploy on matching port', () => {
  const docker = readFileSync('Dockerfile', 'utf8');
  const cloud = readFileSync('cloudbuild.yaml', 'utf8');
  const nginx = readFileSync('nginx.conf', 'utf8');
  assert.match(docker, /RUN npm run check/);
  assert.match(cloud, /- deploy/);
  assert.match(cloud, /--port=8080/);
  assert.match(nginx, /listen 8080;/);
  assert.match(nginx, /location = \/healthz/);
  assert.doesNotMatch(cloud, /\$COMMIT_SHA/);
  assert.match(readFileSync('index.html', 'utf8'), /<title>Sistrum/);
  const reviewAt = cloud.indexOf('scripts/deploy-review.mjs');
  const deployAt = cloud.indexOf('- deploy');
  assert.ok(reviewAt !== -1 && reviewAt < deployAt);
  assert.match(cloud, /secretEnv: \['XAI_API_KEY'\]/);
  assert.match(cloud, /secrets\/xai-api-key\/versions\/latest/);
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  const ciReview = ci.indexOf('scripts/deploy-review.mjs');
  const ciImage = ci.indexOf('docker build');
  assert.ok(ciReview !== -1 && ciReview < ciImage);
  assert.match(ci, /secrets\.XAI_API_KEY/);
  assert.match(docker, /ARG VITE_POSTHOG_KEY/);
  assert.match(cloud, /VITE_POSTHOG_KEY=\$_POSTHOG_KEY/);
  const posthog = readFileSync('src/lib/posthog.ts', 'utf8');
  assert.match(posthog, /if \(!key/);
  assert.doesNotMatch(posthog, /phc_[A-Za-z0-9]/);
});

test('release review redacts bearer tokens and secret keys', () => {
  const sample = 'Authorization: Bearer super-secret-token\nsk-testkey1234567890';
  const out = redact(sample);
  assert.match(out, /Bearer \[redacted\]/);
  assert.doesNotMatch(out, /super-secret-token/);
  assert.doesNotMatch(out, /sk-testkey1234567890/);
});

test('release review asks grok-build-0.1 for a short JSON decision', () => {
  const { url, init } = reviewRequest('secret-key', { kind: 'diff', body: 'diff --git a/nginx.conf' });
  assert.equal(url, 'https://api.x.ai/v1/responses');
  const body = JSON.parse(init.body);
  assert.equal(body.model, 'grok-build-0.1');
  assert.equal(body.max_output_tokens, 800);
  assert.equal(body.store, false);
  assert.equal(body.reasoning, undefined);
  assert.equal(body.text.format.type, 'json_schema');
  assert.deepEqual(body.text.format.schema.properties.decision.enum, ['pass', 'hold']);
  assert.doesNotMatch(init.body, /secret-key/);
  assert.equal(init.headers.Authorization, 'Bearer secret-key');
});

test('release review maps pass, hold, and an empty key', () => {
  assert.equal(exitCodeForReview(parseReview('{"decision":"pass","summary":"ok","risks":[]}')), 0);
  assert.equal(exitCodeForReview(parseReview('{"decision":"hold","summary":"secret","risks":[{"severity":"high","path":"cloudbuild.yaml","reason":"key"}]}')), 2);
  assert.equal(exitCodeForReview(parseReview('not json')), 2);
  const env = { ...process.env };
  delete env.XAI_API_KEY;
  const skipped = spawnSync(process.execPath, ['scripts/deploy-review.mjs'], { env, encoding: 'utf8' });
  assert.equal(skipped.status, 0);
  assert.match(skipped.stdout, /AI release review skipped/);
});
