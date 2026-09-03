import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const INSTAGRAM_SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
  'instagram_business_manage_comments',
  'instagram_business_manage_messages'
] as const;

const OAUTH_AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize';
const OAUTH_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const LONG_LIVED_TOKEN_URL = 'https://graph.instagram.com/access_token';

export const apiVersion = process.env.INSTAGRAM_API_VERSION || 'v26.0';
export const graphBaseUrl = `https://graph.instagram.com/${apiVersion}`;

export function requireInstagramEnv() {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

  if (!appId || !appSecret || !redirectUri) {
    throw new Error('Missing INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, or INSTAGRAM_REDIRECT_URI');
  }

  return { appId, appSecret, redirectUri };
}

export function parseCookies(cookieHeader?: string) {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  for (const part of cookieHeader.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    cookies[key] = decodeURIComponent(value);
  }

  return cookies;
}

export function appendSetCookie(res: any, cookie: string) {
  const current = res.getHeader?.('Set-Cookie');
  const list = Array.isArray(current) ? current : current ? [String(current)] : [];
  res.setHeader('Set-Cookie', [...list, cookie]);
}

export function secureCookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearCookie(name: string) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function createOauthState() {
  const { appSecret } = requireInstagramEnv();
  const nonce = randomBytes(24).toString('hex');
  const signature = createHmac('sha256', appSecret).update(nonce).digest('hex');
  return { nonce, state: `${nonce}.${signature}` };
}

export function verifyOauthState(state: string | undefined, cookieNonce: string | undefined) {
  if (!state || !cookieNonce) return false;
  const [nonce, signature] = state.split('.');
  if (!nonce || !signature || nonce !== cookieNonce) return false;

  const { appSecret } = requireInstagramEnv();
  const expected = createHmac('sha256', appSecret).update(nonce).digest('hex');
  const a = Buffer.from(signature, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function buildAuthorizationUrl(state: string) {
  const { appId, redirectUri } = requireInstagramEnv();
  const url = new URL(OAUTH_AUTHORIZE_URL);
  url.searchParams.set('enable_fb_login', '0');
  url.searchParams.set('force_authentication', '1');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', INSTAGRAM_SCOPES.join(','));
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeAuthorizationCode(code: string) {
  const { appId, appSecret, redirectUri } = requireInstagramEnv();
  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code
  });

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_message || payload.error?.message || 'Instagram code exchange failed');
  }

  return payload as { access_token: string; user_id: number | string; permissions?: string[] };
}

export async function exchangeLongLivedToken(shortLivedToken: string) {
  const { appSecret } = requireInstagramEnv();
  const url = new URL(LONG_LIVED_TOKEN_URL);
  url.searchParams.set('grant_type', 'ig_exchange_token');
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('access_token', shortLivedToken);

  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error?.message || 'Instagram long-lived token exchange failed');
  }

  return payload as { access_token: string; token_type?: string; expires_in?: number };
}

export function getAccessToken(req: any) {
  return parseCookies(req.headers?.cookie).ig_access_token || null;
}

export function getInstagramUserId(req: any) {
  return parseCookies(req.headers?.cookie).ig_user_id || null;
}

function withAccessToken(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(path.startsWith('http') ? path : `${graphBaseUrl}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('access_token', token);
  return url;
}

export async function graphGet(path: string, token: string, params: Record<string, string> = {}) {
  const response = await fetch(withAccessToken(path, token, params));
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || 'Instagram API request failed');
  return payload;
}

export async function graphPost(path: string, token: string, params: Record<string, string>) {
  const response = await fetch(withAccessToken(path, token, params), { method: 'POST' });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || 'Instagram API request failed');
  return payload;
}

export async function getProfile(token: string) {
  return graphGet('/me', token, {
    fields: 'id,username,account_type,media_count,profile_picture_url,name'
  });
}

export function getQueryValue(value: unknown) {
  return Array.isArray(value) ? String(value[0] ?? '') : value == null ? '' : String(value);
}

export function readJsonBody(req: any) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

export function sendJson(res: any, status: number, body: unknown) {
  res.status(status).json(body);
}

export function requireToken(req: any, res: any) {
  const token = getAccessToken(req);
  if (!token) {
    sendJson(res, 401, { error: 'Instagram is not connected.' });
    return null;
  }
  return token;
}
