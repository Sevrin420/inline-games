// Sign-In with Ethereum (EIP-4361). Nonces are single-use, ~5 minutes, and
// bound to a purpose ('login' | 'link' | 'reset').
import crypto from 'node:crypto';
import { createSiweMessage, parseSiweMessage } from 'viem/siwe';
import { getAddress, isAddress, recoverMessageAddress } from 'viem';

export const PURPOSES = ['login', 'link', 'reset'];
const NONCE_MS = 5 * 60_000;
const STATEMENTS = {
  login: 'Sign in to membersonly.cc.',
  link: 'Link this wallet to your membersonly.cc account.',
  reset: 'Reset the password of the membersonly.cc account linked to this wallet.',
};

export class SiweError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

export function createSiwe(db, cfg, now = () => Date.now()) {
  const q = {
    insert: db.prepare('INSERT INTO siwe_nonces (nonce, purpose, account_id, expires_at) VALUES (?, ?, ?, ?)'),
    get: db.prepare('SELECT nonce, purpose, account_id, expires_at, used FROM siwe_nonces WHERE nonce = ?'),
    consume: db.prepare('UPDATE siwe_nonces SET used = 1 WHERE nonce = ? AND used = 0 AND purpose = ? AND expires_at > ?'),
    purge: db.prepare('DELETE FROM siwe_nonces WHERE expires_at < ?'),
  };

  return {
    // Issue a nonce. If an address is supplied, also return a ready-to-sign
    // message built with the server's domain, chain and URI (a convenience:
    // the server still verifies every field on the way back in).
    issue(purpose, { accountId = null, address = null } = {}) {
      if (!PURPOSES.includes(purpose)) throw new SiweError('bad_purpose', 'purpose must be login, link or reset');
      const nonce = crypto.randomBytes(16).toString('hex');
      const t = now();
      const expiresAt = new Date(t + NONCE_MS);
      q.insert.run(nonce, purpose, accountId, expiresAt.toISOString());
      const out = { nonce, purpose, expiresAt: expiresAt.toISOString(), domain: cfg.siweDomain, chainId: cfg.siweChainId, uri: cfg.publicOrigin, statement: STATEMENTS[purpose] };
      if (address) {
        if (!isAddress(address, { strict: false })) throw new SiweError('bad_address', 'Not an Ethereum address');
        out.message = createSiweMessage({
          domain: cfg.siweDomain, address: getAddress(address), statement: STATEMENTS[purpose],
          uri: cfg.publicOrigin, version: '1', chainId: cfg.siweChainId, nonce,
          issuedAt: new Date(t), expirationTime: expiresAt,
        });
      }
      return out;
    },

    // Verify a signed message for an endpoint's purpose. Consumes the nonce.
    // Returns { address, accountId } (accountId = the nonce's bound account).
    async verify(message, signature, purpose) {
      if (typeof message !== 'string' || message.length > 4000 || typeof signature !== 'string' || !/^0x[0-9a-fA-F]{130,}$/.test(signature)) {
        throw new SiweError('bad_request', 'message and signature are required');
      }
      let m;
      try { m = parseSiweMessage(message); } catch { m = null; }
      if (!m || !m.address || !m.nonce || !m.domain) throw new SiweError('bad_message', 'Not a valid sign-in message');
      if (m.domain !== cfg.siweDomain) throw new SiweError('domain_mismatch', 'Message is for a different site');
      if (m.version !== '1') throw new SiweError('bad_message', 'Unsupported message version');
      if (Number(m.chainId) !== cfg.siweChainId) throw new SiweError('chain_mismatch', 'Message is for a different chain');
      let uriOrigin = null;
      try { uriOrigin = new URL(m.uri).origin; } catch { /* handled below */ }
      if (!uriOrigin || !cfg.allowedOrigins.includes(uriOrigin)) throw new SiweError('uri_mismatch', 'Message URI is for a different site');
      const t = now();
      if (!m.expirationTime || m.expirationTime.getTime() <= t) throw new SiweError('expired', 'Sign-in message expired');
      if (m.notBefore && m.notBefore.getTime() > t) throw new SiweError('not_yet_valid', 'Sign-in message not valid yet');
      if (m.issuedAt && m.issuedAt.getTime() > t + 60_000) throw new SiweError('bad_message', 'Issued in the future');

      let recovered;
      try { recovered = await recoverMessageAddress({ message, signature }); } catch { recovered = null; }
      let claimed;
      try { claimed = getAddress(m.address); } catch { claimed = null; }
      if (!recovered || !claimed || recovered !== claimed) throw new SiweError('bad_signature', 'Signature does not match the address');

      const row = q.get.get(m.nonce);
      if (!row) throw new SiweError('bad_nonce', 'Unknown nonce');
      if (row.purpose !== purpose) throw new SiweError('wrong_purpose', 'This message was issued for a different action');
      // Atomic single use: only one request can flip used 0 -> 1.
      const r = q.consume.run(m.nonce, purpose, new Date(t).toISOString());
      if (r.changes !== 1) throw new SiweError(row.used ? 'nonce_used' : 'expired', row.used ? 'This message was already used' : 'Sign-in message expired');
      return { address: claimed, accountId: row.account_id };
    },

    purge() { q.purge.run(new Date(now() - 3_600_000).toISOString()); },
  };
}
