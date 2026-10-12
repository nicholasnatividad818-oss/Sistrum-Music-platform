import { randomUUID } from 'node:crypto';
import { LIVE_WORKSPACE_ID, transaction } from './db.js';

export class DomainError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const TASK_TYPES = {
  scouting: 'Moment scouting',
  clip: 'Clip link',
  caption: 'Caption',
};

export const LIMITS = {
  title: 120,
  brief: 600,
  criteria: 1000,
  url: 500,
  explanation: 1000,
  caption: 500,
  reason: 300,
  maxRewardCents: 100_000,
  maxSlots: 50,
  maxEffortMinutes: 600,
  maxDeadlineDays: 90,
};

const DAY = 86_400_000;

function text(value, field, max, { required = true } = {}) {
  const clean = String(value ?? '').replace(/\r\n/g, '\n').trim();
  if (required && !clean) throw new DomainError(400, `${field} is required.`);
  if (clean.length > max) throw new DomainError(400, `${field} must be ${max} characters or fewer.`);
  return clean;
}

export function parseUrl(value, field, { httpsOnly = false } = {}) {
  const raw = text(value, field, LIMITS.url);
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new DomainError(400, `${field} must be a full link starting with https://.`);
  }
  const allowed = httpsOnly ? ['https:'] : ['https:', 'http:'];
  if (!allowed.includes(url.protocol)) throw new DomainError(400, `${field} must use ${httpsOnly ? 'HTTPS' : 'HTTP or HTTPS'}.`);
  if (url.username || url.password) throw new DomainError(400, `${field} must not contain credentials.`);
  return url.href;
}

/** Parses a dollar amount like "5" or "5.25" into integer cents. */
export function parseCents(value) {
  const raw = String(value ?? '').trim().replace(/^\$/, '');
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(raw)) throw new DomainError(400, 'Reward must be a dollar amount like 5 or 5.25.');
  const [whole, fraction = ''] = raw.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (cents <= 0) throw new DomainError(400, 'Reward must be greater than zero.');
  if (cents > LIMITS.maxRewardCents) throw new DomainError(400, `Reward must be at most $${LIMITS.maxRewardCents / 100}.`);
  return cents;
}

function integer(value, field, min, max) {
  const raw = String(value ?? '').trim();
  if (!/^\d{1,4}$/.test(raw)) throw new DomainError(400, `${field} must be a whole number.`);
  const n = Number(raw);
  if (n < min || n > max) throw new DomainError(400, `${field} must be between ${min} and ${max}.`);
  return n;
}

/** Deadline is a calendar date; the task closes at 23:59:59 UTC that day. */
export function parseDeadline(value, now) {
  const raw = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new DomainError(400, 'Deadline must be a date (YYYY-MM-DD).');
  const at = Date.parse(`${raw}T23:59:59.000Z`);
  if (Number.isNaN(at) || new Date(at).toISOString().slice(0, 10) !== raw) throw new DomainError(400, 'Deadline is not a valid date.');
  if (at <= now) throw new DomainError(400, 'Deadline must be in the future.');
  if (at > now + LIMITS.maxDeadlineDays * DAY) throw new DomainError(400, `Deadline must be within ${LIMITS.maxDeadlineDays} days.`);
  return at;
}

export function validateTaskInput(input, now) {
  const type = String(input.type ?? '');
  if (!Object.hasOwn(TASK_TYPES, type)) throw new DomainError(400, 'Choose a task type.');
  const slots = integer(input.slots, 'Slots', 1, LIMITS.maxSlots);
  return {
    type,
    title: text(input.title, 'Title', LIMITS.title),
    brief: text(input.brief, 'Brief', LIMITS.brief),
    sourceUrl: parseUrl(input.source_url, 'Source link'),
    criteria: text(input.criteria, 'Acceptance criteria', LIMITS.criteria),
    effortMinutes: integer(input.effort_minutes, 'Expected effort', 1, LIMITS.maxEffortMinutes),
    rewardCents: parseCents(input.reward),
    slots,
    deadlineAt: parseDeadline(input.deadline, now),
  };
}

export function validateSubmission(type, input) {
  if (input.rights !== 'on' && input.rights !== 'yes') {
    throw new DomainError(400, 'Confirm that you have the right to submit this work.');
  }
  if (type === 'scouting') {
    const ts = text(input.moment_timestamp, 'Timestamp', 8);
    if (!/^(\d{1,2}:)?[0-5]?\d:[0-5]\d$/.test(ts)) throw new DomainError(400, 'Timestamp must look like 1:23:45 or 12:34.');
    return { momentTimestamp: ts, explanation: text(input.explanation, 'Explanation', LIMITS.explanation) };
  }
  if (type === 'clip') {
    return {
      assetUrl: parseUrl(input.asset_url, 'Clip link', { httpsOnly: true }),
      explanation: text(input.explanation, 'Note', LIMITS.explanation, { required: false }) || null,
    };
  }
  return { caption: text(input.caption, 'Caption', LIMITS.caption) };
}

