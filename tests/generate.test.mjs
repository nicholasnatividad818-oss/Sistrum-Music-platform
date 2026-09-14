import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateGenerateInput,
  buildLyricsPrompt,
  buildCoverPrompt
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
