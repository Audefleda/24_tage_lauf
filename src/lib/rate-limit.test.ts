import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { rateLimit } from './rate-limit'

// Use a counter to ensure each test gets a unique key, avoiding state leakage
// from the module-level store Map between tests.
let keyCounter = 0
function uniqueKey() {
  return `test-key-${++keyCounter}`
}

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('first request in a new window', () => {
    it('is allowed', () => {
      const result = rateLimit(uniqueKey(), { limit: 5, windowSeconds: 60 })
      expect(result.allowed).toBe(true)
    })

    it('returns remaining = limit - 1', () => {
      const result = rateLimit(uniqueKey(), { limit: 5, windowSeconds: 60 })
      expect(result.remaining).toBe(4)
    })

    it('returns resetIn equal to the window duration', () => {
      const result = rateLimit(uniqueKey(), { limit: 5, windowSeconds: 60 })
      expect(result.resetIn).toBe(60)
    })
  })

  describe('within the limit', () => {
    it('decrements remaining with each request', () => {
      const key = uniqueKey()
      rateLimit(key, { limit: 3, windowSeconds: 60 })
      const second = rateLimit(key, { limit: 3, windowSeconds: 60 })
      expect(second.remaining).toBe(1)
      expect(second.allowed).toBe(true)
    })
  })

  describe('when limit is reached', () => {
    it('blocks the request that exceeds the limit', () => {
      const key = uniqueKey()
      rateLimit(key, { limit: 2, windowSeconds: 60 })
      rateLimit(key, { limit: 2, windowSeconds: 60 })
      const over = rateLimit(key, { limit: 2, windowSeconds: 60 })
      expect(over.allowed).toBe(false)
      expect(over.remaining).toBe(0)
    })

    it('returns resetIn > 0 when blocked', () => {
      const key = uniqueKey()
      rateLimit(key, { limit: 1, windowSeconds: 60 })
      const blocked = rateLimit(key, { limit: 1, windowSeconds: 60 })
      expect(blocked.resetIn).toBeGreaterThan(0)
      expect(blocked.resetIn).toBeLessThanOrEqual(60)
    })
  })

  describe('window reset', () => {
    it('allows requests again after the time window expires', () => {
      const key = uniqueKey()
      rateLimit(key, { limit: 1, windowSeconds: 60 })
      const blocked = rateLimit(key, { limit: 1, windowSeconds: 60 })
      expect(blocked.allowed).toBe(false)

      vi.advanceTimersByTime(61_000)

      const after = rateLimit(key, { limit: 1, windowSeconds: 60 })
      expect(after.allowed).toBe(true)
      expect(after.remaining).toBe(0)
    })

    it('does not reset before the window expires', () => {
      const key = uniqueKey()
      rateLimit(key, { limit: 1, windowSeconds: 60 })
      vi.advanceTimersByTime(59_000)
      const stillBlocked = rateLimit(key, { limit: 1, windowSeconds: 60 })
      expect(stillBlocked.allowed).toBe(false)
    })
  })

  describe('independent keys', () => {
    it('tracks each key separately', () => {
      const keyA = uniqueKey()
      const keyB = uniqueKey()
      rateLimit(keyA, { limit: 1, windowSeconds: 60 })
      rateLimit(keyA, { limit: 1, windowSeconds: 60 }) // keyA blocked

      const resultB = rateLimit(keyB, { limit: 1, windowSeconds: 60 })
      expect(resultB.allowed).toBe(true)
    })
  })
})
