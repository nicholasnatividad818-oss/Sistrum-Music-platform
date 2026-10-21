import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { log } from './log.js';

export const SESSION_COOKIE = 'vw_session';
const SESSION_TTL = 7 * 86_400_000;

export function createSessionStore(db, config) {
  let key = config.sessionSecret;
  if (!key) {
    key = randomBytes(32).toString('hex');
    log('warn', 'SESSION_SECRET is not set; sessions will not survive a restart.');
  }
  const hash = raw => createHmac('sha256', key).update(raw).digest('hex');

  function create(now, carry = {}) {
    const raw = randomBytes(32).toString('base64url');
    const idHash = hash(raw);
    db.prepare(`INSERT INTO sessions (id_hash, user_id, mode, demo_workspace_id, demo_persona, csrf_token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(idHash, carry.user_id ?? null, carry.mode ?? null, carry.demo_workspace_id ?? null,
      carry.demo_persona ?? 'viewer', randomBytes(24).toString('base64url'), now + SESSION_TTL, now);
    return { raw, session: load(idHash) };
  }

  function load(idHash) {
    return db.prepare('SELECT * FROM sessions WHERE id_hash = ?').get(idHash) ?? null;
  }

  return {
    hash,
    /** Returns the current session, or null when the cookie is missing, unknown, or expired. */
    get(raw, now) {
      if (!raw || raw.length > 100) return null;
      const session = load(hash(raw));
      if (!session) return null;
      if (session.expires_at <= now) {
        db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(session.id_hash);
        return null;
      }
      return session;
    },
    create,
    /** Issues a fresh session id (e.g. after login) so a pre-login id cannot be fixated. Demo workspace ownership moves with it. */
    rotate(session, now, changes) {
      const next = create(now, { ...session, ...changes });
      db.prepare('UPDATE workspaces SET owner_session_hash = ? WHERE owner_session_hash = ?').run(next.session.id_hash, session.id_hash);
      db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(session.id_hash);
      db.prepare('DELETE FROM oauth_states WHERE session_hash = ?').run(session.id_hash);
      return next;
    },
    update(session, fields) {
      const allowed = ['user_id', 'mode', 'demo_workspace_id', 'demo_persona'];
      for (const [field, value] of Object.entries(fields)) {
        if (!allowed.includes(field)) throw new Error(`Unknown session field ${field}`);
        db.prepare(`UPDATE sessions SET ${field} = ? WHERE id_hash = ?`).run(value, session.id_hash);
      }
      return load(session.id_hash);
    },
    destroy(session) {
      db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(session.id_hash);
      db.prepare('DELETE FROM oauth_states WHERE session_hash = ?').run(session.id_hash);
    },
    purgeExpired(now) {
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
      db.prepare('DELETE FROM oauth_states WHERE expires_at <= ?').run(now);
    },
  };
}

export function csrfMatches(session, token) {
  if (!session || typeof token !== 'string') return false;
  const a = Buffer.from(session.csrf_token);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sessionCookie(raw, config, maxAgeSeconds = SESSION_TTL / 1000) {
  return [`${SESSION_COOKIE}=${raw}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`, config.secureCookies ? 'Secure' : null]
    .filter(Boolean).join('; ');
}
