const hits = new Map<string, number[]>();

/** Burst guard. The monthly cap in Postgres is the billing control. */
export function tooManyRequests(userId: string, limit = 12, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) || []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    hits.set(userId, recent);
    return true;
  }
  recent.push(now);
  hits.set(userId, recent);
  return false;
}
