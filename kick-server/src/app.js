import { readFileSync } from 'node:fs';
import { LIVE_WORKSPACE_ID } from './db.js';
import * as domain from './domain.js';
import { DomainError } from './domain.js';
import { log } from './log.js';
import { OAuthError, beginLogin, completeLogin } from './oauth.js';
import { SESSION_COOKIE, createSessionStore, csrfMatches, sessionCookie } from './sessions.js';
import * as views from './views.js';

const CSS = readFileSync(new URL('../public/app.css', import.meta.url));
const MAX_BODY = 16 * 1024;
const RATE_WINDOW = 60_000;
const RATE_LIMIT = 40;

const FLASH = {
  submitted: ['ok', 'Submitted for review.'],
  task_created: ['ok', 'Task posted.'],
  approved: ['ok', 'Approved. One ledger entry was recorded.'],
  approved_again: ['ok', 'This submission was already approved; no new entry was recorded.'],
  rejected: ['ok', 'Submission rejected. No earnings were recorded.'],
  demo_reset: ['ok', 'Your demo workspace was reset.'],
  logged_in: ['ok', 'Logged in with KICK.'],
  logged_out: ['ok', 'Logged out.'],
};

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
};

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

async function readForm(req) {
  const type = String(req.headers['content-type'] ?? '').split(';')[0].trim();
  if (type !== 'application/x-www-form-urlencoded') throw new DomainError(415, 'Unsupported form encoding.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new DomainError(413, 'Form is too large.');
    chunks.push(chunk);
  }
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
}

