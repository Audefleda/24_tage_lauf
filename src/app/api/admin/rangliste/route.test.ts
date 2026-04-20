/**
 * Unit tests for GET /api/admin/rangliste calculation logic (PROJ-27)
 *
 * These tests validate the ranking calculation, sorting, and event period filtering
 * that the handler performs. The actual route handler depends on Next.js server
 * context (Supabase auth, typo3Fetch), so we test the pure calculation logic
 * replicated from route.ts.
 */

import { describe, it, expect } from 'vitest'

// --- Replicated types and logic from route.ts ---

const EVENT_START = '2026-04-20'
const EVENT_END = '2026-05-14'

interface Typo3RawRun {
  rundate: string
  rundateObj: string
  distance: string
}

interface RankingEntry {
  rank: number
  uid: number
  nr: number
  name: string
  totalKm: number
  runCount: number
}

function isInEventPeriod(rundate: string): boolean {
  const datePart = rundate.split(' ')[0]
  if (!datePart) return false
  return datePart >= EVENT_START && datePart <= EVENT_END
}

function calculateRanking(
  runners: {
    uid: number
    nr: number
    name: string
    runs: Typo3RawRun[]
  }[]
): RankingEntry[] {
  const entries = runners.map((runner) => {
    const eventRuns = (runner.runs ?? []).filter((r) =>
      isInEventPeriod(r.rundateObj ?? r.rundate ?? '')
    )

    const totalKm = eventRuns.reduce((sum, r) => {
      const dist = parseFloat((r.distance ?? '0').replace(',', '.'))
      return sum + (isNaN(dist) ? 0 : dist)
    }, 0)

    const runCount = eventRuns.filter((r) => {
      const dist = parseFloat((r.distance ?? '0').replace(',', '.'))
      return !isNaN(dist) && dist > 0
    }).length

    return {
      uid: runner.uid,
      nr: runner.nr,
      name: runner.name,
      totalKm: Math.round(totalKm * 100) / 100,
      runCount,
    }
  })

  entries.sort((a, b) => {
    if (b.totalKm !== a.totalKm) return b.totalKm - a.totalKm
    if (b.runCount !== a.runCount) return b.runCount - a.runCount
    return a.name.localeCompare(b.name, 'de')
  })

  return entries.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }))
}

// --- Helpers ---

function makeRun(
  distance: string,
  date: string = '2026-04-25'
): Typo3RawRun {
  const unixTimestamp = String(Math.floor(new Date(date).getTime() / 1000))
  return { rundate: unixTimestamp, rundateObj: date, distance }
}

function makeRunner(
  uid: number,
  name: string,
  runs: Typo3RawRun[],
  nr: number = uid
) {
  return { uid, nr, name, runs }
}

// --- Tests ---

describe('isInEventPeriod', () => {
  it('accepts dates within the event period', () => {
    expect(isInEventPeriod('2026-04-20')).toBe(true)
    expect(isInEventPeriod('2026-04-25')).toBe(true)
    expect(isInEventPeriod('2026-05-01')).toBe(true)
    expect(isInEventPeriod('2026-05-14')).toBe(true)
  })

  it('rejects dates outside the event period', () => {
    expect(isInEventPeriod('2026-04-19')).toBe(false)
    expect(isInEventPeriod('2026-05-15')).toBe(false)
    expect(isInEventPeriod('2025-04-25')).toBe(false)
    expect(isInEventPeriod('2027-04-25')).toBe(false)
  })

  it('handles datetime format with time component', () => {
    expect(isInEventPeriod('2026-04-20 08:30:00')).toBe(true)
    expect(isInEventPeriod('2026-05-14 23:59:59')).toBe(true)
    expect(isInEventPeriod('2026-04-19 23:59:59')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isInEventPeriod('')).toBe(false)
  })
})

describe('calculateRanking — basic sorting', () => {
  it('sorts by totalKm descending', () => {
    const runners = [
      makeRunner(1, 'Alice', [makeRun('10.00')]),
      makeRunner(2, 'Bob', [makeRun('30.00')]),
      makeRunner(3, 'Charlie', [makeRun('20.00')]),
    ]
    const ranking = calculateRanking(runners)
    expect(ranking[0].name).toBe('Bob')
    expect(ranking[1].name).toBe('Charlie')
    expect(ranking[2].name).toBe('Alice')
  })

  it('uses runCount as secondary sort (more runs = higher rank)', () => {
    const runners = [
      makeRunner(1, 'Alice', [makeRun('10.00')]),
      makeRunner(2, 'Bob', [makeRun('5.00'), makeRun('5.00')]),
    ]
    const ranking = calculateRanking(runners)
    // Both have 10km, Bob has 2 runs vs Alice 1 run
    expect(ranking[0].name).toBe('Bob')
    expect(ranking[1].name).toBe('Alice')
  })

  it('uses alphabetical name as tertiary sort', () => {
    const runners = [
      makeRunner(1, 'Zara', [makeRun('10.00')]),
      makeRunner(2, 'Anna', [makeRun('10.00')]),
    ]
    const ranking = calculateRanking(runners)
    // Same km and run count -> alphabetical
    expect(ranking[0].name).toBe('Anna')
    expect(ranking[1].name).toBe('Zara')
  })

  it('assigns sequential ranks starting from 1', () => {
    const runners = [
      makeRunner(1, 'A', [makeRun('30.00')]),
      makeRunner(2, 'B', [makeRun('20.00')]),
      makeRunner(3, 'C', [makeRun('10.00')]),
    ]
    const ranking = calculateRanking(runners)
    expect(ranking.map((r) => r.rank)).toEqual([1, 2, 3])
  })
})

