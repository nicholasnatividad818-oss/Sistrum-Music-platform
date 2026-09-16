import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({ entryPoints: ['src/services/platform.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', plugins: [{ name: 'mock-supabase', setup(build) { build.onResolve({ filter: /lib\/supabase$/ }, () => ({ path: 'supabase', namespace: 'test' })); build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const supabase = globalThis.testSupabase;' })); } }] });
let n = 0;
async function setup({ insertError = null, cleanupError = null, coverError = null } = {}) {
  const calls = [];
  globalThis.testSupabase = {
    from: table => ({ insert: async row => { calls.push(['insert', table, row]); return { error: insertError }; } }),
    storage: { from: bucket => ({
      upload: async path => { calls.push(['upload', bucket, path]); return { error: bucket === 'cover-art' ? coverError : null }; },
      getPublicUrl: path => ({ data: { publicUrl: `https://storage.example/${bucket}/${path}` } }),
      remove: async paths => { calls.push(['remove', bucket, paths]); return { error: cleanupError }; },
    }) },
  };
  const client = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text + `\n// ${n++}`).toString('base64')}`);
  return { client, calls };
}
const input = () => ({ user: { id: 'owner' }, profile: null, title: 'Test track', artist: 'NRN', genre: 'Electronic', tags: [], description: '', duration: 30, waveformData: [0.2], audioFile: new File(['audio'], 'track.wav', { type: 'audio/wav' }) });
test('successful publish stores durable audio URL with authenticated owner', async () => {
  const { client, calls } = await setup(); await client.publishTrack(input());
  const row = calls.find(c => c[0] === 'insert')[2];
  assert.equal(row.owner_id, 'owner'); assert.match(row.audio_url, /^https:\/\/storage.example\/audio\/owner\//);
  assert.equal(calls.filter(c => c[0] === 'remove').length, 0);
});
test('metadata failure cleans all successfully uploaded objects', async () => {
  const { client, calls } = await setup({ insertError: new Error('database unavailable') });
  await assert.rejects(client.publishTrack({ ...input(), coverFile: new File(['cover'], 'cover.png', { type: 'image/png' }) }), /database unavailable/);
  assert.deepEqual(calls.filter(c => c[0] === 'remove').map(c => c[1]).sort(), ['audio', 'cover-art']);
});
test('failed cover upload cleans audio and never inserts track', async () => {
  const { client, calls } = await setup({ coverError: new Error('cover rejected') });
  await assert.rejects(client.publishTrack({ ...input(), coverFile: new File(['cover'], 'cover.png', { type: 'image/png' }) }), /cover rejected/);
  assert.equal(calls.some(c => c[0] === 'insert'), false);
  assert.deepEqual(calls.filter(c => c[0] === 'remove').map(c => c[1]), ['audio']);
});
test('cleanup failure is reported instead of silent orphaning', async () => {
  const { client } = await setup({ insertError: new Error('insert failed'), cleanupError: new Error('delete denied') });
  await assert.rejects(client.publishTrack(input()), /could not be cleaned up/);
});
test('invalid title, duration, oversized files and blob cover URLs fail before network writes', async () => {
  const { client, calls } = await setup();
  for (const override of [{ title: ' ' }, { duration: NaN }, { duration: 0 }, { audioFile: { size: 104857601 } }, { coverPresetUrl: 'blob:temporary' }]) {
    await assert.rejects(client.publishTrack({ ...input(), ...override }));
  }
  assert.equal(calls.length, 0);
});