/** A task accepts work only while open, before its deadline, and with slots left. */
export function taskAvailability(task, now) {
  if (task.status !== 'open' || task.slots_remaining <= 0) return 'closed';
  if (task.deadline_at <= now) return 'expired';
  return 'open';
}

const TASK_COLUMNS = `t.*, u.display_name AS creator_name, w.mode AS mode,
  (SELECT COUNT(*) FROM submissions s WHERE s.task_id = t.id AND s.state = 'submitted') AS pending_count`;

export function listTasks(db, workspaceId, { type } = {}) {
  const filter = type && Object.hasOwn(TASK_TYPES, type) ? type : null;
  return db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks t JOIN users u ON u.id = t.creator_id JOIN workspaces w ON w.id = t.workspace_id
    WHERE t.workspace_id = ? AND (? IS NULL OR t.type = ?) ORDER BY t.deadline_at ASC, t.created_at DESC LIMIT 200`)
    .all(workspaceId, filter, filter);
}

export function getTask(db, workspaceId, taskId) {
  const task = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks t JOIN users u ON u.id = t.creator_id JOIN workspaces w ON w.id = t.workspace_id
    WHERE t.id = ? AND t.workspace_id = ?`).get(String(taskId), workspaceId);
  if (!task) throw new DomainError(404, 'Task not found.');
  return task;
}

export function createTask(db, actor, input, now = Date.now()) {
  const v = validateTaskInput(input, now);
  const id = randomUUID();
  db.prepare(`INSERT INTO tasks (id, workspace_id, creator_id, type, title, brief, source_url, acceptance_criteria, effort_minutes,
    reward_cents, slots_total, slots_remaining, deadline_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`)
    .run(id, actor.workspaceId, actor.userId, v.type, v.title, v.brief, v.sourceUrl, v.criteria, v.effortMinutes,
      v.rewardCents, v.slots, v.slots, v.deadlineAt, now);
  return id;
}

export function submitWork(db, actor, taskId, input, now = Date.now()) {
  return transaction(db, () => {
    const task = getTask(db, actor.workspaceId, taskId);
    if (task.creator_id === actor.userId) throw new DomainError(403, 'You cannot submit work to your own task.');
    const availability = taskAvailability(task, now);
    if (availability !== 'open') throw new DomainError(409, availability === 'expired' ? 'This task has passed its deadline.' : 'This task is closed.');
    const v = validateSubmission(task.type, input);
    const existing = db.prepare('SELECT id FROM submissions WHERE task_id = ? AND viewer_id = ?').get(task.id, actor.userId);
    if (existing) throw new DomainError(409, 'You have already submitted work for this task.');
    const id = randomUUID();
    db.prepare(`INSERT INTO submissions (id, task_id, viewer_id, moment_timestamp, explanation, asset_url, caption, rights_confirmed_at, state, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)`)
      .run(id, task.id, actor.userId, v.momentTimestamp ?? null, v.explanation ?? null, v.assetUrl ?? null, v.caption ?? null, now, now);
    return id;
  });
}

export function listMySubmissions(db, actor) {
  return db.prepare(`SELECT s.*, t.title, t.type, t.reward_cents, u.display_name AS creator_name, l.amount_cents AS earned_cents
    FROM submissions s JOIN tasks t ON t.id = s.task_id JOIN users u ON u.id = t.creator_id
    LEFT JOIN ledger l ON l.submission_id = s.id
    WHERE s.viewer_id = ? AND t.workspace_id = ? ORDER BY s.created_at DESC LIMIT 200`).all(actor.userId, actor.workspaceId);
}

