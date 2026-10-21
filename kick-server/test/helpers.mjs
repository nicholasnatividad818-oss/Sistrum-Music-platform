import { createServer } from 'node:http';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db.js';

process.env.VIEWERWORKS_SILENT = '1';

export function testConfig(overrides = {}) {
  return loadConfig({ BASE_URL: 'http://127.0.0.1', DATABASE_PATH: ':memory:', ...overrides });
}

export const kickEnv = { KICK_CLIENT_ID: 'client-123', KICK_CLIENT_SECRET: 'super-secret-value', SESSION_SECRET: 'x'.repeat(40) };

/** Starts the app on an ephemeral port. Returns base URL and a close function. */
export async function startServer({ env = {}, fetchImpl, now } = {}) {
  const db = openDatabase(':memory:');
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const config = loadConfig({ BASE_URL: base, ...env });
  server.on('request', createApp({ db, config, fetchImpl, now }));
  return { base, db, config, close: () => new Promise(resolve => server.close(resolve)) };
}

/** Minimal browser: keeps cookies, does not follow redirects, extracts the CSRF token. */
export class Browser {
  constructor(base) {
    this.base = base;
    this.cookies = new Map();
    this.csrf = null;
  }
  async request(path, { method = 'GET', form, headers = {} } = {}) {
    const init = { method, redirect: 'manual', headers: { ...headers } };
    const cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookie) init.headers.cookie = cookie;
    if (form) {
      init.headers['content-type'] = 'application/x-www-form-urlencoded';
      init.body = new URLSearchParams(form).toString();
    }
    const res = await fetch(this.base + path, init);
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const [name, value] = pair.split('=');
      if (/Max-Age=0/.test(line)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    const text = await res.text();
    const token = text.match(/name="_csrf" value="([^"]+)"/);
    if (token) this.csrf = token[1];
    return { status: res.status, location: res.headers.get('location'), text, headers: res.headers };
  }
  get(path) {
    return this.request(path);
  }
  async post(path, form = {}, { csrf = true, headers } = {}) {
    if (csrf && !this.csrf) await this.get('/settings');
    return this.request(path, { method: 'POST', form: csrf ? { _csrf: this.csrf, ...form } : form, headers });
  }
}