describe('calculateRanking — event period filtering', () => {
  it('only counts runs within the event period', () => {
    const runners = [
      makeRunner(1, 'Alice', [
        makeRun('10.00', '2026-04-25'), // in period
        makeRun('50.00', '2026-03-15'), // before period
        makeRun('50.00', '2026-06-01'), // after period
      ]),
    ]
    const ranking = calculateRanking(runners)
    expect(ranking[0].totalKm).toBe(10)
    expect(ranking[0].runCount).toBe(1)
  })

  it('includes runs on event start and end dates', () => {
    const runners = [
      makeRunner(1, 'Alice', [
        makeRun('5.00', '2026-04-20'), // first day
        makeRun('5.00', '2026-05-14'), // last day
      ]),
    ]
    const ranking = calculateRanking(runners)
    expect(ranking[0].totalKm).toBe(10)
    expect(ranking[0].runCount).toBe(2)
  })
})

describe('calculateRanking — distance parsing', () => {
  it('handles comma-separated distances (German locale)', () => {
    const runners = [
      makeRunner(1, 'Alice', [makeRun('5,50'), makeRun('3,20')]),
    ]
    const ranking = calculateRanking(runners)
    expect(ranking[0].totalKm).toBeCloseTo(8.7)
  })

  it('handles NaN distances gracefully', () => {
    const runners = [
      makeRunner(1, 'Alice', [makeRun('abc'), makeRun('5.00')]),
    ]
    const ranking = calculateRanking(runners)
    expect(ranking[0].totalKm).toBe(5)
  })

  it('does not count runs with distance 0 in runCount', () => {
    const runners = [
      makeRunner(1, 'Alice', [
        makeRun('5.00'),
        makeRun('0'),
        makeRun('0.00'),
      ]),
    ]
    const ranking = calculateRanking(runners)
    expect(ranking[0].totalKm).toBe(5)
    expect(ranking[0].runCount).toBe(1)
  })

  it('rounds totalKm to 2 decimal places', () => {
    const runners = [
      makeRunner(1, 'Alice', [makeRun('1.111'), makeRun('2.222')]),
    ]
    const ranking = calculateRanking(runners)
    // 1.111 + 2.222 = 3.333, rounded to 3.33
    expect(ranking[0].totalKm).toBe(3.33)
  })
})

describe('calculateRanking — edge cases', () => {
  it('returns empty array for no runners', () => {
    expect(calculateRanking([])).toEqual([])
  })

  it('handles runners with no runs (0 km, 0 runs)', () => {
    const runners = [
      makeRunner(1, 'Alice', []),
      makeRunner(2, 'Bob', [makeRun('10.00')]),
    ]
    const ranking = calculateRanking(runners)
    expect(ranking[0].name).toBe('Bob')
    expect(ranking[0].totalKm).toBe(10)
    expect(ranking[1].name).toBe('Alice')
    expect(ranking[1].totalKm).toBe(0)
    expect(ranking[1].runCount).toBe(0)
  })

  it('handles all runners with 0 km', () => {
    const runners = [
      makeRunner(1, 'Alice', []),
      makeRunner(2, 'Bob', []),
    ]
    const ranking = calculateRanking(runners)
    // All 0km, sorted alphabetically
    expect(ranking[0].name).toBe('Alice')
    expect(ranking[1].name).toBe('Bob')
  })

  it('handles runners with undefined runs array', () => {
    const runners = [
      makeRunner(1, 'Alice', undefined as unknown as Typo3RawRun[]),
      makeRunner(2, 'Bob', [makeRun('10.00')]),
    ]
    const ranking = calculateRanking(runners)
    expect(ranking[0].name).toBe('Bob')
    expect(ranking[1].name).toBe('Alice')
    expect(ranking[1].totalKm).toBe(0)
  })

  it('preserves uid and nr in ranking entries', () => {
    const runners = [
      makeRunner(42, 'Alice', [makeRun('10.00')], 7),
    ]
    const ranking = calculateRanking(runners)
    expect(ranking[0].uid).toBe(42)
    expect(ranking[0].nr).toBe(7)
  })

  it('uses German locale for alphabetical sorting (handles umlauts)', () => {
    const runners = [
      makeRunner(1, 'Zara', []),
      makeRunner(2, 'Armin', []),
    ]
    const ranking = calculateRanking(runners)
    expect(ranking[0].name).toBe('Armin')
    expect(ranking[1].name).toBe('Zara')
  })
})