export function listCreatorTasks(db, actor) {
  return db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks t JOIN users u ON u.id = t.creator_id JOIN workspaces w ON w.id = t.workspace_id
    WHERE t.workspace_id = ? AND t.creator_id = ? ORDER BY t.created_at DESC LIMIT 200`).all(actor.workspaceId, actor.userId);
}

export function getOwnedTask(db, actor, taskId) {
  const task = getTask(db, actor.workspaceId, taskId);
  if (task.creator_id !== actor.userId) throw new DomainError(403, 'Only the task creator can review its submissions.');
  return task;
}

export function listTaskSubmissions(db, actor, taskId) {
  const task = getOwnedTask(db, actor, taskId);
  const submissions = db.prepare(`SELECT s.*, u.display_name AS viewer_name FROM submissions s JOIN users u ON u.id = s.viewer_id
    WHERE s.task_id = ? ORDER BY s.state = 'submitted' DESC, s.created_at ASC`).all(task.id);
  return { task, submissions };
}

function loadReviewable(db, actor, submissionId) {
  const row = db.prepare(`SELECT s.*, t.creator_id, t.workspace_id, t.reward_cents, t.slots_remaining, t.status AS task_status, w.mode
    FROM submissions s JOIN tasks t ON t.id = s.task_id JOIN workspaces w ON w.id = t.workspace_id
    WHERE s.id = ? AND t.workspace_id = ?`).get(String(submissionId), actor.workspaceId);
  if (!row) throw new DomainError(404, 'Submission not found.');
  if (row.creator_id !== actor.userId) throw new DomainError(403, 'Only the task creator can review this submission.');
  if (row.viewer_id === actor.userId) throw new DomainError(403, 'You cannot approve your own work.');
  return row;
}

/**
 * Approves a submission atomically: one slot is consumed and exactly one immutable ledger
 * entry is written. Repeating the request returns the existing entry.
 */
export function approveSubmission(db, actor, submissionId, reason, now = Date.now()) {
  const cleanReason = text(reason, 'Review note', LIMITS.reason, { required: false }) || null;
  return transaction(db, () => {
    const row = loadReviewable(db, actor, submissionId);
    if (row.state === 'approved') {
      return { entry: db.prepare('SELECT * FROM ledger WHERE submission_id = ?').get(row.id), repeated: true };
    }
    if (row.state !== 'submitted') throw new DomainError(409, 'This submission was already rejected.');
    const slot = db.prepare(`UPDATE tasks SET slots_remaining = slots_remaining - 1,
      status = CASE WHEN slots_remaining - 1 = 0 THEN 'closed' ELSE status END
      WHERE id = ? AND slots_remaining > 0`).run(row.task_id);
    if (slot.changes !== 1) throw new DomainError(409, 'No slots remain on this task. Reject the submission or leave it unreviewed.');
    const updated = db.prepare(`UPDATE submissions SET state = 'approved', review_reason = ?, reviewer_id = ?, reviewed_at = ?
      WHERE id = ? AND state = 'submitted'`).run(cleanReason, actor.userId, now, row.id);
    if (updated.changes !== 1) throw new DomainError(409, 'This submission changed while you were reviewing it.');
    const entry = { id: randomUUID(), submission_id: row.id, viewer_id: row.viewer_id, workspace_id: row.workspace_id, amount_cents: row.reward_cents, mode: row.mode, created_at: now };
    db.prepare('INSERT INTO ledger (id, submission_id, viewer_id, workspace_id, amount_cents, mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(entry.id, entry.submission_id, entry.viewer_id, entry.workspace_id, entry.amount_cents, entry.mode, entry.created_at);
    return { entry, repeated: false };
  });
}

export function rejectSubmission(db, actor, submissionId, reason, now = Date.now()) {
  const cleanReason = text(reason, 'Rejection reason', LIMITS.reason);
  return transaction(db, () => {
    const row = loadReviewable(db, actor, submissionId);
    if (row.state === 'rejected') return { repeated: true };
    if (row.state !== 'submitted') throw new DomainError(409, 'This submission was already approved.');
    db.prepare(`UPDATE submissions SET state = 'rejected', review_reason = ?, reviewer_id = ?, reviewed_at = ? WHERE id = ? AND state = 'submitted'`)
      .run(cleanReason, actor.userId, now, row.id);
    return { repeated: false };
  });
}

export function earnings(db, actor) {
  const approved = db.prepare('SELECT COALESCE(SUM(amount_cents), 0) AS cents FROM ledger WHERE viewer_id = ? AND workspace_id = ?')
    .get(actor.userId, actor.workspaceId).cents;
  const pending = db.prepare(`SELECT COALESCE(SUM(t.reward_cents), 0) AS cents FROM submissions s JOIN tasks t ON t.id = s.task_id
    WHERE s.viewer_id = ? AND t.workspace_id = ? AND s.state = 'submitted'`).get(actor.userId, actor.workspaceId).cents;
  const activity = db.prepare(`SELECT l.*, t.title, u.display_name AS creator_name FROM ledger l
    JOIN submissions s ON s.id = l.submission_id JOIN tasks t ON t.id = s.task_id JOIN users u ON u.id = t.creator_id
    WHERE l.viewer_id = ? AND l.workspace_id = ? ORDER BY l.created_at DESC LIMIT 200`).all(actor.userId, actor.workspaceId);
  return { approvedCents: approved, pendingCents: pending, activity };
}

// ---------- Demo workspaces ----------

const DEMO_PEOPLE = {
  viewer: 'Demo Viewer (you)',
  creator: 'Nova Beats, demo creator (you)',
  rio: 'Rio (demo viewer)',
};

export function demoUserId(workspaceId, key) {
  return `demo:${workspaceId}:${key}`;
}

function seedDemo(db, workspaceId, now) {
  const insertUser = db.prepare('INSERT INTO users (id, provider, provider_user_id, display_name, workspace_id, created_at) VALUES (?, \'demo\', ?, ?, ?, ?)');
  for (const [key, name] of Object.entries(DEMO_PEOPLE)) insertUser.run(demoUserId(workspaceId, key), `${workspaceId}:${key}`, name, workspaceId, now);
  const insertTask = db.prepare(`INSERT INTO tasks (id, workspace_id, creator_id, type, title, brief, source_url, acceptance_criteria, effort_minutes,
    reward_cents, slots_total, slots_remaining, deadline_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`);
  const tasks = [
    ['creator', 'scouting', 'Find the best beat-drop reaction', 'Scan last night\'s 3-hour producer stream and point to the single strongest crowd-reaction moment.',
      'https://example.com/demo/vod/nova-producer-night', 'Give an exact timestamp and one or two sentences on why it would make a great short.', 20, 300, 3, 7],
    ['creator', 'clip', 'Clip the sample-flip breakdown', 'Make a 30–60 second vertical clip of the sample flip explanation.',
      'https://example.com/demo/vod/nova-sample-flip', 'HTTPS link to your clip. Must start on the first bar and include the reveal. Original audio only.', 45, 1200, 2, 10],
    ['creator', 'caption', 'Write a caption for the studio tour short', 'One punchy caption for a short showing the new studio setup.',
      'https://example.com/demo/clips/nova-studio-tour', 'Under 150 characters, no hashtag spam (max 2), no misleading claims.', 5, 150, 5, 5],
    ['creator', 'caption', 'Caption my first collab teaser', 'Short caption for the collab teaser clip.',
      'https://example.com/demo/clips/your-collab-teaser', 'Under 120 characters and mentions the collab.', 5, 200, 2, 6],
  ];
  const ids = [];
  for (const [owner, type, title, brief, url, criteria, effort, reward, slots, days] of tasks) {
    const id = randomUUID();
    ids.push(id);
    insertTask.run(id, workspaceId, demoUserId(workspaceId, owner), type, title, brief, url, criteria, effort, reward, slots, slots, now + days * DAY, now);
  }
  db.prepare(`INSERT INTO submissions (id, task_id, viewer_id, caption, rights_confirmed_at, state, created_at) VALUES (?, ?, ?, ?, ?, 'submitted', ?)`)
    .run(randomUUID(), ids[3], demoUserId(workspaceId, 'rio'), 'Two worlds, one track — the collab drops Friday.', now, now);
}

export function createDemoWorkspace(db, sessionHash, now = Date.now()) {
  const id = randomUUID();
  transaction(db, () => {
    db.prepare('INSERT INTO workspaces (id, mode, owner_session_hash, created_at) VALUES (?, \'demo\', ?, ?)').run(id, sessionHash, now);
    seedDemo(db, id, now);
  });
  return id;
}

/** Clears and reseeds one demo workspace. Live data and other demo workspaces are untouched. */
export function resetDemoWorkspace(db, workspaceId, sessionHash, now = Date.now()) {
  if (workspaceId === LIVE_WORKSPACE_ID) throw new DomainError(403, 'Only demo workspaces can be reset.');
  transaction(db, () => {
    const ws = db.prepare('SELECT * FROM workspaces WHERE id = ? AND mode = \'demo\' AND owner_session_hash = ?').get(workspaceId, sessionHash);
    if (!ws) throw new DomainError(403, 'You can only reset your own demo workspace.');
    db.prepare('DELETE FROM ledger WHERE workspace_id = ?').run(workspaceId);
    db.prepare('DELETE FROM submissions WHERE task_id IN (SELECT id FROM tasks WHERE workspace_id = ?)').run(workspaceId);
    db.prepare('DELETE FROM tasks WHERE workspace_id = ?').run(workspaceId);
    db.prepare('DELETE FROM users WHERE workspace_id = ?').run(workspaceId);
    seedDemo(db, workspaceId, now);
  });
}
