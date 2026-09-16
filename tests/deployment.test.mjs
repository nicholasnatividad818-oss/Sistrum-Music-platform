import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

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
});
