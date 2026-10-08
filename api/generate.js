import { generateSistrumAsset } from './lib/sistrum-generate.mjs';

export const config = { maxDuration: 60 };

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
const hits = new Map();

function clientKey(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'anon'
  );
}

function limited(req) {
  const key = clientKey(req);
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return true;
  recent.push(now);
  hits.set(key, recent);
  return false;
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    send(res, 405, { error: 'POST a lyrics or cover request.' });
    return;
  }
  if (limited(req)) {
    send(res, 429, { error: 'Too many generate requests. Wait a minute.' });
    return;
  }

  try {
    const body = await readJson(req);
    const result = await generateSistrumAsset(body);
    send(res, 200, result);
  } catch (error) {
    const status = Number(error.status) || (error instanceof SyntaxError ? 400 : 500);
    send(res, status, { error: error.message || 'Generation failed.' });
  }
}
