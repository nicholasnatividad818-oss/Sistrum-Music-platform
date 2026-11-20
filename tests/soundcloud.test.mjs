import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { encrypt, decrypt, listOwnTracks, requestWithBackoff } from '../integrations/soundcloud/router.mjs';

process.env.SOUNDCLOUD_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');

test('tokens round trip through AES-256-GCM and tampering is rejected', () => {
  const encrypted = encrypt('test-access-token');
  assert.notEqual(encrypted, 'test-access-token');
  assert.equal(decrypt(encrypted), 'test-access-token');
  const segments = encrypted.split('.');
  segments[1] = 'AAAAAAAAAAAAAAAAAAAAAA';
  assert.throws(() => decrypt(segments.join('.')));
});

test('API requests use the SoundCloud OAuth authorization scheme', async () => {
  const page1 = 'https://api.soundcloud.com/me/tracks?linked_partitioning=true&limit=100';
  const page2 = 'https://api.soundcloud.com/me/tracks?cursor=next';
  const db = {
    from(name) {
      assert.equal(name, 'soundcloud_connections');
      return {
        select() { return this; },
        eq() { return this; },
        async single() {
          return { data: { access_token_enc: encrypt('abc'), expires_at: new Date(Date.now() + 3_600_000).toISOString() }, error: null };
        },
      };
    },
  };
  const urls = [];
  const fetcher = async (url, options) => {
    urls.push(String(url));
    assert.equal(options.headers.Authorization, 'OAuth abc');
    return new Response(JSON.stringify(urls.length === 1
      ? { collection: [{ urn: 'soundcloud:tracks:1', title: 'One' }], next_href: page2 }
      : { collection: [{ urn: 'soundcloud:tracks:2', title: 'Two' }] }), { status: 200 });
  };
  const tracks = await listOwnTracks(db, 'sistrum-user', fetcher);
  assert.equal(tracks.length, 2);
  assert.deepEqual(urls, [page1, page2]);
});

test('rejects off-host next_href before issuing an outbound request', async () => {
  const db = {
    from() {
      return { select() { return this; }, eq() { return this; },
        async single() { return { data: { access_token_enc: encrypt('abc'), expires_at: new Date(Date.now() + 3_600_000).toISOString() } }; } };
    },
  };
  let requests = 0;
  const fetcher = async () => {
    requests++;
    return new Response(JSON.stringify({ collection: [], next_href: 'https://example.org/steal-token' }), { status: 200 });
  };
  await assert.rejects(() => listOwnTracks(db, 'sistrum-user', fetcher), /Unexpected SoundCloud pagination URL/);
  assert.equal(requests, 1);
});

test('surfaces a SoundCloud HTTP 401 instead of returning success', async () => {
  await assert.rejects(
    () => requestWithBackoff('https://api.soundcloud.com/me', {}, async () => new Response('{}', { status: 401 })),
    (error) => error.status === 401
  );
});
