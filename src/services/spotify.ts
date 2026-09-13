/** Spotify Web API client. PKCE uses a public Client ID, never a client secret. */
export const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || 'ab765959ac7748f992e5394dc6626ef4';
export const NRN_SPOTIFY_ARTIST_ID = '6R3hYzwo70wQn0YINK7oFu';
const SESSION_KEY = 'sistrum.spotify.session.v1';
const PENDING_KEY = 'sistrum.spotify.pending.v1';
const API = 'https://api.spotify.com/v1/';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
type Session = { access_token: string; refresh_token?: string; expires_at: number };
type Pending = { state: string; verifier: string; redirect: string; created: number };
export type SpotifyProfile = { id: string; account_id?: string; display_name?: string; external_urls?: { spotify?: string } };
export type SpotifyAlbum = { id: string; name: string; release_date?: string; images?: { url: string }[]; external_urls?: { spotify?: string } };
export type SpotifyTrack = { id: string; name: string; duration_ms: number; artists: { name: string }[]; album?: SpotifyAlbum; external_ids?: { isrc?: string }; external_urls?: { spotify?: string } };
export type SpotifyPage<T> = { items: T[]; next: string | null; total?: number };

export class SpotifyError extends Error {
  constructor(message: string, public status = 0, public retryAfter = 0) { super(message); }
}
function read<T>(key: string): T | null {
  try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; }
}
export function isSpotifyConnected() { return Boolean(read<Session>(SESSION_KEY)?.access_token); }
let generation = 0;
export function disconnectSpotify() {
  generation++;
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(PENDING_KEY);
}
export function spotifyRedirectUri() {
  const value = import.meta.env.VITE_SPOTIFY_REDIRECT_URI || window.location.origin;
  const url = new URL(value);
  if (url.origin !== window.location.origin || url.search || url.hash ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname)))) {
    throw new SpotifyError('Spotify requires an HTTPS callback on this site, or a loopback IP for local development.');
  }
  return value;
}
function randomString() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
}
export async function connectSpotify() {
  const redirect = spotifyRedirectUri();
  const verifier = randomString();
  const state = randomString();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, state, redirect, created: Date.now() } satisfies Pending));
  const params = new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, response_type: 'code', redirect_uri: redirect, state, code_challenge_method: 'S256', code_challenge: challenge });
  // Public catalog and basic /me profile need no extra private-data or write scopes.
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
}
async function exchange(params: URLSearchParams): Promise<Session> {
  const response = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new SpotifyError(response.status === 400 ? 'Spotify authorization expired. Connect again.' : 'Spotify could not authorize this connection. Try again.', response.status);
  if (typeof body.access_token !== 'string' || !Number.isFinite(body.expires_in) || body.expires_in <= 0) throw new SpotifyError('Spotify returned an invalid token response.');
  return { access_token: body.access_token, refresh_token: body.refresh_token, expires_at: Date.now() + body.expires_in * 1000 };
}
export function hasSpotifyCallback() {
  const params = new URLSearchParams(window.location.search);
  return params.has('state') && (params.has('code') || params.has('error'));
}
let callbackPromise: Promise<boolean> | undefined;
export function finishSpotifyConnection(): Promise<boolean> {
  if (callbackPromise) return callbackPromise;
  if (!hasSpotifyCallback()) return Promise.resolve(false);
  callbackPromise = (async () => {
    const params = new URLSearchParams(window.location.search);
    const pending = read<Pending>(PENDING_KEY);
    const url = new URL(window.location.href);
    ['code', 'state', 'error', 'error_description'].forEach(key => url.searchParams.delete(key));
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    sessionStorage.removeItem(PENDING_KEY);
    if (!pending || pending.state !== params.get('state') || Date.now() - pending.created > 600000 || Date.now() < pending.created) throw new SpotifyError('Spotify sign-in could not be verified. Start a new connection from this tab.');
    if (params.has('error')) throw new SpotifyError('Spotify connection was cancelled. You can connect again when ready.');
    const current = generation;
    const session = await exchange(new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, grant_type: 'authorization_code', code: params.get('code')!, redirect_uri: pending.redirect, code_verifier: pending.verifier }));
    if (current !== generation) throw new SpotifyError('Spotify was disconnected.');
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return true;
  })();
  return callbackPromise;
}
let refreshPromise: Promise<Session> | undefined;
async function token(force = false): Promise<string> {
  const session = read<Session>(SESSION_KEY);
  if (!session) throw new SpotifyError('Connect Spotify to continue.', 401);
  if (!force && session.expires_at > Date.now() + 60000) return session.access_token;
  if (!session.refresh_token) { disconnectSpotify(); throw new SpotifyError('Your Spotify session expired. Connect again.', 401); }
  if (!refreshPromise) {
    const current = generation;
    refreshPromise = exchange(new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, grant_type: 'refresh_token', refresh_token: session.refresh_token }))
      .then(next => {
        if (generation !== current) throw new SpotifyError('Spotify was disconnected.');
        next.refresh_token ||= session.refresh_token;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
        return next;
      }).catch(error => {
        if (generation === current && error instanceof SpotifyError && [400, 401].includes(error.status)) disconnectSpotify();
        throw error;
      }).finally(() => { refreshPromise = undefined; });
  }
  return (await refreshPromise).access_token;
}
let retryAt = 0;
export async function spotifyGet<T>(path: string): Promise<T> {
  const url = new URL(path, API);
  if (url.origin !== new URL(API).origin || !url.pathname.startsWith('/v1/') || url.username || url.password) throw new SpotifyError('Invalid Spotify API URL.');
  if (Date.now() < retryAt) throw new SpotifyError('Spotify is rate limiting requests. Please wait before trying again.', 429, Math.ceil((retryAt - Date.now()) / 1000));
  let accessToken = await token();
  let response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (response.status === 401) {
    accessToken = await token(true);
    response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) { disconnectSpotify(); throw new SpotifyError('Spotify session expired. Connect again.', 401); }
    if (response.status === 403) throw new SpotifyError('Spotify denied API access. Check that the app owner has Premium and your account is allowed in the app’s User Management settings.', 403);
    if (response.status === 429) {
      const seconds = Math.max(1, Number(response.headers.get('Retry-After')) || 60);
      retryAt = Date.now() + seconds * 1000;
      throw new SpotifyError(body.error?.reason === 'QUOTA_EXCEEDED' ? 'Spotify’s development quota is exhausted. Try again later.' : `Spotify request limit reached. Try again in ${seconds} seconds.`, 429, seconds);
    }
    throw new SpotifyError(`Spotify request failed (${response.status}). Try again.`, response.status);
  }
  return body as T;
}
export const getSpotifyProfile = () => spotifyGet<SpotifyProfile>('me');
export const getNRNReleases = (next?: string) => spotifyGet<SpotifyPage<SpotifyAlbum>>(next || `artists/${NRN_SPOTIFY_ARTIST_ID}/albums?include_groups=album,single&limit=10`);
export const searchSpotifyTracks = (query: string) => spotifyGet<{ tracks: SpotifyPage<SpotifyTrack> }>(`search?${new URLSearchParams({ q: query.trim(), type: 'track', limit: '10' })}`);
