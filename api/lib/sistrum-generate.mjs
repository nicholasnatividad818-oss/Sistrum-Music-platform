const TEXT_MODEL = 'gemini-3.8-flash';
const IMAGE_MODEL = 'gemini-3.1-flash-image';
const INTERACTIONS_URLS = [
  'https://generativelanguage.googleapis.com/v1beta/interactions',
  'https://generativelanguage.googleapis.com/v1beta2/interactions'
];

const GENRES = [
  'Electronic', 'Synthwave', 'Lo-Fi', 'House', 'Ambient', 'Trap',
  'Future Bass', 'Chillhop', 'Indie', 'R&B', 'Hip-Hop', 'Pop', 'Rock'
];

function clip(value, max) {
  return String(value || '').trim().slice(0, max);
}

export function validateGenerateInput(body) {
  if (!body || typeof body !== 'object') throw new Error('Expected a JSON body.');
  const kind = body.kind;
  if (kind !== 'lyrics' && kind !== 'cover') {
    throw new Error('kind must be "lyrics" or "cover".');
  }
  const title = clip(body.title, 120);
  if (!title) throw new Error('Title is required.');
  const artist = clip(body.artist, 80) || 'NRN';
  const genre = clip(body.genre, 40) || 'Electronic';
  const mood = clip(body.mood, 160);
  const theme = clip(body.theme, 280);
  const lyrics = clip(body.lyrics, 2500);
  return { kind, title, artist, genre, mood, theme, lyrics };
}

export function buildLyricsPrompt({ title, artist, genre, mood, theme }) {
  const vibe = [mood, theme].filter(Boolean).join('. ');
  return [
    `Write original song lyrics for "${title}" by ${artist}.`,
    `Genre: ${genre}.`,
    vibe ? `Mood and theme: ${vibe}.` : 'Mood: cinematic, personal, and replayable.',
    'Structure the song with labeled sections such as [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Bridge], [Final Chorus].',
    'Keep it 2–3 minutes of singing: 16–28 short lines total. No stage directions, no commentary, no title heading.',
    'Do not copy existing songs. Return lyrics only.'
  ].join(' ');
}

export function buildCoverPrompt({ title, artist, genre, mood, theme, lyrics }) {
  const vibe = [mood, theme].filter(Boolean).join(', ') || 'nocturnal and cinematic';
  const lyricHint = lyrics
    ? `Imagery suggested by these lyrics (do not render the words): ${lyrics.slice(0, 400)}`
    : 'Abstract music imagery, no people, no logos.';
  return [
    `Square album cover artwork for the track "${title}" by ${artist}.`,
    `Genre: ${genre}. Mood: ${vibe}.`,
    lyricHint,
    'Photoreal-cinematic or painterly, high contrast, dark ground, one strong orange accent like molten #ff5500 light.',
    'No readable text, no typography, no watermarks, no artist name, no album title, no logos, no UI.',
    'Looks like a pressed vinyl sleeve, 1:1 composition, centered subject.'
  ].join(' ');
}

export function coverRequestPayload(input) {
  return {
    model: IMAGE_MODEL,
    input: buildCoverPrompt(input),
    response_format: {
      type: 'image',
      mime_type: 'image/jpeg',
      aspect_ratio: '1:1',
      image_size: '1K'
    }
  };
}

function getApiKey() {
  const key = process.env.GEMINI_API_KEY || '';
  if (!key || key === 'MY_GEMINI_API_KEY') {
    const err = new Error(
      'Gemini is not configured. Add GEMINI_API_KEY on Vercel (Production + Preview), then redeploy.'
    );
    err.status = 503;
    throw err;
  }
  return key;
}

function failFromHttp(status, data) {
  const message = data.error?.message || data.message || `Gemini request failed (${status}).`;
  const err = new Error(message);
  err.status = status === 429 ? 429 : 502;
  return err;
}

async function createInteraction(payload) {
  const key = getApiKey();
  let lastNotFound = null;
  for (const url of INTERACTIONS_URLS) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 404) {
      lastNotFound = failFromHttp(404, data);
      continue;
    }
    if (!response.ok) throw failFromHttp(response.status, data);
    if (data.status && data.status !== 'completed') {
      const err = new Error(data.error?.message || `Gemini interaction ${data.status}.`);
      err.status = 502;
      throw err;
    }
    return data;
  }
  throw lastNotFound || new Error('Gemini Interactions endpoint not found.');
}

export function readOutputText(interaction) {
  if (typeof interaction.output_text === 'string' && interaction.output_text.trim()) {
    return interaction.output_text.trim();
  }
  const steps = interaction.steps || interaction.outputs || [];
  const chunks = [];
  for (const step of steps) {
    if (step?.type && step.type !== 'model_output' && step.type !== 'text') continue;
    const blocks = step.content || (step.type === 'text' ? [step] : []);
    for (const block of blocks) {
      if (block?.type === 'text' && block.text) chunks.push(block.text);
      else if (typeof block?.text === 'string' && !block.type) chunks.push(block.text);
    }
  }
  return chunks.join('').trim();
}

export function readOutputImage(interaction) {
  const direct = interaction.output_image;
  if (direct?.data) {
    return {
      data: direct.data,
      mimeType: direct.mime_type || direct.mimeType || 'image/jpeg'
    };
  }
  const steps = interaction.steps || interaction.outputs || [];
  for (const step of steps) {
    const blocks = step.content || [step];
    for (const block of blocks) {
      if (block?.type === 'image' && block.data) {
        return {
          data: block.data,
          mimeType: block.mime_type || block.mimeType || 'image/jpeg'
        };
      }
    }
  }
  return null;
}

export async function generateSistrumAsset(rawBody) {
  const input = validateGenerateInput(rawBody);
  if (input.kind === 'lyrics') {
    const interaction = await createInteraction({
      model: TEXT_MODEL,
      input: buildLyricsPrompt(input)
    });
    const lyrics = readOutputText(interaction);
    if (!lyrics) throw new Error('Gemini returned empty lyrics.');
    return { kind: 'lyrics', lyrics };
  }

  const interaction = await createInteraction(coverRequestPayload(input));
  const image = readOutputImage(interaction);
  if (!image?.data) throw new Error('Gemini returned no cover image.');
  const mimeType = image.mimeType.startsWith('image/') ? image.mimeType : 'image/jpeg';
  return {
    kind: 'cover',
    mimeType,
    imageDataUrl: `data:${mimeType};base64,${image.data}`
  };
}

export { GENRES, TEXT_MODEL, IMAGE_MODEL, INTERACTIONS_URLS };
