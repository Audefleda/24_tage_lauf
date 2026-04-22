import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
const mockInsert = vi.fn().mockReturnValue({ error: null })
vi.mock('@/lib/supabase-admin', () => ({
  createAdminClient: () => ({
    from: () => ({ insert: (...args: unknown[]) => mockInsert(...args) }),
  }),
}))
const mockTypo3Fetch = vi.fn()
vi.mock('@/lib/typo3-client', () => ({
  typo3Fetch: (...args: unknown[]) => mockTypo3Fetch(...args),
  Typo3Error: class Typo3Error extends Error {},
}))
vi.mock('@/lib/logger', () => ({ debug: vi.fn(), error: vi.fn() }))

import { parseTypo3Response, logTypo3Request, updateRunnerRuns, hasRunDistanceChanged, mergeRunByDate } from './typo3-runs'

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

describe('logTypo3Request (PROJ-8 bugfix: one entry per request, not per run)', () => {
  beforeEach(() => {
    mockInsert.mockReset()
    mockInsert.mockReturnValue({ error: null })
  })

  it('inserts exactly one log entry when changedRun is provided', async () => {
    await logTypo3Request({
      typo3RunnerUid: 5971,
      changedRun: { runDate: '2026-04-20 06:00:00', runDistance: '8.67' },
      httpStatus: 200,
      responseText: JSON.stringify({ success: true, message: 'OK' }),
    })

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const entry = mockInsert.mock.calls[0][0]
    expect(entry).toEqual({
      typo3_runner_uid: 5971,
      run_date: '2026-04-20',
      run_distance_km: 8.67,
      http_status: 200,
      response_success: true,
      response_message: 'OK',
    })
  })

  it('inserts exactly one log entry when changedRun is null (fallback to today)', async () => {
    await logTypo3Request({
      typo3RunnerUid: 5971,
      changedRun: null,
      httpStatus: 200,
      responseText: JSON.stringify({ success: true }),
    })

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const entry = mockInsert.mock.calls[0][0]
    expect(entry.typo3_runner_uid).toBe(5971)
    expect(entry.run_distance_km).toBe(0)
    expect(entry.run_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('does NOT create multiple entries for multiple runs (old bug)', async () => {
    // The old code would iterate over the full runs array, creating N entries.
    // With the fix, only the single changedRun is logged.
    await logTypo3Request({
      typo3RunnerUid: 5971,
      changedRun: { runDate: '2026-04-22 06:00:00', runDistance: '5.5' },
      httpStatus: 200,
      responseText: JSON.stringify({ success: true }),
    })

    expect(mockInsert).toHaveBeenCalledTimes(1)
    // Verify it's the changed run, not the whole array
    const entry = mockInsert.mock.calls[0][0]
    expect(entry.run_date).toBe('2026-04-22')
    expect(entry.run_distance_km).toBe(5.5)
  })

  it('correctly extracts date part from runDate with time component', async () => {
    await logTypo3Request({
      typo3RunnerUid: 123,
      changedRun: { runDate: '2026-05-10 06:00:00', runDistance: '12.345' },
      httpStatus: 200,
      responseText: '{}',
    })

    const entry = mockInsert.mock.calls[0][0]
    expect(entry.run_date).toBe('2026-05-10')
    expect(entry.run_distance_km).toBe(12.345)
  })

  it('handles changedRun with non-numeric runDistance gracefully', async () => {
    await logTypo3Request({
      typo3RunnerUid: 123,
      changedRun: { runDate: '2026-04-20 06:00:00', runDistance: '' },
      httpStatus: 200,
      responseText: '{}',
    })

    const entry = mockInsert.mock.calls[0][0]
    expect(entry.run_distance_km).toBe(0) // parseFloat('') is NaN, fallback || 0
  })

  it('logs timeout errors with null httpStatus', async () => {
    await logTypo3Request({
      typo3RunnerUid: 123,
      changedRun: { runDate: '2026-04-20 06:00:00', runDistance: '5.0' },
      httpStatus: null,
      responseText: 'network timeout',
    })

    const entry = mockInsert.mock.calls[0][0]
    expect(entry.http_status).toBeNull()
    expect(entry.response_success).toBeNull()
    expect(entry.response_message).toBe('network timeout')
  })

  it('does not throw when insert fails — fire-and-forget', async () => {
    mockInsert.mockReturnValue({ error: { message: 'DB error' } })

    // Should not throw
    await logTypo3Request({
      typo3RunnerUid: 123,
      changedRun: { runDate: '2026-04-20 06:00:00', runDistance: '5.0' },
      httpStatus: 200,
      responseText: '{}',
    })

    expect(mockInsert).toHaveBeenCalledTimes(1)
  })
})

describe('hasRunDistanceChanged', () => {
  it('returns true when no existing run for the date', () => {
    const existing = [
      { runDate: '2026-04-20 06:00:00', runDistance: '5.5' },
    ]
    expect(hasRunDistanceChanged(existing, '2026-04-21', '8.00')).toBe(true)
  })

  it('returns false when distance is identical', () => {
    const existing = [
      { runDate: '2026-04-20 06:00:00', runDistance: '8.50' },
    ]
    expect(hasRunDistanceChanged(existing, '2026-04-20', '8.50')).toBe(false)
  })

  it('returns false when distance is numerically equal despite different formatting', () => {
    const existing = [
      { runDate: '2026-04-20 06:00:00', runDistance: '8.5' },
    ]
    expect(hasRunDistanceChanged(existing, '2026-04-20', '8.50')).toBe(false)
  })

  it('returns true when distance differs', () => {
    const existing = [
      { runDate: '2026-04-20 06:00:00', runDistance: '5.5' },
    ]
    expect(hasRunDistanceChanged(existing, '2026-04-20', '8.50')).toBe(true)
  })

  it('matches date part correctly when existing has time component', () => {
    const existing = [
      { runDate: '2026-04-20 06:00:00', runDistance: '10.00' },
    ]
    expect(hasRunDistanceChanged(existing, '2026-04-20', '10.00')).toBe(false)
  })

  it('matches date part correctly when new date has time component', () => {
    const existing = [
      { runDate: '2026-04-20 06:00:00', runDistance: '10.00' },
    ]
    expect(hasRunDistanceChanged(existing, '2026-04-20 06:00:00', '10.00')).toBe(false)
  })

  it('returns true for empty existing runs array', () => {
    expect(hasRunDistanceChanged([], '2026-04-20', '5.00')).toBe(true)
  })
})

describe('mergeRunByDate', () => {
  it('appends run when no existing entry for the date', () => {
    const existing = [
      { runDate: '2026-04-20 06:00:00', runDistance: '5.5' },
    ]
    const result = mergeRunByDate(existing, '2026-04-21', '8.00')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ runDate: '2026-04-20 06:00:00', runDistance: '5.5' })
    expect(result[1]).toEqual({ runDate: '2026-04-21', runDistance: '8.00' })
  })

  it('replaces existing entry for the same date', () => {
    const existing = [
      { runDate: '2026-04-20 06:00:00', runDistance: '5.5' },
      { runDate: '2026-04-22 06:00:00', runDistance: '10.0' },
    ]
    const result = mergeRunByDate(existing, '2026-04-20', '12.00')
    expect(result).toHaveLength(2)
    expect(result.find((r) => r.runDate.startsWith('2026-04-20'))?.runDistance).toBe('12.00')
    expect(result.find((r) => r.runDate.startsWith('2026-04-22'))?.runDistance).toBe('10.0')
  })

  it('handles date matching with time component', () => {
    const existing = [
      { runDate: '2026-04-20 06:00:00', runDistance: '5.5' },
    ]
    const result = mergeRunByDate(existing, '2026-04-20 06:00:00', '8.00')
    expect(result).toHaveLength(1)
    expect(result[0].runDistance).toBe('8.00')
  })

  it('works with empty existing runs', () => {
    const result = mergeRunByDate([], '2026-04-20', '5.00')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ runDate: '2026-04-20', runDistance: '5.00' })
  })

  it('preserves runs for other dates', () => {
    const existing = [
      { runDate: '2026-04-20 06:00:00', runDistance: '5.5' },
      { runDate: '2026-04-21 06:00:00', runDistance: '3.0' },
      { runDate: '2026-04-22 06:00:00', runDistance: '7.0' },
    ]
    const result = mergeRunByDate(existing, '2026-04-21', '9.00')
    expect(result).toHaveLength(3)
    expect(result.find((r) => r.runDate.startsWith('2026-04-20'))?.runDistance).toBe('5.5')
    expect(result.find((r) => r.runDate.startsWith('2026-04-21'))?.runDistance).toBe('9.00')
    expect(result.find((r) => r.runDate.startsWith('2026-04-22'))?.runDistance).toBe('7.0')
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

  it('passes changedRun to logTypo3Request when provided', async () => {
    mockInsert.mockReset()
    mockInsert.mockReturnValue({ error: null })

    const changedRun = { runDate: '2026-04-22 06:00:00', runDistance: '7.5' }
    await updateRunnerRuns(123, [
      { runDate: '2026-04-20 06:00:00', runDistance: '5.0' },
      { runDate: '2026-04-21 06:00:00', runDistance: '3.0' },
      changedRun,
    ], changedRun)

    // logTypo3Request should have been called once with the single changed run
    expect(mockInsert).toHaveBeenCalledTimes(1)
    const entry = mockInsert.mock.calls[0][0]
    expect(entry.run_date).toBe('2026-04-22')
    expect(entry.run_distance_km).toBe(7.5)
    expect(entry.typo3_runner_uid).toBe(123)
  })

  it('uses null changedRun fallback when changedRun is not passed', async () => {
    mockInsert.mockReset()
    mockInsert.mockReturnValue({ error: null })

    await updateRunnerRuns(123, [
      { runDate: '2026-04-20 06:00:00', runDistance: '5.0' },
    ])

    // Should log exactly one entry even though changedRun is undefined
    expect(mockInsert).toHaveBeenCalledTimes(1)
    const entry = mockInsert.mock.calls[0][0]
    // Fallback: today's date and 0 distance
    expect(entry.run_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(entry.run_distance_km).toBe(0)
  })

  it('logs only ONE entry regardless of how many runs are in the array', async () => {
    mockInsert.mockReset()
    mockInsert.mockReturnValue({ error: null })

    const runs = Array.from({ length: 25 }, (_, i) => ({
      runDate: `2026-04-${String(i + 1).padStart(2, '0')} 06:00:00`,
      runDistance: String(i + 1),
    }))
    const changedRun = runs[12]

    await updateRunnerRuns(123, runs, changedRun)

    // Critical: old bug would create 25 entries. Fix should create exactly 1.
    expect(mockInsert).toHaveBeenCalledTimes(1)
    const entry = mockInsert.mock.calls[0][0]
    expect(entry.run_date).toBe('2026-04-13')
    expect(entry.run_distance_km).toBe(13)
  })
})
