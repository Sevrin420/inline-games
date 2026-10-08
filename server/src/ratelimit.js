// Small in-memory fixed-window limiter. One process, one box, so memory is
// enough; counters reset on restart, which is acceptable for abuse limits.
export function createLimiter() {
  const buckets = new Map();
  let lastSweep = Date.now();
  return {
    // Returns true if allowed, false if over the limit.
    hit(key, limit, windowMs, now = Date.now()) {
      if (now - lastSweep > 60_000) {
        for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
        lastSweep = now;
      }
      let b = buckets.get(key);
      if (!b || b.reset <= now) { b = { count: 0, reset: now + windowMs }; buckets.set(key, b); }
      b.count++;
      return b.count <= limit;
    },
    reset(key) { buckets.delete(key); },
  };
}
