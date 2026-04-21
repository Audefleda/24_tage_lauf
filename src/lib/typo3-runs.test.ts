import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase-admin', () => ({
  createAdminClient: () => ({
    from: () => ({ insert: () => ({ error: null }) }),
  }),
}))
const mockTypo3Fetch = vi.fn()
vi.mock('@/lib/typo3-client', () => ({
  typo3Fetch: (...args: unknown[]) => mockTypo3Fetch(...args),
  Typo3Error: class Typo3Error extends Error {},
}))
vi.mock('@/lib/logger', () => ({ debug: vi.fn(), error: vi.fn() }))

import { parseTypo3Response, updateRunnerRuns } from './typo3-runs'

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

describe('updateRunnerRuns', () => {
  beforeEach(() => {
    mockTypo3Fetch.mockReset()
    mockTypo3Fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true }),
    })
  })

  function getSentRuns(): unknown[] {
    const body = mockTypo3Fetch.mock.calls[0][1].body as string
    const params = new URLSearchParams(body)
    return JSON.parse(params.get('request[arguments][runs]')!)
  }

  it('converts decimal points to commas for TYPO3', async () => {
    await updateRunnerRuns(123, [
      { runDate: '2026-04-20 06:00:00', runDistance: '8.67' },
    ])

    const runs = getSentRuns()
    expect(runs).toEqual([
      { runDate: '2026-04-20 06:00:00', runDistance: '8,67' },
    ])
  })

  it('sends distance "0" as "0" (no decimal point to convert)', async () => {
    await updateRunnerRuns(123, [
      { runDate: '2026-04-20 06:00:00', runDistance: '5.5' },
      { runDate: '2026-04-21 06:00:00', runDistance: '0' },
    ])

    const runs = getSentRuns()
    expect(runs).toEqual([
      { runDate: '2026-04-20 06:00:00', runDistance: '5,5' },
      { runDate: '2026-04-21 06:00:00', runDistance: '0' },
    ])
  })

  it('keeps run entries with distance "0" in the array (TYPO3 needs them to delete)', async () => {
    const runs = [
      { runDate: '2026-04-20 06:00:00', runDistance: '3.5' },
      { runDate: '2026-04-21 06:00:00', runDistance: '0' },
    ]

    await updateRunnerRuns(123, runs)

    const sentRuns = getSentRuns() as { runDate: string; runDistance: string }[]
    expect(sentRuns).toHaveLength(2)
    const deleteEntry = sentRuns.find((r) => r.runDate === '2026-04-21 06:00:00')
    expect(deleteEntry).toBeDefined()
    expect(deleteEntry!.runDistance).toBe('0')
  })

  it('handles whole numbers without decimal point', async () => {
    await updateRunnerRuns(123, [
      { runDate: '2026-04-20 06:00:00', runDistance: '10' },
    ])

    const runs = getSentRuns()
    expect(runs).toEqual([
      { runDate: '2026-04-20 06:00:00', runDistance: '10' },
    ])
  })
})
