// Leaderboard display names: 1-16 characters of letters, numbers, spaces and
// _ - . only, trimmed, inner whitespace collapsed, plus a basic blocklist.
// The blocklist is deliberately short and blunt: it stops the obvious stuff,
// and the admin delete (ADMIN_TOKEN) handles whatever slips through. It has
// the usual false positives (e.g. "Scunthorpe"); players just pick another name.

export const NAME_MAX = 16;
const NAME_RE = /^[A-Za-z0-9 _.\-]+$/;

// Matched anywhere inside the name (after normalising, see below).
const ANYWHERE = [
  'fuck', 'fuk', 'fck', 'shit', 'cunt', 'nigg', 'faggot', 'fag', 'kike', 'retard', 'whore', 'slut', 'bitch',
  'pussy', 'penis', 'vagina', 'porn', 'nazi', 'hitler', 'kkk', 'tranny', 'dyke', 'wank', 'twat', 'bastard',
  'asshole', 'jizz', 'dildo', 'blowjob', 'handjob', 'molest', 'cocksuck', 'motherf', 'beaner', 'wetback',
  'raghead', 'towelhead', 'semen', 'boner', 'clit', 'heil',
];
// Only matched as a whole word (or the whole name), because as substrings they
// hit innocent words (grape, cucumber, class, title, torpedo, ...).
const WHOLE_WORD = new Set([
  'rape', 'rapist', 'cum', 'ass', 'arse', 'tit', 'tits', 'dick', 'cock', 'spic', 'chink', 'coon', 'gook',
  'homo', 'hoe', 'pedo', 'paki', 'jap', 'negro', 'sex', 'anal', 'nig', 'nigs', 'lesbo', 'kys',
]);
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g' };
const leet = s => s.toLowerCase().replace(/[0-9]/g, d => LEET[d] || d);
const collapse = s => s.replace(/(.)\1+/g, '$1');

export function cleanName(raw) {
  if (typeof raw !== 'string') return { ok: false, error: 'bad_name', message: 'Pick a name.' };
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) return { ok: false, error: 'bad_name', message: 'Pick a name.' };
  if (name.length > NAME_MAX) return { ok: false, error: 'bad_name', message: `Names are at most ${NAME_MAX} characters.` };
  if (!NAME_RE.test(name)) return { ok: false, error: 'bad_name', message: 'Use letters, numbers, spaces, _ - or . only.' };
  if (isBlocked(name)) return { ok: false, error: 'name_not_allowed', message: 'That name isn\u2019t allowed. Try another.' };
  return { ok: true, name };
}

export function isBlocked(name) {
  const l = leet(name);
  const squashed = l.replace(/[^a-z]/g, '');           // "f.u_c k" -> "fuck"
  const forms = [squashed, collapse(squashed)];         // "fuuuck" -> "fuck"
  if (forms.some(f => ANYWHERE.some(w => f.includes(w)))) return true;
  const words = l.split(/[^a-z]+/).filter(Boolean);
  return words.some(w => WHOLE_WORD.has(w) || WHOLE_WORD.has(collapse(w))) || WHOLE_WORD.has(squashed);
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
// Names can't contain these characters, so this never changes a stored name;
// it is defence in depth for any client that renders with innerHTML.
export const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ESC[c]);
