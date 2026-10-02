import { operations } from './labelgrid-operations.ts';
export function resolveOperation(method: string, path: string) {
  if (!/^\/[a-zA-Z0-9_{}/-]+$/.test(path) || path.includes('..') || path.includes('//')) return false;
  return operations.some(o => o.method === method && new RegExp('^' + o.path.replace(/\{[^}]+\}/g, '[a-zA-Z0-9_-]+') + '$').test(path));
}
export async function labelgridRequest(base: string, token: string, method: string, path: string, body?: unknown, query: Record<string, string> = {}, fetcher = fetch) {
  if (!['https://api.labelgrid.com/api/public', 'https://api-sandbox.stg.labelgrid.com/api/public'].includes(base)) throw new Error('Invalid LabelGrid API base');
  if (!resolveOperation(method, path)) throw new Error('Unsupported operation');
  const url = new URL(base + path);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
  // Never retry mutations: a timeout can occur after the remote write succeeded.
  const response = await fetcher(url, { method, redirect: 'error', signal: AbortSignal.timeout(25000), headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(method === 'GET' || body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { message: 'LabelGrid returned a non-JSON response' }; }
  return { status: response.status, data, retryAfter: response.headers.get('Retry-After') };
}
export async function verifyWebhook(raw: string, signature: string, secret: string, now = Date.now()) {
  if (!/^[a-f0-9]{64}$/.test(signature)) throw new Error('Invalid signature');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const bytes = Uint8Array.from(signature.match(/../g)!, h => parseInt(h, 16));
  if (!await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(raw))) throw new Error('Invalid signature');
  const payload = JSON.parse(raw);
  const sent = typeof payload.timestamp === 'string' ? Date.parse(payload.timestamp) : NaN;
  if (!Number.isFinite(sent) || Math.abs(now - sent) > 300000) throw new Error('Stale delivery');
  if (typeof payload.event !== 'string' || !payload.data || typeof payload.data !== 'object') throw new Error('Invalid event');
  return payload;
}
