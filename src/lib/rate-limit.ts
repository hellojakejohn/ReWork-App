// SPEED BUMP, not real rate limiting: this is an in-memory sliding window per server
// instance. On Vercel each lambda has its own memory and cold starts reset it, so a
// determined user can get past it. Swap for Upstash/Redis if abuse shows up.

const WINDOW_MS = 10 * 60 * 1000
const MAX_REQUESTS = 10

const hits = new Map<string, number[]>()

export function checkRateLimit(key: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= MAX_REQUESTS) {
    hits.set(key, recent)
    return { allowed: false, retryAfterSeconds: Math.ceil((recent[0] + WINDOW_MS - now) / 1000) }
  }
  recent.push(now)
  hits.set(key, recent)

  // Keep the map from growing forever
  if (hits.size > 5000) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(k)
    }
  }
  return { allowed: true, retryAfterSeconds: 0 }
}

export function rateLimitResponseBody(retryAfterSeconds: number) {
  return {
    success: false,
    error: `Too many requests. Please wait ${Math.ceil(retryAfterSeconds / 60)} minute(s) and try again.`,
  }
}
