/**
 * Unit tests for the ExternalRunSchema validation logic (PROJ-23)
 *
 * Tests the Zod schema used by POST /api/webhook/external to validate
 * incoming run data from Make.com / Zapier / curl.
 *
 * The schema is replicated here because it is not exported from route.ts.
 * If the schema in route.ts changes, these tests must be updated accordingly.
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { createHash } from 'crypto'

// Replicate the schema from route.ts exactly
const ExternalRunSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum muss im Format YYYY-MM-DD sein')
    .refine((d) => {
      const parsed = new Date(d + 'T00:00:00Z')
      return !isNaN(parsed.getTime()) && d === parsed.toISOString().split('T')[0]
    }, 'Ungueltiges Datum'),
  distance_km: z
    .number({ error: 'distance_km muss eine Zahl sein' })
    .finite()
    .nonnegative()
    .max(1000, 'distance_km darf maximal 1000 km betragen'),
})

// Replicate the hashToken function from route.ts
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

describe('ExternalRunSchema', () => {
  describe('valid inputs', () => {
    it('accepts a valid date and distance', () => {
      const result = ExternalRunSchema.safeParse({
        date: '2026-04-03',
        distance_km: 10.5,
      })
      expect(result.success).toBe(true)
    })

    it('accepts distance_km = 0', () => {
      const result = ExternalRunSchema.safeParse({
        date: '2026-04-03',
        distance_km: 0,
      })
      expect(result.success).toBe(true)
    })

    it('accepts distance_km = 1000 (maximum)', () => {
      const result = ExternalRunSchema.safeParse({
        date: '2026-04-03',
        distance_km: 1000,
      })
      expect(result.success).toBe(true)
    })

    it('accepts distance_km with many decimal places', () => {
      const result = ExternalRunSchema.safeParse({
        date: '2026-04-03',
        distance_km: 5.123456789,
      })
      expect(result.success).toBe(true)
    })

    it('accepts a leap year date', () => {
      const result = ExternalRunSchema.safeParse({
        date: '2028-02-29',
        distance_km: 5,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('date validation', () => {
    it('rejects missing date', () => {
      const result = ExternalRunSchema.safeParse({ distance_km: 10 })
      expect(result.success).toBe(false)
    })

    it('rejects empty string date', () => {
      const result = ExternalRunSchema.safeParse({ date: '', distance_km: 10 })
      expect(result.success).toBe(false)
    })

    it('rejects non-string date', () => {
      const result = ExternalRunSchema.safeParse({ date: 20260403, distance_km: 10 })
      expect(result.success).toBe(false)
    })

    it('rejects wrong format (DD.MM.YYYY)', () => {
      const result = ExternalRunSchema.safeParse({ date: '03.04.2026', distance_km: 10 })
      expect(result.success).toBe(false)
    })

    it('rejects wrong format (MM/DD/YYYY)', () => {
      const result = ExternalRunSchema.safeParse({ date: '04/03/2026', distance_km: 10 })
      expect(result.success).toBe(false)
    })

    it('rejects invalid month (2026-13-01)', () => {
      const result = ExternalRunSchema.safeParse({ date: '2026-13-01', distance_km: 10 })
      expect(result.success).toBe(false)
    })

    it('rejects invalid day (2026-04-32)', () => {
      const result = ExternalRunSchema.safeParse({ date: '2026-04-32', distance_km: 10 })
      expect(result.success).toBe(false)
    })

    it('rejects Feb 29 on non-leap year (2026-02-29)', () => {
      const result = ExternalRunSchema.safeParse({ date: '2026-02-29', distance_km: 10 })
      expect(result.success).toBe(false)
    })

    it('rejects date with time suffix', () => {
      const result = ExternalRunSchema.safeParse({
        date: '2026-04-03T10:00:00',
        distance_km: 10,
      })
      expect(result.success).toBe(false)
    })

    it('rejects TYPO3 datetime format (space separator)', () => {
      const result = ExternalRunSchema.safeParse({
        date: '2026-04-03 06:00:00',
        distance_km: 10,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('distance_km validation', () => {
    it('rejects missing distance_km', () => {
      const result = ExternalRunSchema.safeParse({ date: '2026-04-03' })
      expect(result.success).toBe(false)
    })

    it('rejects string distance_km', () => {
      const result = ExternalRunSchema.safeParse({ date: '2026-04-03', distance_km: '10' })
      expect(result.success).toBe(false)
    })

    it('rejects negative distance_km', () => {
      const result = ExternalRunSchema.safeParse({ date: '2026-04-03', distance_km: -1 })
      expect(result.success).toBe(false)
    })

    it('rejects distance_km > 1000', () => {
      const result = ExternalRunSchema.safeParse({ date: '2026-04-03', distance_km: 1001 })
      expect(result.success).toBe(false)
    })

    it('rejects Infinity', () => {
      const result = ExternalRunSchema.safeParse({ date: '2026-04-03', distance_km: Infinity })
      expect(result.success).toBe(false)
    })

    it('rejects -Infinity', () => {
      const result = ExternalRunSchema.safeParse({ date: '2026-04-03', distance_km: -Infinity })
      expect(result.success).toBe(false)
    })

    it('rejects NaN', () => {
      const result = ExternalRunSchema.safeParse({ date: '2026-04-03', distance_km: NaN })
      expect(result.success).toBe(false)
    })

    it('rejects null', () => {
      const result = ExternalRunSchema.safeParse({ date: '2026-04-03', distance_km: null })
      expect(result.success).toBe(false)
    })

    it('rejects boolean', () => {
      const result = ExternalRunSchema.safeParse({ date: '2026-04-03', distance_km: true })
      expect(result.success).toBe(false)
    })
  })

  describe('extra fields', () => {
    it('ignores extra fields (Zod strips them by default)', () => {
      const result = ExternalRunSchema.safeParse({
        date: '2026-04-03',
        distance_km: 10,
        extra_field: 'ignored',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({ date: '2026-04-03', distance_km: 10 })
      }
    })
  })

  describe('empty and malformed inputs', () => {
    it('rejects empty object', () => {
      const result = ExternalRunSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('rejects null', () => {
      const result = ExternalRunSchema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('rejects undefined', () => {
      const result = ExternalRunSchema.safeParse(undefined)
      expect(result.success).toBe(false)
    })

    it('rejects array', () => {
      const result = ExternalRunSchema.safeParse([{ date: '2026-04-03', distance_km: 10 }])
      expect(result.success).toBe(false)
    })

    it('rejects string', () => {
      const result = ExternalRunSchema.safeParse('{"date":"2026-04-03","distance_km":10}')
      expect(result.success).toBe(false)
    })
  })
})

describe('hashToken', () => {
  it('returns a 64-character hex string', () => {
    const hash = hashToken('test-token')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns the same hash for the same input', () => {
    const hash1 = hashToken('my-secret-token')
    const hash2 = hashToken('my-secret-token')
    expect(hash1).toBe(hash2)
  })

  it('returns different hashes for different inputs', () => {
    const hash1 = hashToken('token-a')
    const hash2 = hashToken('token-b')
    expect(hash1).not.toBe(hash2)
  })

  it('matches known SHA-256 output', () => {
    // SHA-256 of "hello" is well-known
    const hash = hashToken('hello')
    expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
  })

  it('handles empty string', () => {
    const hash = hashToken('')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    // SHA-256 of empty string
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('handles long token (64 hex chars like production tokens)', () => {
    const longToken = 'a'.repeat(64)
    const hash = hashToken(longToken)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})