export function createApp({ db, config, fetchImpl = fetch, now = () => Date.now() }) {
  const sessions = createSessionStore(db, config);
  const rate = new Map();

  function throttled(key, t) {
    const entry = rate.get(key);
    if (!entry || t - entry.start > RATE_WINDOW) {
      rate.set(key, { start: t, count: 1 });
      if (rate.size > 10_000) for (const [k, v] of rate) if (t - v.start > RATE_WINDOW) rate.delete(k);
      return false;
    }
    entry.count += 1;
    return entry.count > RATE_LIMIT;
  }

  /** Resolves who is acting: the demo persona inside the visitor's own workspace, or the live KICK user. */
  function contextFor(session) {
    const ctx = { csrf: session.csrf_token, kickConfigured: config.kickConfigured, mode: null, persona: session.demo_persona };
    const liveUser = session.user_id ? db.prepare('SELECT * FROM users WHERE id = ? AND provider = \'kick\'').get(session.user_id) : null;
    ctx.liveUser = liveUser;
    if (session.mode === 'demo' && session.demo_workspace_id) {
      const ws = db.prepare('SELECT id FROM workspaces WHERE id = ? AND mode = \'demo\' AND owner_session_hash = ?').get(session.demo_workspace_id, session.id_hash);
      if (ws) {
        ctx.mode = 'demo';
        ctx.workspaceId = ws.id;
        ctx.userId = domain.demoUserId(ws.id, session.demo_persona);
        ctx.actorName = db.prepare('SELECT display_name FROM users WHERE id = ?').get(ctx.userId)?.display_name ?? 'Demo';
      }
    } else if (session.mode === 'live' && liveUser) {
      ctx.mode = 'live';
      ctx.workspaceId = LIVE_WORKSPACE_ID;
      ctx.userId = liveUser.id;
      ctx.actorName = liveUser.display_name;
    }
    return ctx;
  }

  return async function handle(req, res) {
    const t = now();
    const url = new URL(req.url, config.baseUrl);
    const path = url.pathname;
    const method = req.method;
    const headers = { ...SECURITY_HEADERS };
    const send = (status, body, type = 'text/html; charset=utf-8') => {
      res.writeHead(status, { ...headers, 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(body);
    };
    const redirect = (location, flash) => {
      const target = flash ? `${location}${location.includes('?') ? '&' : '?'}msg=${flash}` : location;
      res.writeHead(303, { ...headers, Location: target, 'Cache-Control': 'no-store' });
      res.end();
    };

    if (path === '/healthz') return send(200, 'ok', 'text/plain; charset=utf-8');
    if (path === '/static/app.css') {
      res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
      return res.end(CSS);
    }

    let session = sessions.get(parseCookies(req.headers.cookie)[SESSION_COOKIE], t);
    if (!session) {
      const created = sessions.create(t);
      session = created.session;
      headers['Set-Cookie'] = sessionCookie(created.raw, config);
    }
    let ctx = contextFor(session);
    const flashKey = url.searchParams.get('msg');
    if (flashKey && FLASH[flashKey]) ctx.flash = { kind: FLASH[flashKey][0], text: FLASH[flashKey][1] };

    const fail = (status, message) => send(status, views.errorPage(ctx, status, message).html);
    const requireMode = () => {
      if (!ctx.mode) {
        redirect('/');
        return false;
      }
      return true;
    };

    try {
      let form = {};
      if (method === 'POST') {
        const origin = req.headers.origin;
        if (origin && origin !== config.origin) return fail(403, 'Cross-site form submissions are not allowed.');
        if (!origin && req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) {
          return fail(403, 'Cross-site form submissions are not allowed.');
        }
        if (throttled(session.id_hash, t)) return fail(429, 'Too many actions in a short time. Wait a minute and try again.');
        form = await readForm(req);
        if (!csrfMatches(session, form._csrf)) return fail(403, 'Your form expired. Reload the page and try again.');
      } else if (method !== 'GET' && method !== 'HEAD') {
        return fail(405, 'Method not allowed.');
      }

      const route = `${method === 'HEAD' ? 'GET' : method} ${path}`;
      let match;

      if (route === 'GET /') return ctx.mode ? redirect('/tasks') : send(200, views.landingPage(ctx).html);

      // ----- Mode and demo -----
      if (route === 'POST /demo/start') {
        let wsId = session.demo_workspace_id;
        const owned = wsId && db.prepare('SELECT 1 FROM workspaces WHERE id = ? AND owner_session_hash = ?').get(wsId, session.id_hash);
        if (!owned) wsId = domain.createDemoWorkspace(db, session.id_hash, t);
        sessions.update(session, { mode: 'demo', demo_workspace_id: wsId, demo_persona: 'viewer' });
        return redirect('/tasks');
      }
      if (route === 'POST /demo/persona') {
        if (ctx.mode !== 'demo') return fail(400, 'Persona switching is only available in demo mode.');
        if (!['viewer', 'creator'].includes(form.persona)) return fail(400, 'Unknown persona.');
        sessions.update(session, { demo_persona: form.persona });
        return redirect(form.persona === 'creator' ? '/creator' : '/tasks');
      }
      if (route === 'POST /demo/reset') {
        if (ctx.mode !== 'demo') return fail(400, 'Reset is only available in demo mode.');
        if (form.confirm !== 'yes') return fail(400, 'Tick the confirmation box to reset your demo workspace.');
        domain.resetDemoWorkspace(db, ctx.workspaceId, session.id_hash, t);
        return redirect('/settings', 'demo_reset');
      }
      if (route === 'POST /mode') {
        if (form.mode !== 'live' || !ctx.liveUser) return fail(400, 'Log in with KICK to use the live workspace.');
        sessions.update(session, { mode: 'live' });
        return redirect('/tasks');
      }

      // ----- KICK OAuth -----
      if (route === 'GET /auth/kick/login') {
        try {
          return redirect(beginLogin(db, config, session.id_hash, t));
        } catch (error) {
          if (error instanceof OAuthError) return fail(error.status, error.message);
          throw error;
        }
      }
      if (route === 'GET /auth/kick/callback') {
        let userId;
        try {
          userId = await completeLogin({ db, config, fetchImpl, query: Object.fromEntries(url.searchParams), sessionHash: session.id_hash, now: t });
        } catch (error) {
          if (error instanceof OAuthError) return fail(error.status, error.message);
          throw error;
        }
        const next = sessions.rotate(session, t, { user_id: userId, mode: 'live' });
        headers['Set-Cookie'] = sessionCookie(next.raw, config);
        return redirect('/tasks', 'logged_in');
      }
      if (route === 'POST /logout') {
        sessions.destroy(session);
        headers['Set-Cookie'] = sessionCookie('', config, 0);
        return redirect('/', 'logged_out');
      }

      if (route === 'GET /settings') return send(200, views.settingsPage(ctx, config, ctx.liveUser).html);

      // ----- Everything below needs a chosen mode -----
      if (!requireMode()) return;
      const actor = { userId: ctx.userId, workspaceId: ctx.workspaceId, mode: ctx.mode };

      if (route === 'GET /tasks') {
        const type = url.searchParams.get('type');
        return send(200, views.taskBoardPage(ctx, domain.listTasks(db, actor.workspaceId, { type }), type, t).html);
      }
      if (method !== 'POST' && (match = path.match(/^\/tasks\/([\w-]{1,64})$/))) {
        const task = domain.getTask(db, actor.workspaceId, match[1]);
        const mine = db.prepare('SELECT * FROM submissions WHERE task_id = ? AND viewer_id = ?').get(task.id, actor.userId);
        return send(200, views.taskDetailPage(ctx, task, mine, t).html);
      }
      if (method === 'POST' && (match = path.match(/^\/tasks\/([\w-]{1,64})\/submit$/))) {
        domain.submitWork(db, actor, match[1], form, t);
        return redirect('/submissions', 'submitted');
      }
      if (route === 'GET /submissions') return send(200, views.mySubmissionsPage(ctx, domain.listMySubmissions(db, actor)).html);
      if (route === 'GET /creator') return send(200, views.creatorPage(ctx, domain.listCreatorTasks(db, actor), t).html);
      if (route === 'POST /creator/tasks') {
        try {
          const id = domain.createTask(db, actor, form, t);
          return redirect(`/creator/tasks/${id}`, 'task_created');
        } catch (error) {
          if (!(error instanceof DomainError)) throw error;
          ctx = { ...ctx, flash: { kind: 'error', text: error.message } };
          return send(error.status, views.creatorPage(ctx, domain.listCreatorTasks(db, actor), t, form).html);
        }
      }
      if (method !== 'POST' && (match = path.match(/^\/creator\/tasks\/([\w-]{1,64})$/))) {
        const { task, submissions } = domain.listTaskSubmissions(db, actor, match[1]);
        return send(200, views.reviewPage(ctx, task, submissions, t).html);
      }
      if (method === 'POST' && (match = path.match(/^\/creator\/submissions\/([\w-]{1,64})\/(approve|reject)$/))) {
        const taskId = db.prepare('SELECT task_id FROM submissions WHERE id = ?').get(match[1])?.task_id;
        if (match[2] === 'approve') {
          const result = domain.approveSubmission(db, actor, match[1], form.reason, t);
          return redirect(`/creator/tasks/${taskId}`, result.repeated ? 'approved_again' : 'approved');
        }
        domain.rejectSubmission(db, actor, match[1], form.reason, t);
        return redirect(`/creator/tasks/${taskId}`, 'rejected');
      }
      if (route === 'GET /earnings') return send(200, views.earningsPage(ctx, domain.earnings(db, actor)).html);

      return fail(404, 'That page does not exist.');
    } catch (error) {
      if (error instanceof DomainError) return fail(error.status, error.message);
      log('error', 'Request failed', { path, error });
      return fail(500, 'Something went wrong on our side. Your data was not changed; please try again.');
    }
  };
}
