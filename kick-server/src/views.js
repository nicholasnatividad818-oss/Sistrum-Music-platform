import { LIMITS, TASK_TYPES, taskAvailability } from './domain.js';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Tagged template that escapes every interpolation unless it is already-rendered markup. */
class Safe {
  constructor(html) { this.html = html; }
  toString() { return this.html; }
}
export const raw = html => new Safe(html);
export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((value, i) => {
    const rendered = Array.isArray(value) ? value.map(v => (v instanceof Safe ? v.html : escapeHtml(v))).join('')
      : value instanceof Safe ? value.html
      : value === false || value == null ? ''
      : escapeHtml(value);
    out += rendered + strings[i + 1];
  });
  return new Safe(out);
}

export const money = cents => `$${(cents / 100).toFixed(2)}`;
const amount = (cents, mode) => (mode === 'demo' ? `${money(cents)} demo credit` : money(cents));
const date = ms => new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const external = (href, label) => html`<a href="${href}" target="_blank" rel="noopener noreferrer nofollow ugc">${label ?? href}</a>`;
const modeBadge = mode => html`<span class="badge ${mode}">${mode === 'demo' ? 'Demo' : 'Live'}</span>`;
const csrfField = ctx => html`<input type="hidden" name="_csrf" value="${ctx.csrf}">`;

const STATE_LABEL = { submitted: 'Submitted · awaiting review', approved: 'Approved', rejected: 'Rejected' };

