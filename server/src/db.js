// SQLite via Node's built-in node:sqlite (Node >= 22.13), so there is no
// native module to rebuild when the server's Node version changes.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// Tables follow docs/Auth_and_Accounts.md. Additions beyond the doc are marked.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wallets (
  address    TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL UNIQUE REFERENCES accounts(id),
  linked_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  kind       TEXT NOT NULL DEFAULT 'cookie'   -- addition: 'cookie' | 'bearer' (embedded iframe)
);
CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id);

CREATE TABLE IF NOT EXISTS siwe_nonces (
  nonce      TEXT PRIMARY KEY,
  purpose    TEXT NOT NULL,
  account_id INTEGER,
  expires_at TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS anon_players (
  anon_id               TEXT PRIMARY KEY,
  claimed_by_account_id INTEGER REFERENCES accounts(id),
  created_at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS play_events (
  id           INTEGER PRIMARY KEY,
  game_id      TEXT NOT NULL,
  player_key   TEXT NOT NULL,
  account_id   INTEGER REFERENCES accounts(id),
  started_at   TEXT NOT NULL,
  ended_at     TEXT,
  outcome      TEXT,
  score        INTEGER,
  access_level TEXT NOT NULL,
  meta         TEXT
);
CREATE INDEX IF NOT EXISTS play_events_account ON play_events(account_id, started_at);
CREATE INDEX IF NOT EXISTS play_events_player  ON play_events(player_key, started_at);
`;

export function openDb(dbPath) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  return db;
}

// Run fn inside a transaction (node:sqlite has no helper for this).
export function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* already rolled back */ }
    throw e;
  }
}
