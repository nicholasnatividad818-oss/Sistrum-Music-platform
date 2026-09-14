import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateGenerateInput,
  buildLyricsPrompt,
  buildCoverPrompt,
  coverRequestPayload,
  readOutputText,
  readOutputImage,
  INTERACTIONS_URLS
} from '../api/lib/sistrum-generate.mjs';

test('rejects missing kind and title', () => {
  assert.throws(() => validateGenerateInput({}), /kind must be/);
  assert.throws(() => validateGenerateInput({ kind: 'lyrics' }), /Title is required/);
});

test('clips fields and defaults artist', () => {
  const input = validateGenerateInput({
    kind: 'cover',
    title: '  Midnight  ',
    artist: '',
    lyrics: 'x'.repeat(4000)
  });
  assert.equal(input.title, 'Midnight');
  assert.equal(input.artist, 'NRN');
  assert.equal(input.lyrics.length, 2500);
});

test('lyrics prompt asks for original labeled sections', () => {
  const prompt = buildLyricsPrompt({
    title: 'Katana Drift',
    artist: 'NRN',
    genre: 'Synthwave',
    mood: 'chrome night',
    theme: 'leaving the city'
  });
  assert.match(prompt, /Katana Drift/);
  assert.match(prompt, /\[Chorus\]/);
  assert.match(prompt, /Do not copy existing songs/);
});

test('cover prompt forbids readable text', () => {
  const prompt = buildCoverPrompt({
    title: 'Katana Drift',
    artist: 'NRN',
    genre: 'Synthwave',
    mood: 'chrome',
    theme: '',
    lyrics: '[Chorus]\nNeon in the rearview'
  });
  assert.match(prompt, /No readable text/);
  assert.match(prompt, /do not render the words/);
  assert.match(prompt, /#ff5500/);
});

test('cover request is square jpeg via Interactions v1beta', () => {
  assert.equal(INTERACTIONS_URLS[0], 'https://generativelanguage.googleapis.com/v1beta/interactions');
  const payload = coverRequestPayload({
    title: 'Katana Drift',
    artist: 'NRN',
    genre: 'Synthwave',
    mood: '',
    theme: '',
    lyrics: ''
  });
  assert.equal(payload.model, 'gemini-3.1-flash-image');
  assert.equal(payload.response_format.type, 'image');
  assert.equal(payload.response_format.mime_type, 'image/jpeg');
  assert.equal(payload.response_format.aspect_ratio, '1:1');
  assert.equal(payload.response_format.image_size, '1K');
});

test('readOutputText skips thought steps', () => {
  const lyrics = readOutputText({
    steps: [
      { type: 'thought', content: [{ type: 'text', text: 'I should write a chorus' }] },
      { type: 'model_output', content: [{ type: 'text', text: '[Verse 1]\nChrome rain' }] }
    ]
  });
  assert.equal(lyrics, '[Verse 1]\nChrome rain');
});

test('readOutputImage prefers output_image then steps', () => {
  const direct = readOutputImage({
    output_image: { data: 'AAA', mime_type: 'image/jpeg' }
  });
  assert.equal(direct.data, 'AAA');
  assert.equal(direct.mimeType, 'image/jpeg');
  const stepped = readOutputImage({
    steps: [
      { type: 'model_output', content: [{ type: 'image', data: 'BBB', mime_type: 'image/png' }] }
    ]
  });
  assert.equal(stepped.data, 'BBB');
  assert.equal(stepped.mimeType, 'image/png');
});
