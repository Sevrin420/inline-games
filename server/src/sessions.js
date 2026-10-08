// Sessions: random 256-bit token handed to the client; only its SHA-256 is
// stored. 30-day sliding expiry.
import crypto from 'node:crypto';

export const SESSION_DAYS = 30;
const DAY = 86_400_000;
const SLIDE_AFTER_MS = 3_600_000; // refresh expiry at most once an hour per session

export const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
export const newToken = () => crypto.randomBytes(32).toString('base64url');

export function createSessions(db, now = () => Date.now()) {
  const q = {
    insert: db.prepare('INSERT INTO sessions (token_hash, account_id, created_at, expires_at, kind) VALUES (?, ?, ?, ?, ?)'),
    get: db.prepare('SELECT token_hash, account_id, expires_at, revoked_at, kind FROM sessions WHERE token_hash = ?'),
    slide: db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?'),
    revoke: db.prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL'),
    revokeOthers: db.prepare('UPDATE sessions SET revoked_at = ? WHERE account_id = ? AND token_hash != ? AND revoked_at IS NULL'),
    revokeAll: db.prepare('UPDATE sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL'),
    purge: db.prepare('DELETE FROM sessions WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)'),
  };
  const iso = t => new Date(t).toISOString();

  return {
    create(accountId, kind = 'cookie') {
      const token = newToken();
      const t = now();
      q.insert.run(sha256(token), accountId, iso(t), iso(t + SESSION_DAYS * DAY), kind);
      return token;
    },
    // Returns { accountId, tokenHash, kind, slid } or null.
    lookup(token) {
      if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
      const h = sha256(token);
      const row = q.get.get(h);
      const t = now();
      if (!row || row.revoked_at || Date.parse(row.expires_at) <= t) return null;
      let slid = false;
      const fresh = t + SESSION_DAYS * DAY;
      if (fresh - Date.parse(row.expires_at) > SLIDE_AFTER_MS) { q.slide.run(iso(fresh), h); slid = true; }
      return { accountId: row.account_id, tokenHash: h, kind: row.kind, slid };
    },
    revoke(tokenHash) { q.revoke.run(iso(now()), tokenHash); },
    revokeOthers(accountId, keepHash) { q.revokeOthers.run(iso(now()), accountId, keepHash); },
    revokeAll(accountId) { q.revokeAll.run(iso(now()), accountId); },
    purge() { const t = iso(now() - DAY); q.purge.run(iso(now()), t); },
  };
}
