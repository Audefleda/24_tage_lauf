// Simple in-memory rate limiter for API routes
// Note: This is per-instance only (resets on deploy/restart).
// Sufficient for a small app with 5-30 users on Vercel.

interface RateLimitEntry {
  count: number
  resetTime: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically to prevent memory leaks
const CLEANUP_INTERVAL = 60_000 // 1 minute
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of store) {
    if (now > entry.resetTime) {
      store.delete(key)
    }
  }
}

interface RateLimitOptions {
  /** Maximum number of requests in the window */
  limit: number
  /** Time window in seconds */
  windowSeconds: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetIn: number // seconds until reset
}

export function rateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  cleanup()

  const now = Date.now()
  const windowMs = options.windowSeconds * 1000
  const entry = store.get(key)

  if (!entry || now > entry.resetTime) {
    // New window
    store.set(key, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: options.limit - 1, resetIn: options.windowSeconds }
  }

  if (entry.count >= options.limit) {
    const resetIn = Math.ceil((entry.resetTime - now) / 1000)
    return { allowed: false, remaining: 0, resetIn }
  }

  entry.count++
  const resetIn = Math.ceil((entry.resetTime - now) / 1000)
  return { allowed: true, remaining: options.limit - entry.count, resetIn }
}
