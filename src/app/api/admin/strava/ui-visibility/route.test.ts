/**
 * Unit tests for POST /api/admin/strava/ui-visibility input validation (PROJ-25)
 *
 * These tests validate the input validation logic used by the POST handler.
 * The actual route handler cannot be unit-tested directly because it depends
 * on Next.js server context (requireAdmin, createAdminClient). Instead we test
 * the validation logic that the handler performs on the request body.
 *
 * The validation rules (replicated from route.ts):
 * 1. Body must be valid JSON (otherwise 422)
 * 2. Body must be a non-null object with a boolean `visible` field (otherwise 422)
 */

import { describe, it, expect } from 'vitest'

// Replicate the validation logic from the POST handler
function validateBody(body: unknown): { valid: true; visible: boolean } | { valid: false; error: string } {
  if (typeof body !== 'object' || body === null || typeof (body as Record<string, unknown>).visible !== 'boolean') {
    return { valid: false, error: 'Feld "visible" (boolean) fehlt' }
  }
  return { valid: true, visible: (body as { visible: boolean }).visible }
}

// Replicate the default-value logic from the GET handler
function resolveVisibility(data: { value: string } | null): boolean {
  return data ? data.value !== 'false' : true
}

describe('POST /api/admin/strava/ui-visibility — input validation', () => {
  describe('valid inputs', () => {
    it('accepts { visible: true }', () => {
      const result = validateBody({ visible: true })
      expect(result.valid).toBe(true)
      if (result.valid) expect(result.visible).toBe(true)
    })

    it('accepts { visible: false }', () => {
      const result = validateBody({ visible: false })
      expect(result.valid).toBe(true)
      if (result.valid) expect(result.visible).toBe(false)
    })

    it('ignores extra fields', () => {
      const result = validateBody({ visible: true, extra: 'ignored' })
      expect(result.valid).toBe(true)
      if (result.valid) expect(result.visible).toBe(true)
    })
  })

  describe('invalid inputs', () => {
    it('rejects missing visible field', () => {
      expect(validateBody({}).valid).toBe(false)
    })

    it('rejects string "true"', () => {
      expect(validateBody({ visible: 'true' }).valid).toBe(false)
    })

    it('rejects string "false"', () => {
      expect(validateBody({ visible: 'false' }).valid).toBe(false)
    })

    it('rejects number 1', () => {
      expect(validateBody({ visible: 1 }).valid).toBe(false)
    })

    it('rejects number 0', () => {
      expect(validateBody({ visible: 0 }).valid).toBe(false)
    })

    it('rejects null body', () => {
      expect(validateBody(null).valid).toBe(false)
    })

    it('rejects undefined body', () => {
      expect(validateBody(undefined).valid).toBe(false)
    })

    it('rejects array body', () => {
      expect(validateBody([{ visible: true }]).valid).toBe(false)
    })

    it('rejects string body', () => {
      expect(validateBody('true').valid).toBe(false)
    })

    it('rejects visible: null', () => {
      expect(validateBody({ visible: null }).valid).toBe(false)
    })

    it('rejects visible: undefined', () => {
      expect(validateBody({ visible: undefined }).valid).toBe(false)
    })
  })
})

describe('GET /api/admin/strava/ui-visibility — default value logic', () => {
  it('returns true when data is null (no entry in app_settings)', () => {
    expect(resolveVisibility(null)).toBe(true)
  })

  it('returns true when value is "true"', () => {
    expect(resolveVisibility({ value: 'true' })).toBe(true)
  })

  it('returns false when value is "false"', () => {
    expect(resolveVisibility({ value: 'false' })).toBe(false)
  })

  it('returns true for unexpected value (e.g. empty string)', () => {
    // Empty string !== 'false', so it defaults to true
    expect(resolveVisibility({ value: '' })).toBe(true)
  })

  it('returns true for unexpected value (e.g. "yes")', () => {
    expect(resolveVisibility({ value: 'yes' })).toBe(true)
  })

  it('returns true for unexpected value (e.g. "0")', () => {
    // "0" !== 'false', so it defaults to true
    expect(resolveVisibility({ value: '0' })).toBe(true)
  })
})
