import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Worker } from 'node:worker_threads';
import './helpers.mjs';
import { LIVE_WORKSPACE_ID, openDatabase } from '../src/db.js';
import * as d from '../src/domain.js';

const NOW = Date.parse('2026-10-12T12:00:00Z');
const DAY = 86_400_000;

function addLiveUser(db, name) {
  const id = `kick-user-${name}`;
  db.prepare('INSERT INTO users (id, provider, provider_user_id, display_name, workspace_id, created_at) VALUES (?, \'kick\', ?, ?, NULL, ?)').run(id, name, name, NOW);
  return { userId: id, workspaceId: LIVE_WORKSPACE_ID, mode: 'live' };
}

const taskInput = (overrides = {}) => ({
  type: 'caption', title: 'Caption it', brief: 'Write a caption', source_url: 'https://example.com/clip', criteria: 'Short and accurate',
  effort_minutes: '5', reward: '2.50', slots: '2', deadline: '2026-10-20', ...overrides,
});
const caption = (text = 'Great caption') => ({ caption: text, rights: 'yes' });

test('input validation rejects bad money, dates, links and sizes', () => {
  assert.equal(d.parseCents('2.5'), 250);
  assert.equal(d.parseCents('$10'), 1000);
  for (const bad of ['0', '-1', '1.234', 'abc', '1e3', '2000']) assert.throws(() => d.parseCents(bad), d.DomainError, bad);
  assert.throws(() => d.parseDeadline('2026-10-11', NOW), /future/);
  assert.throws(() => d.parseDeadline('2026-02-30', NOW + 0), /valid|future/);
  assert.throws(() => d.parseDeadline('2027-12-01', NOW), /within/);
  assert.throws(() => d.parseUrl('javascript:alert(1)', 'Link'), /HTTP/);
  assert.throws(() => d.parseUrl('http://example.com/x', 'Clip', { httpsOnly: true }), /HTTPS/);
  assert.throws(() => d.parseUrl('https://user:pw@example.com', 'Link'), /credentials/);
  assert.throws(() => d.validateTaskInput(taskInput({ title: 'x'.repeat(500) }), NOW), /Title/);
  assert.throws(() => d.validateTaskInput(taskInput({ slots: '0' }), NOW), /Slots/);
  assert.throws(() => d.validateTaskInput(taskInput({ type: 'raid' }), NOW), /task type/);
  assert.throws(() => d.validateSubmission('caption', { caption: 'hi' }), /right/);
  assert.throws(() => d.validateSubmission('scouting', { moment_timestamp: '99:99', explanation: 'x', rights: 'yes' }), /Timestamp/);
  assert.throws(() => d.validateSubmission('clip', { asset_url: 'http://example.com', rights: 'yes' }), /HTTPS/);
});

test('submit, approve and earn exactly once; repeated approval returns the same entry', () => {
  const db = openDatabase();
  const creator = addLiveUser(db, 'creator');
  const viewer = addLiveUser(db, 'viewer');
  const taskId = d.createTask(db, creator, taskInput(), NOW);
  const sub = d.submitWork(db, viewer, taskId, caption(), NOW);
  assert.deepEqual(d.earnings(db, viewer).pendingCents, 250);

  const first = d.approveSubmission(db, creator, sub, 'Nice', NOW + 1);
  const again = d.approveSubmission(db, creator, sub, 'Nice', NOW + 2);
  assert.equal(first.repeated, false);
  assert.equal(again.repeated, true);
  assert.equal(again.entry.id, first.entry.id);
  const e = d.earnings(db, viewer);
  assert.equal(e.approvedCents, 250);
  assert.equal(e.pendingCents, 0);
  assert.equal(e.activity.length, 1);
  assert.equal(d.getTask(db, LIVE_WORKSPACE_ID, taskId).slots_remaining, 1);
  assert.throws(() => d.rejectSubmission(db, creator, sub, 'changed my mind', NOW), /already approved/);
  assert.throws(() => db.prepare('UPDATE ledger SET amount_cents = 1').run(), /immutable/);
});

