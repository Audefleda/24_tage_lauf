import { describe, it, expect } from 'vitest'
import {
  getDateForIndex,
  getIndexForDateStr,
  formatDateDE,
  getWeekdayShort,
  toTypo3DateStr,
  formatDistanceDE,
  buildEventDays,
  EVENT_DAYS,
} from './event-config'

describe('getDateForIndex', () => {
  it('index 0 returns the first event day (2026-04-20)', () => {
    const date = getDateForIndex(0)!
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(3) // April = 3
    expect(date.getDate()).toBe(20)
  })

  it('index 24 returns the last event day (2026-05-14)', () => {
    const date = getDateForIndex(24)!
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(4) // May = 4
    expect(date.getDate()).toBe(14)
  })

  it('returns null for index -1', () => {
    expect(getDateForIndex(-1)).toBeNull()
  })

  it('returns null for index equal to EVENT_DAYS (25)', () => {
    expect(getDateForIndex(EVENT_DAYS)).toBeNull()
  })

  it('returns null for a non-integer index', () => {
    expect(getDateForIndex(1.5)).toBeNull()
  })

  it('covers all 25 days without gaps', () => {
    const dates = Array.from({ length: EVENT_DAYS }, (_, i) => getDateForIndex(i))
    expect(dates.every((d) => d !== null)).toBe(true)
    // Each consecutive date is exactly one day apart
    for (let i = 1; i < EVENT_DAYS; i++) {
      const diff = (dates[i]!.getTime() - dates[i - 1]!.getTime()) / (1000 * 60 * 60 * 24)
      expect(diff).toBe(1)
    }
  })
})

describe('getIndexForDateStr', () => {
  it('returns 0 for the first event day', () => {
    expect(getIndexForDateStr('2026-04-20')).toBe(0)
  })

  it('returns 24 for the last event day', () => {
    expect(getIndexForDateStr('2026-05-14')).toBe(24)
  })

  it('handles TYPO3 datetime format with space separator', () => {
    expect(getIndexForDateStr('2026-04-20 06:00:00')).toBe(0)
    expect(getIndexForDateStr('2026-05-14 06:00:00')).toBe(24)
  })

  it('returns -1 for a date before the event', () => {
    expect(getIndexForDateStr('2026-04-19')).toBe(-1)
  })

  it('returns -1 for a date after the event', () => {
    expect(getIndexForDateStr('2026-05-15')).toBe(-1)
  })

  it('returns -1 for an empty string', () => {
    expect(getIndexForDateStr('')).toBe(-1)
  })

  it('is consistent with getDateForIndex (round-trip)', () => {
    for (let i = 0; i < EVENT_DAYS; i++) {
      const date = getDateForIndex(i)!
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      expect(getIndexForDateStr(`${year}-${month}-${day}`)).toBe(i)
    }
  })
})

describe('formatDateDE', () => {
  it('formats a date as DD.MM.YYYY', () => {
    expect(formatDateDE(new Date(2026, 3, 20))).toBe('20.04.2026')
  })

  it('zero-pads day and month', () => {
    expect(formatDateDE(new Date(2026, 0, 5))).toBe('05.01.2026')
  })
})

describe('getWeekdayShort', () => {
  it('returns "Mo" for Monday (2026-04-20)', () => {
    expect(getWeekdayShort(new Date(2026, 3, 20))).toBe('Mo')
  })

  it('returns "Do" for Thursday (2026-05-14)', () => {
    expect(getWeekdayShort(new Date(2026, 4, 14))).toBe('Do')
  })

  it('returns "So" for Sunday', () => {
    expect(getWeekdayShort(new Date(2026, 3, 26))).toBe('So') // April 26 = Sunday
  })
})

describe('toTypo3DateStr', () => {
  it('formats date as "YYYY-MM-DD 06:00:00"', () => {
    expect(toTypo3DateStr(new Date(2026, 3, 20))).toBe('2026-04-20 06:00:00')
  })

  it('zero-pads month and day', () => {
    expect(toTypo3DateStr(new Date(2026, 0, 5))).toBe('2026-01-05 06:00:00')
  })
})

describe('formatDistanceDE', () => {
  it('formats with 2 decimal places and German comma', () => {
    expect(formatDistanceDE(5.5)).toBe('5,50')
    expect(formatDistanceDE(10)).toBe('10,00')
    expect(formatDistanceDE(8.4)).toBe('8,40')
  })
})

describe('buildEventDays', () => {
  it('always returns exactly 25 days', () => {
    expect(buildEventDays([])).toHaveLength(25)
  })

  it('sets distance to null for days with no run', () => {
    const days = buildEventDays([])
    expect(days.every((d) => d.distance === null)).toBe(true)
  })

  it('maps a run to the correct day index', () => {
    const days = buildEventDays([{ runDate: '2026-04-20', runDistance: '5.50' }])
    expect(days[0].distance).toBe(5.5)
    expect(days[1].distance).toBeNull()
  })

  it('handles TYPO3 datetime format with space separator', () => {
    const days = buildEventDays([{ runDate: '2026-04-20 06:00:00', runDistance: '8.40' }])
    expect(days[0].distance).toBe(8.4)
  })

  it('ignores runs with distance 0', () => {
    const days = buildEventDays([{ runDate: '2026-04-20', runDistance: '0' }])
    expect(days[0].distance).toBeNull()
  })

  it('ignores runs with non-numeric distance', () => {
    const days = buildEventDays([{ runDate: '2026-04-20', runDistance: 'abc' }])
    expect(days[0].distance).toBeNull()
  })

  it('ignores runs outside the event date range', () => {
    const days = buildEventDays([{ runDate: '2026-03-01', runDistance: '5.0' }])
    expect(days.every((d) => d.distance === null)).toBe(true)
  })

  it('sets correct index, weekday, and formattedDate for each day', () => {
    const days = buildEventDays([])
    expect(days[0].index).toBe(0)
    expect(days[0].formattedDate).toBe('20.04.2026')
    expect(days[0].weekday).toBe('Mo')
    expect(days[24].index).toBe(24)
    expect(days[24].formattedDate).toBe('14.05.2026')
  })
})