export function layout(ctx, title, body, { active } = {}) {
  const nav = [
    ['tasks', '/tasks', 'Task board'],
    ['submissions', '/submissions', 'My submissions'],
    ['creator', '/creator', 'Creator'],
    ['earnings', '/earnings', 'Earnings'],
    ['settings', '/settings', 'Settings'],
  ];
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · ViewerWorks</title>
<link rel="stylesheet" href="/static/app.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <a class="brand" href="/">Viewer<span>Works</span></a>
  ${ctx.mode ? html`<nav aria-label="Main"><ul>${nav.map(([key, href, label]) => html`<li><a href="${href}"${raw(active === key ? ' aria-current="page"' : '')}>${label}</a></li>`)}</ul></nav>` : ''}
  ${ctx.mode ? html`<div class="who">${modeBadge(ctx.mode)} <span>${ctx.actorName}</span></div>` : ''}
</header>
${ctx.mode === 'demo' ? html`<div class="demo-banner" role="note">Demo workspace: every task, balance and approval here is simulated. No money is held or paid.
  <form method="post" action="/demo/persona" class="inline">${csrfField(ctx)}
    <input type="hidden" name="persona" value="${ctx.persona === 'viewer' ? 'creator' : 'viewer'}">
    <button class="link">Switch to ${ctx.persona === 'viewer' ? 'creator' : 'viewer'} persona</button>
  </form></div>` : ''}
<main id="main">
${ctx.flash ? html`<p class="flash ${ctx.flash.kind}" role="status">${ctx.flash.text}</p>` : ''}
${body}
</main>
<footer class="foot">ViewerWorks is an independent demonstration and is not affiliated with or endorsed by KICK.</footer>
</body>
</html>`;
}

export function landingPage(ctx) {
  return layout(ctx, 'Welcome', html`
<section class="hero">
  <h1>Get credit for helping streamers ship content.</h1>
  <p>Scout highlight moments, share clip links and write captions. Creators review your work and approved tasks add to an auditable earnings ledger.</p>
  <div class="actions">
    <form method="post" action="/demo/start">${csrfField(ctx)}<button class="primary">Try the demo</button></form>
    ${ctx.kickConfigured ? html`<a class="button" href="/auth/kick/login">Log in with KICK</a>`
      : html`<p class="muted">KICK login is not configured on this server yet. See <a href="/settings">Settings</a>.</p>`}
  </div>
  <p class="muted small">Demo mode needs no account and is isolated to this browser. Real payouts are not available.</p>
</section>`);
}

export function taskBoardPage(ctx, tasks, type, now) {
  const filters = [['', 'All'], ...Object.entries(TASK_TYPES)];
  return layout(ctx, 'Task board', html`
<h1>Task board</h1>
<nav class="chips" aria-label="Filter by type">${filters.map(([key, label]) =>
  html`<a href="/tasks${key ? `?type=${key}` : ''}"${raw((type ?? '') === key ? ' aria-current="true"' : '')}>${label}</a>`)}</nav>
${tasks.length ? html`<div class="grid">${tasks.map(task => taskCard(task, now))}</div>`
  : html`<p class="empty">No tasks here yet. ${ctx.mode === 'live' ? 'Creators can post one from the Creator page.' : ''}</p>`}`, { active: 'tasks' });
}

function taskCard(task, now) {
  const availability = taskAvailability(task, now);
  return html`<article class="card">
  <div class="card-head"><span class="type">${TASK_TYPES[task.type]}</span>${modeBadge(task.mode)}${availability !== 'open' ? html`<span class="badge closed">${availability}</span>` : ''}</div>
  <h2><a href="/tasks/${task.id}">${task.title}</a></h2>
  <p>${task.brief}</p>
  <dl class="facts">
    <div><dt>Creator</dt><dd>${task.creator_name}</dd></div>
    <div><dt>Reward</dt><dd>${amount(task.reward_cents, task.mode)}</dd></div>
    <div><dt>Slots left</dt><dd>${task.slots_remaining} of ${task.slots_total}</dd></div>
    <div><dt>Effort</dt><dd>~${task.effort_minutes} min</dd></div>
    <div><dt>Deadline</dt><dd>${date(task.deadline_at)}</dd></div>
  </dl>
</article>`;
}

export function taskDetailPage(ctx, task, mine, now) {
  const availability = taskAvailability(task, now);
  const own = task.creator_id === ctx.userId;
  let form;
  if (own) form = html`<p class="muted">This is your task. <a href="/creator/tasks/${task.id}">Review its submissions</a>.</p>`;
  else if (mine) form = html`<p class="muted">You submitted on ${date(mine.created_at)}. Status: <strong>${STATE_LABEL[mine.state]}</strong>. <a href="/submissions">View my submissions</a>.</p>`;
  else if (availability !== 'open') form = html`<p class="muted">This task is ${availability} and no longer accepts submissions.</p>`;
  else form = submissionForm(ctx, task);
  return layout(ctx, task.title, html`
<p><a href="/tasks">← Back to tasks</a></p>
<article class="detail">
  <div class="card-head"><span class="type">${TASK_TYPES[task.type]}</span>${modeBadge(task.mode)}</div>
  <h1>${task.title}</h1>
  <p>${task.brief}</p>
  <dl class="facts">
    <div><dt>Creator</dt><dd>${task.creator_name}</dd></div>
    <div><dt>Reward</dt><dd>${amount(task.reward_cents, task.mode)}</dd></div>
    <div><dt>Slots left</dt><dd>${task.slots_remaining} of ${task.slots_total}</dd></div>
    <div><dt>Effort</dt><dd>~${task.effort_minutes} min</dd></div>
    <div><dt>Deadline</dt><dd>${date(task.deadline_at)}</dd></div>
    <div><dt>Source</dt><dd>${external(task.source_url)}</dd></div>
  </dl>
  <h2>Acceptance criteria</h2>
  <p class="pre">${task.acceptance_criteria}</p>
</article>
<section class="panel"><h2>Submit your work</h2>${form}</section>`, { active: 'tasks' });
}

function submissionForm(ctx, task) {
  const fields = {
    scouting: html`
      <label for="ts">Timestamp in the source (e.g. 1:23:45)</label>
      <input id="ts" name="moment_timestamp" required maxlength="8" pattern="(\\d{1,2}:)?[0-5]?\\d:[0-5]\\d" inputmode="numeric">
      <label for="ex">Why this moment works</label>
      <textarea id="ex" name="explanation" required maxlength="${LIMITS.explanation}" rows="4"></textarea>`,
    clip: html`
      <label for="asset">HTTPS link to your clip</label>
      <input id="asset" name="asset_url" type="url" required maxlength="${LIMITS.url}" pattern="https://.*" placeholder="https://">
      <label for="ex">Note for the creator (optional)</label>
      <textarea id="ex" name="explanation" maxlength="${LIMITS.explanation}" rows="3"></textarea>`,
    caption: html`
      <label for="cap">Caption</label>
      <textarea id="cap" name="caption" required maxlength="${LIMITS.caption}" rows="3"></textarea>`,
  }[task.type];
  return html`<form method="post" action="/tasks/${task.id}/submit" class="stack">${csrfField(ctx)}
  ${fields}
  <label class="check"><input type="checkbox" name="rights" value="yes" required> I made this submission myself and have the right to share it with this creator for this task.</label>
  <button class="primary">Submit for review</button>
</form>`;
}

export function mySubmissionsPage(ctx, rows) {
  return layout(ctx, 'My submissions', html`
<h1>My submissions</h1>
${rows.length ? html`<ul class="list">${rows.map(row => html`<li class="row">
  <div><a href="/tasks/${row.task_id}"><strong>${row.title}</strong></a> <span class="muted">for ${row.creator_name} · ${TASK_TYPES[row.type]}</span></div>
  <div class="state ${row.state}">${STATE_LABEL[row.state]}${row.reviewed_at ? html` · ${date(row.reviewed_at)}` : ''}</div>
  ${evidence(row)}
  ${row.review_reason ? html`<p class="reason">Creator note: ${row.review_reason}</p>` : ''}
  <p class="muted small">Submitted ${date(row.created_at)} · ${row.state === 'approved' ? `Earned ${amount(row.earned_cents, ctx.mode)}` : `Potential ${amount(row.reward_cents, ctx.mode)}`}</p>
</li>`)}</ul>` : html`<p class="empty">You have not submitted any work yet. <a href="/tasks">Browse the task board</a>.</p>`}`, { active: 'submissions' });
}

function evidence(row) {
  if (row.moment_timestamp) return html`<p class="evidence"><strong>${row.moment_timestamp}</strong> — ${row.explanation}</p>`;
  if (row.asset_url) return html`<p class="evidence">${external(row.asset_url, 'Open clip link')}${row.explanation ? html` — ${row.explanation}` : ''}</p>`;
  if (row.caption) return html`<p class="evidence pre">“${row.caption}”</p>`;
  return '';
}

export function creatorPage(ctx, tasks, now, values = {}) {
  const tomorrow = new Date(now + 7 * 86_400_000).toISOString().slice(0, 10);
  const v = { type: 'scouting', effort_minutes: '15', slots: '3', reward: '2.00', deadline: tomorrow, ...values };
  return layout(ctx, 'Creator workspace', html`
<h1>Creator workspace</h1>
<section class="panel">
  <h2>Post a task</h2>
  <p class="muted small">${ctx.mode === 'demo' ? 'Rewards here are demonstration allocations, not deposited funds.'
    : 'Rewards are recorded as ledger allocations only. ViewerWorks does not hold funds or pay out money.'}</p>
  <form method="post" action="/creator/tasks" class="stack">${csrfField(ctx)}
    <label for="type">Task type</label>
    <select id="type" name="type">${Object.entries(TASK_TYPES).map(([key, label]) => html`<option value="${key}"${raw(v.type === key ? ' selected' : '')}>${label}</option>`)}</select>
    <label for="title">Title</label>
    <input id="title" name="title" required maxlength="${LIMITS.title}" value="${v.title}">
    <label for="brief">Brief</label>
    <textarea id="brief" name="brief" required maxlength="${LIMITS.brief}" rows="3">${v.brief}</textarea>
    <label for="src">Source link (stream, VOD or clip)</label>
    <input id="src" name="source_url" type="url" required maxlength="${LIMITS.url}" value="${v.source_url}" placeholder="https://">
    <label for="crit">Acceptance criteria</label>
    <textarea id="crit" name="criteria" required maxlength="${LIMITS.criteria}" rows="3">${v.criteria}</textarea>
    <div class="cols">
      <div><label for="reward">Reward per approval (USD)</label><input id="reward" name="reward" required inputmode="decimal" value="${v.reward}"></div>
      <div><label for="slots">Slots</label><input id="slots" name="slots" type="number" min="1" max="${LIMITS.maxSlots}" required value="${v.slots}"></div>
      <div><label for="effort">Expected effort (minutes)</label><input id="effort" name="effort_minutes" type="number" min="1" max="${LIMITS.maxEffortMinutes}" required value="${v.effort_minutes}"></div>
      <div><label for="deadline">Deadline (ends 23:59 UTC)</label><input id="deadline" name="deadline" type="date" required value="${v.deadline}"></div>
    </div>
    <button class="primary">Post task</button>
  </form>
</section>
<section>
  <h2>Your tasks</h2>
  ${tasks.length ? html`<ul class="list">${tasks.map(task => html`<li class="row">
    <div><a href="/creator/tasks/${task.id}"><strong>${task.title}</strong></a> ${modeBadge(task.mode)} <span class="muted">${TASK_TYPES[task.type]}</span></div>
    <div class="muted small">${task.pending_count} awaiting review · ${task.slots_remaining}/${task.slots_total} slots left · ${taskAvailability(task, now)} · deadline ${date(task.deadline_at)}</div>
  </li>`)}</ul>` : html`<p class="empty">You have not posted any tasks yet.</p>`}
</section>`, { active: 'creator' });
}

export function reviewPage(ctx, task, submissions, now) {
  return layout(ctx, `Review: ${task.title}`, html`
<p><a href="/creator">← Back to creator workspace</a></p>
<h1>${task.title}</h1>
<p class="muted">${TASK_TYPES[task.type]} · ${amount(task.reward_cents, task.mode)} each · ${task.slots_remaining}/${task.slots_total} slots left · ${taskAvailability(task, now)}</p>
<p class="pre small">Criteria: ${task.acceptance_criteria}</p>
${submissions.length ? html`<ul class="list">${submissions.map(s => html`<li class="row">
  <div><strong>${s.viewer_name}</strong> <span class="muted small">${date(s.created_at)}</span></div>
  ${evidence(s)}
  <div class="state ${s.state}">${STATE_LABEL[s.state]}</div>
  ${s.review_reason ? html`<p class="reason">Your note: ${s.review_reason}</p>` : ''}
  ${s.state === 'submitted' ? html`<div class="review">
    <form method="post" action="/creator/submissions/${s.id}/approve" class="stack">${csrfField(ctx)}
      <label for="a-${s.id}">Approval note (optional)</label>
      <input id="a-${s.id}" name="reason" maxlength="${LIMITS.reason}">
      <button class="primary"${raw(task.slots_remaining > 0 ? '' : ' disabled')}>Approve · ${amount(task.reward_cents, task.mode)}</button>
    </form>
    <form method="post" action="/creator/submissions/${s.id}/reject" class="stack">${csrfField(ctx)}
      <label for="r-${s.id}">Rejection reason</label>
      <input id="r-${s.id}" name="reason" required maxlength="${LIMITS.reason}">
      <button class="danger">Reject</button>
    </form>
  </div>` : ''}
</li>`)}</ul>` : html`<p class="empty">No submissions yet.</p>`}`, { active: 'creator' });
}

export function earningsPage(ctx, data) {
  return layout(ctx, 'Earnings', html`
<h1>Earnings</h1>
<div class="tiles">
  <div class="tile"><span class="label">Approved ${ctx.mode === 'demo' ? 'demo credit' : 'ledger total'}</span><span class="value">${money(data.approvedCents)}</span></div>
  <div class="tile"><span class="label">Pending review (potential)</span><span class="value muted">${money(data.pendingCents)}</span></div>
</div>
<section class="panel">
  <h2>Withdraw</h2>
  <button disabled aria-describedby="nowithdraw">Withdraw unavailable</button>
  <p id="nowithdraw" class="muted small">Cash withdrawal is not available. No payout provider or real funding is connected, so these amounts ${ctx.mode === 'demo' ? 'are simulated and' : 'are ledger records only and'} cannot be withdrawn.</p>
</section>
<h2>Activity</h2>
${data.activity.length ? html`<table><thead><tr><th scope="col">Date</th><th scope="col">Task</th><th scope="col">Creator</th><th scope="col">Amount</th><th scope="col">Entry</th></tr></thead>
<tbody>${data.activity.map(e => html`<tr><td>${date(e.created_at)}</td><td>${e.title}</td><td>${e.creator_name}</td><td>${amount(e.amount_cents, e.mode)}</td><td class="mono small">${e.id.slice(0, 8)}</td></tr>`)}</tbody></table>`
  : html`<p class="empty">No approved work yet.</p>`}`, { active: 'earnings' });
}

export function settingsPage(ctx, config, user) {
  return layout(ctx, 'Settings', html`
<h1>Connection &amp; settings</h1>
<section class="panel">
  <h2>Current mode</h2>
  <p>${ctx.mode ? html`${modeBadge(ctx.mode)} ${ctx.mode === 'demo' ? `Demo workspace as the ${ctx.persona} persona.` : 'Live workspace.'}` : 'No mode chosen yet.'}</p>
  <div class="actions">
    ${ctx.mode !== 'demo' ? html`<form method="post" action="/demo/start">${csrfField(ctx)}<button>Use demo mode</button></form>` : ''}
    ${ctx.mode === 'demo' && user ? html`<form method="post" action="/mode">${csrfField(ctx)}<input type="hidden" name="mode" value="live"><button>Switch to live workspace</button></form>` : ''}
  </div>
</section>
<section class="panel">
  <h2>KICK account</h2>
  ${user ? html`<p>Logged in as <strong>${user.display_name}</strong>.</p>
    <form method="post" action="/logout">${csrfField(ctx)}<button>Log out</button></form>`
  : config.kickConfigured ? html`<p><a class="button" href="/auth/kick/login">Log in with KICK</a></p>`
  : html`<p>KICK login is <strong>not configured</strong>. Demo mode works without it.</p>`}
  <p class="muted small">Integration status: ${config.kickConfigured ? 'configured' : `missing ${config.missingKickVars.join(', ')}`}.</p>
  <details><summary>Setup guidance</summary>
    <ol>
      <li>Create an app in the KICK developer settings and request the <code>user:read</code> scope.</li>
      <li>Set its redirect URL to exactly <code>${config.kick.redirectUri}</code>.</li>
      <li>Set these server environment variables in your hosting provider's secret settings: <code>KICK_CLIENT_ID</code>, <code>KICK_CLIENT_SECRET</code>, <code>SESSION_SECRET</code> (random, 32+ characters) and <code>BASE_URL</code>.</li>
      <li>Restart the server. Never paste secret values into chat, tickets or source code.</li>
    </ol>
  </details>
</section>
${ctx.mode === 'demo' ? html`<section class="panel">
  <h2>Reset demo workspace</h2>
  <p class="muted small">Deletes all tasks, submissions and demo credit in <em>your</em> demo workspace and restores the starting tasks. Nothing else is affected.</p>
  <form method="post" action="/demo/reset" class="stack">${csrfField(ctx)}
    <label class="check"><input type="checkbox" name="confirm" value="yes" required> I understand this cannot be undone.</label>
    <button class="danger">Reset demo</button>
  </form>
</section>` : ''}`, { active: 'settings' });
}

export function errorPage(ctx, status, message) {
  return layout(ctx, 'Something went wrong', html`
<h1>${status === 404 ? 'Not found' : status === 403 ? 'Not allowed' : status === 429 ? 'Slow down' : 'That did not work'}</h1>
<p class="flash error" role="alert">${message}</p>
<p><a href="${ctx.mode ? '/tasks' : '/'}">Go back</a></p>`);
}