test('rejection earns nothing and needs a reason', () => {
  const db = openDatabase();
  const creator = addLiveUser(db, 'creator');
  const viewer = addLiveUser(db, 'viewer');
  const sub = d.submitWork(db, viewer, d.createTask(db, creator, taskInput(), NOW), caption(), NOW);
  assert.throws(() => d.rejectSubmission(db, creator, sub, '  ', NOW), /reason is required/);
  d.rejectSubmission(db, creator, sub, 'Off brief', NOW);
  assert.throws(() => d.approveSubmission(db, creator, sub, '', NOW), /already rejected/);
  assert.equal(d.earnings(db, viewer).approvedCents, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ledger').get().n, 0);
});

test('slots cannot be overrun and the task closes when exhausted', () => {
  const db = openDatabase();
  const creator = addLiveUser(db, 'creator');
  const taskId = d.createTask(db, creator, taskInput({ slots: '1' }), NOW);
  const subs = ['a', 'b'].map(n => d.submitWork(db, addLiveUser(db, n), taskId, caption(), NOW));
  d.approveSubmission(db, creator, subs[0], '', NOW);
  assert.throws(() => d.approveSubmission(db, creator, subs[1], '', NOW), /No slots remain/);
  const task = d.getTask(db, LIVE_WORKSPACE_ID, taskId);
  assert.equal(task.status, 'closed');
  assert.equal(task.slots_remaining, 0);
  assert.throws(() => d.submitWork(db, addLiveUser(db, 'late'), taskId, caption(), NOW), /closed/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ledger').get().n, 1);
});

test('authorization: no self-submission, no foreign review, no duplicates, no expired tasks', () => {
  const db = openDatabase();
  const creator = addLiveUser(db, 'creator');
  const other = addLiveUser(db, 'other');
  const viewer = addLiveUser(db, 'viewer');
  const taskId = d.createTask(db, creator, taskInput(), NOW);
  assert.throws(() => d.submitWork(db, creator, taskId, caption(), NOW), e => e.status === 403);
  const sub = d.submitWork(db, viewer, taskId, caption(), NOW);
  assert.throws(() => d.submitWork(db, viewer, taskId, caption('again'), NOW), /already submitted/);
  assert.throws(() => d.approveSubmission(db, other, sub, '', NOW), e => e.status === 403);
  assert.throws(() => d.rejectSubmission(db, other, sub, 'no', NOW), e => e.status === 403);
  assert.throws(() => d.listTaskSubmissions(db, other, taskId), e => e.status === 403);
  assert.throws(() => d.submitWork(db, other, taskId, caption(), Date.parse('2026-10-21T00:00:00Z')), /deadline/);
});

test('demo workspaces are isolated and reset only touches the owner workspace', () => {
  const db = openDatabase();
  const wsA = d.createDemoWorkspace(db, 'session-a', NOW);
  const wsB = d.createDemoWorkspace(db, 'session-b', NOW);
  const viewerA = { userId: d.demoUserId(wsA, 'viewer'), workspaceId: wsA, mode: 'demo' };
  const creatorB = { userId: d.demoUserId(wsB, 'creator'), workspaceId: wsB, mode: 'demo' };
  const taskB = d.listCreatorTasks(db, creatorB)[0];
  assert.throws(() => d.getTask(db, wsA, taskB.id), e => e.status === 404);
  assert.throws(() => d.submitWork(db, viewerA, taskB.id, caption(), NOW), e => e.status === 404);

  const taskA = d.listTasks(db, wsA, { type: 'caption' }).find(t => t.creator_id !== viewerA.userId);
  d.submitWork(db, viewerA, taskA.id, caption(), NOW);
  const countB = db.prepare('SELECT COUNT(*) AS n FROM submissions s JOIN tasks t ON t.id = s.task_id WHERE t.workspace_id = ?');
  const beforeB = countB.get(wsB).n;
  assert.throws(() => d.resetDemoWorkspace(db, wsA, 'session-b', NOW), e => e.status === 403);
  assert.throws(() => d.resetDemoWorkspace(db, LIVE_WORKSPACE_ID, 'session-a', NOW), e => e.status === 403);
  d.resetDemoWorkspace(db, wsA, 'session-a', NOW);
  assert.equal(d.listMySubmissions(db, viewerA).length, 0);
  assert.equal(d.listTasks(db, wsA).length, 4);
  assert.equal(countB.get(wsB).n, beforeB);
  assert.equal(d.listTasks(db, wsA)[0].mode, 'demo');
});

test('concurrent approvals from separate connections cannot exceed slots or duplicate earnings', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vw-'));
  const file = join(dir, 'race.db');
  try {
    const db = openDatabase(file);
    const creator = addLiveUser(db, 'creator');
    const taskId = d.createTask(db, creator, taskInput({ slots: '2' }), NOW);
    const subs = Array.from({ length: 6 }, (_, i) => d.submitWork(db, addLiveUser(db, `v${i}`), taskId, caption(), NOW));
    // Six workers approve six different submissions, plus four workers approve the first one again.
    const jobs = [...subs, subs[0], subs[0], subs[0], subs[0]];
    const workerSource = `
      const { workerData, parentPort } = require('node:worker_threads');
      (async () => {
        const { openDatabase } = await import(workerData.dbModule);
        const d = await import(workerData.domainModule);
        const db = openDatabase(workerData.file);
        const flag = new Int32Array(workerData.gate);
        Atomics.wait(flag, 0, 0);
        try { const r = d.approveSubmission(db, workerData.actor, workerData.sub, '', workerData.now); parentPort.postMessage({ ok: true, repeated: r.repeated }); }
        catch (e) { parentPort.postMessage({ ok: false, message: e.message }); }
        db.close();
      })();`;
    const gate = new SharedArrayBuffer(4);
    const results = await new Promise((resolve, reject) => {
      const out = [];
      const workers = jobs.map(sub => new Worker(workerSource, {
        eval: true,
        execArgv: ['--disable-warning=ExperimentalWarning'],
        workerData: {
          file, sub, actor: creator, now: NOW, gate,
          dbModule: new URL('../src/db.js', import.meta.url).href,
          domainModule: new URL('../src/domain.js', import.meta.url).href,
        },
      }));
      for (const w of workers) {
        w.on('message', m => { out.push(m); if (out.length === jobs.length) resolve(out); });
        w.on('error', reject);
      }
      setTimeout(() => { Atomics.store(new Int32Array(gate), 0, 1); Atomics.notify(new Int32Array(gate), 0); }, 200);
    });
    const ledger = db.prepare('SELECT COUNT(*) AS n, COUNT(DISTINCT submission_id) AS distinct_n FROM ledger').get();
    assert.equal(ledger.n, 2, JSON.stringify(results));
    assert.equal(ledger.distinct_n, 2);
    assert.equal(d.getTask(db, LIVE_WORKSPACE_ID, taskId).slots_remaining, 0);
    assert.equal(results.filter(r => r.ok && !r.repeated).length, 2);
    assert.ok(results.filter(r => !r.ok).every(r => /No slots remain/.test(r.message)), JSON.stringify(results));
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
