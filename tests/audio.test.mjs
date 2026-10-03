import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({ entryPoints: ['src/services/audioEngine.ts'], bundle: true, write: false, format: 'esm' });
let version = 0;
async function setup(fetcher, decoder = async () => ({ duration: 42 })) {
  const sources = [];
  const node = () => ({ connect() {}, gain: { value: 0 }, frequency: { value: 0 }, Q: { value: 0 } });
  globalThis.window = { AudioContext: class {
    state = 'running'; currentTime = 0; destination = {};
    createGain = node; createBiquadFilter = node;
    createAnalyser() { return { ...node(), frequencyBinCount: 64 }; }
    decodeAudioData = decoder;
    createBufferSource() { const source = { connect() {}, disconnect() {}, stop() {}, playbackRate: {}, start() { sources.push(this.buffer); } }; return source; }
  } };
  globalThis.fetch = fetcher;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  const { audioEngine } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text + `\n// ${version++}`).toString('base64')}`);
  return { audioEngine, sources };
}
test('HTTPS audio is fetched, decoded, and played with actual duration', async () => {
  const urls = [];
  const { audioEngine, sources } = await setup(async url => { urls.push(url); return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; });
  await audioEngine.loadTrack('house', 180, 120, 'https://storage.example/track.wav');
  audioEngine.play();
  assert.deepEqual(urls, ['https://storage.example/track.wav']);
  assert.equal(audioEngine.getDuration(), 42);
  assert.equal(sources[0].duration, 42);
  audioEngine.stop();
});
test('failed audio requests and decode errors reject instead of substituting synth audio', async () => {
  const { audioEngine } = await setup(async () => ({ ok: false, status: 404 }));
  await assert.rejects(audioEngine.loadTrack('house', 180, 120, 'https://storage.example/missing.wav'), /404/);
  const other = await setup(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }), async () => { throw new Error('Invalid audio'); });
  await assert.rejects(other.audioEngine.loadTrack('house', 180, 120, 'blob:invalid'), /Invalid audio/);
});
test('latest track wins when earlier audio finishes decoding later', async () => {
  let finishFirst;
  let calls = 0;
  const { audioEngine, sources } = await setup(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }), () => ++calls === 1 ? new Promise(resolve => { finishFirst = resolve; }) : Promise.resolve({ duration: 25 }));
  const first = audioEngine.loadTrack('house', 180, 120, 'https://storage.example/first.wav');
  await new Promise(resolve => setImmediate(resolve));
  const second = audioEngine.loadTrack('house', 180, 120, 'https://storage.example/second.wav');
  await second;
  finishFirst({ duration: 90 });
  await first;
  audioEngine.play();
  assert.equal(audioEngine.getDuration(), 25);
  assert.equal(sources[0].duration, 25);
  audioEngine.stop();
});
