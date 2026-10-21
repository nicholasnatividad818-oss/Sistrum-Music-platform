import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('demo', 'live')),
  owner_session_hash TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('kick', 'demo')),
  provider_user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  UNIQUE (provider, provider_user_id)
);
CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  mode TEXT CHECK (mode IN ('demo', 'live')),
  demo_workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  demo_persona TEXT NOT NULL DEFAULT 'viewer' CHECK (demo_persona IN ('viewer', 'creator')),
  csrf_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash TEXT PRIMARY KEY,
  session_hash TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('scouting', 'clip', 'caption')),
  title TEXT NOT NULL,
  brief TEXT NOT NULL,
  source_url TEXT NOT NULL,
  acceptance_criteria TEXT NOT NULL,
  effort_minutes INTEGER NOT NULL CHECK (effort_minutes BETWEEN 1 AND 600),
  reward_cents INTEGER NOT NULL CHECK (reward_cents > 0),
  slots_total INTEGER NOT NULL CHECK (slots_total BETWEEN 1 AND 50),
  slots_remaining INTEGER NOT NULL CHECK (slots_remaining >= 0 AND slots_remaining <= slots_total),
  deadline_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tasks_workspace ON tasks (workspace_id, created_at);
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  viewer_id TEXT NOT NULL REFERENCES users(id),
  moment_timestamp TEXT,
  explanation TEXT,
  asset_url TEXT,
  caption TEXT,
  rights_confirmed_at INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('submitted', 'approved', 'rejected')),
  review_reason TEXT,
  reviewer_id TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  UNIQUE (task_id, viewer_id)
);
CREATE TABLE IF NOT EXISTS ledger (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
  viewer_id TEXT NOT NULL REFERENCES users(id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  mode TEXT NOT NULL CHECK (mode IN ('demo', 'live')),
  created_at INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS ledger_immutable_update BEFORE UPDATE ON ledger
BEGIN SELECT RAISE(ABORT, 'ledger entries are immutable'); END;
`;

export const LIVE_WORKSPACE_ID = 'live';

export function openDatabase(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  db.prepare('INSERT OR IGNORE INTO workspaces (id, mode, owner_session_hash, created_at) VALUES (?, ?, NULL, ?)')
    .run(LIVE_WORKSPACE_ID, 'live', Date.now());
  return db;
}

/** Runs fn inside a write-locked transaction (BEGIN IMMEDIATE), committing on success. */
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
