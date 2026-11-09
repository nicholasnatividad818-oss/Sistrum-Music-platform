import { once } from 'node:events';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './server.mjs';

async function fixture(t, detectorFetch) {
  const app = createApp({ detectorFetch }).listen(0,'127.0.0.1');
  await once(app,'listening');
  t.after(() => { app.closeAllConnections(); app.close(); });
  const origin = 'http://127.0.0.1:'+app.address().port;
  return {
    get: path => fetch(origin+path),
    post: (path,body,headers) => fetch(origin+'/api/check/'+path,{
      method:'POST', body, headers:{'X-Provenance-Request':'1',...headers}
    })
  };
}

test('serves app and forwards file bytes as multipart', async t => {
  const client = await fixture(t, async (url, options) => {
    assert.match(url,/\/detect$/);
    const chunks = [];
    for await (const chunk of options.body) chunks.push(chunk);
    const bytes = Buffer.concat(chunks);
    assert.equal(bytes.length,Number(options.headers['Content-Length']));
    assert.match(bytes.toString(),/name="file"; filename="track.mp3"/);
    assert.ok(bytes.includes(Buffer.from([0,255,3])));
    return Response.json({verdict:'verified_suno',extra:'private'});
  });
  assert.match(await (await client.get('/')).text(),/Track provenance/);
  assert.deepEqual(await (await client.get('/healthz')).json(),{ok:true});
  const response = await client.post('file',Buffer.from([0,255,3]),{'X-Audio-Extension':'mp3'});
  assert.equal(response.status,200);
  const payload = await response.json();
  assert.equal(payload.verdict,'verified_suno');
  assert.equal(payload.extra,undefined);
});

test('validates URLs and maps upstream outcomes', async t => {
  let calls = 0;
  const client = await fixture(t, async (url,options) => {
    assert.match(url,/\/detect\/url$/);
    assert.equal(JSON.parse(options.body).url,'https://example.com/track.wav');
    calls++;
    if (calls === 1) return Response.json({verdict:'no_suno_provenance'});
    if (calls === 2) return Response.json({verdict:'inconclusive'});
    if (calls === 3) return Response.json({verdict:'unexpected'});
    return new Response(null,{status:429});
  });
  assert.equal((await client.post('url','{"url":"file:///etc/passwd"}')).status,400);
  assert.equal((await client.post('file','audio',{'X-Audio-Extension':'html'})).status,415);
  const body = '{"url":"https://example.com/track.wav"}';
  assert.equal((await (await client.post('url',body)).json()).verdict,'no_suno_provenance');
  assert.equal((await (await client.post('url',body)).json()).verdict,'inconclusive');
  assert.equal((await client.post('url',body)).status,502);
  assert.equal((await client.post('url',body)).status,429);
  assert.equal((await client.post('url',body)).status,429);
  assert.equal(calls,4);
});
