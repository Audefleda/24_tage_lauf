/**
 * Unit tests for GET /api/team/stats calculation logic (PROJ-26)
 *
 * These tests validate the capped team total calculation that the handler performs.
 * The actual route handler depends on Next.js server context (Supabase auth, typo3Fetch),
 * so we test the pure calculation logic replicated from route.ts.
 */

import { describe, it, expect } from 'vitest'

// --- Replicated types and logic from route.ts ---

interface Typo3RawRun {
  rundate: string
  rundateObj: string
  distance: string
}

const REIMBURSEMENT_CAP_KM = 100

function sumRunsKm(runs: Typo3RawRun[]): number {
  return runs.reduce((sum, r) => {
    const dist = parseFloat((r.distance ?? '0').replace(',', '.'))
    return sum + (isNaN(dist) ? 0 : dist)
  }, 0)
}

function calculateCappedTeamTotal(
  runners: { runs: Typo3RawRun[] }[]
): number {
  const totalKm = runners.reduce((sum, runner) => {
    const runnerKm = sumRunsKm(runner.runs ?? [])
    return sum + Math.min(runnerKm, REIMBURSEMENT_CAP_KM)
  }, 0)
  return Math.round(totalKm * 100) / 100
}

// --- Helper to create a run ---

function makeRun(distance: string): Typo3RawRun {
  return { rundate: '1234567890', rundateObj: '2026-04-21', distance }
}

// --- Tests ---

describe('GET /api/team/stats — sumRunsKm', () => {
  it('sums numeric distances', () => {
    const runs = [makeRun('5.50'), makeRun('3.20'), makeRun('1.30')]
    expect(sumRunsKm(runs)).toBeCloseTo(10.0)
  })

  it('handles comma-separated distances (German locale)', () => {
    const runs = [makeRun('5,50'), makeRun('3,20')]
    expect(sumRunsKm(runs)).toBeCloseTo(8.7)
  })

  it('returns 0 for empty runs array', () => {
    expect(sumRunsKm([])).toBe(0)
  })

  it('ignores NaN distances', () => {
    const runs = [makeRun('5.00'), makeRun('abc'), makeRun('3.00')]
    expect(sumRunsKm(runs)).toBeCloseTo(8.0)
  })

  it('treats missing distance as 0', () => {
    const runs = [{ rundate: '', rundateObj: '', distance: '' }]
    // parseFloat('') is NaN, so treated as 0
    expect(sumRunsKm(runs)).toBe(0)
  })
})

describe('GET /api/team/stats — calculateCappedTeamTotal', () => {
  it('returns 0 for no runners', () => {
    expect(calculateCappedTeamTotal([])).toBe(0)
  })

  it('sums uncapped runners correctly (all under 100km)', () => {
    const runners = [
      { runs: [makeRun('50.00')] },
      { runs: [makeRun('30.00')] },
      { runs: [makeRun('20.00')] },
    ]
    expect(calculateCappedTeamTotal(runners)).toBe(100.0)
  })

  it('caps runners at 100km', () => {
    const runners = [
      { runs: [makeRun('150.00')] }, // capped to 100
      { runs: [makeRun('50.00')] },  // uncapped
    ]
    expect(calculateCappedTeamTotal(runners)).toBe(150.0)
  })

  it('handles runner exactly at 100km (no rounding down)', () => {
    const runners = [
      { runs: [makeRun('100.00')] },
    ]
    expect(calculateCappedTeamTotal(runners)).toBe(100.0)
  })

  it('caps multiple runners independently', () => {
    const runners = [
      { runs: [makeRun('200.00')] }, // capped to 100
      { runs: [makeRun('300.00')] }, // capped to 100
      { runs: [makeRun('10.00')] },  // uncapped
    ]
    expect(calculateCappedTeamTotal(runners)).toBe(210.0)
  })

  it('handles all runners at 0km', () => {
    const runners = [
      { runs: [] },
      { runs: [] },
    ]
    expect(calculateCappedTeamTotal(runners)).toBe(0)
  })

  it('handles runners with multiple runs that sum over 100km', () => {
    const runners = [
      { runs: [makeRun('40.00'), makeRun('40.00'), makeRun('40.00')] }, // 120km -> capped to 100
      { runs: [makeRun('10.00'), makeRun('5.00')] },                    // 15km uncapped
    ]
    expect(calculateCappedTeamTotal(runners)).toBe(115.0)
  })

  it('rounds to 2 decimal places', () => {
    const runners = [
      { runs: [makeRun('33.333')] },
      { runs: [makeRun('33.333')] },
      { runs: [makeRun('33.333')] },
    ]
    // 33.333 * 3 = 99.999, rounded to 100.00
    expect(calculateCappedTeamTotal(runners)).toBe(100.0)
  })

  it('handles floating point edge case', () => {
    const runners = [
      { runs: [makeRun('0.10'), makeRun('0.20')] },
    ]
    // 0.1 + 0.2 = 0.30000000000000004 in JS, rounded to 0.30
    expect(calculateCappedTeamTotal(runners)).toBe(0.3)
  })

  it('handles runners with undefined runs array', () => {
    const runners = [
      { runs: undefined as unknown as Typo3RawRun[] },
      { runs: [makeRun('50.00')] },
    ]
    expect(calculateCappedTeamTotal(runners)).toBe(50.0)
  })
})
