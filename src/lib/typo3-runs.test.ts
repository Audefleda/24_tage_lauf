import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase-admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/typo3-client', () => ({ typo3Fetch: vi.fn(), Typo3Error: class Typo3Error extends Error {} }))
vi.mock('@/lib/logger', () => ({ debug: vi.fn(), error: vi.fn() }))

import { parseTypo3Response } from './typo3-runs'

describe('parseTypo3Response', () => {
  describe('valid JSON responses', () => {
    it('extracts success=true and a message string', () => {
      const result = parseTypo3Response(JSON.stringify({ success: true, message: 'OK' }))
      expect(result.responseSuccess).toBe(true)
      expect(result.responseMessage).toBe('OK')
    })

    it('extracts success=false and a message string', () => {
      const result = parseTypo3Response(JSON.stringify({ success: false, message: 'Fehler' }))
      expect(result.responseSuccess).toBe(false)
      expect(result.responseMessage).toBe('Fehler')
    })

    it('returns null for success when field is missing', () => {
      const result = parseTypo3Response(JSON.stringify({ message: 'OK' }))
      expect(result.responseSuccess).toBeNull()
    })

    it('returns null for message when field is missing', () => {
      const result = parseTypo3Response(JSON.stringify({ success: true }))
      expect(result.responseMessage).toBeNull()
    })

    it('returns null for success when value is not a boolean', () => {
      const result = parseTypo3Response(JSON.stringify({ success: 'yes', message: 'OK' }))
      expect(result.responseSuccess).toBeNull()
    })

    it('returns null for message when value is not a string', () => {
      const result = parseTypo3Response(JSON.stringify({ success: true, message: 42 }))
      expect(result.responseMessage).toBeNull()
    })
  })

  describe('invalid / non-JSON responses', () => {
    it('returns both null when response is invalid JSON', () => {
      const result = parseTypo3Response('not json at all')
      expect(result.responseSuccess).toBeNull()
      expect(result.responseMessage).toBe('not json at all')
    })

    it('returns both null for an empty string', () => {
      const result = parseTypo3Response('')
      expect(result.responseSuccess).toBeNull()
      expect(result.responseMessage).toBeNull()
    })

    it('truncates very long non-JSON responses to 2000 characters', () => {
      const longText = 'x'.repeat(3000)
      const result = parseTypo3Response(longText)
      expect(result.responseMessage?.length).toBe(2000)
    })
  })
})
