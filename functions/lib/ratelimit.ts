/**
 * Fixed-window request counter held in memory. Best effort: each Worker isolate keeps its own counts, so this slows a
 * script down but does not replace the Cloudflare rate-limiting rule described in docs/HANDOVER.md.
 */
const windows = new Map<string, { start: number; count: number }>();
const MAX_KEYS = 10_000;

export function allow(key: string, limit: number, windowSeconds: number, now = Math.floor(Date.now() / 1000)): { allowed: boolean; retryAfter?: number } {
  const row = windows.get(key);
  if (!row || now - row.start >= windowSeconds) {
    if (windows.size >= MAX_KEYS) for (const [k, r] of windows) if (now - r.start >= windowSeconds) windows.delete(k);
    if (windows.size >= MAX_KEYS) windows.clear();
    windows.set(key, { start: now, count: 1 });
    return { allowed: true };
  }
  row.count += 1;
  if (row.count > limit) return { allowed: false, retryAfter: row.start + windowSeconds - now };
  return { allowed: true };
}

export function resetRateLimit(): void {
  windows.clear();
}
