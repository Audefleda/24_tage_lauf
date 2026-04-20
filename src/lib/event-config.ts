/**
 * Event configuration constants and helpers for the 24-Tage-Lauf.
 *
 * EVENT_START = 2026-04-20 (Monday)
 * EVENT_END   = 2026-05-14 (Thursday)
 * 25 days total, index 0..24
 */

/** First day of the event (inclusive) */
export const EVENT_START = new Date(2026, 3, 20) // April = month 3

/** Last day of the event (inclusive) */
export const EVENT_END = new Date(2026, 4, 14) // May = month 4

/** Total number of event days */
export const EVENT_DAYS = 25

/** Short German weekday names */
const WEEKDAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const

/**
 * Returns a Date for the given event day index (0 = 20.04.2026, 24 = 14.05.2026).
 * Returns null if the index is out of range.
 */
export function getDateForIndex(index: number): Date | null {
  if (index < 0 || index >= EVENT_DAYS || !Number.isInteger(index)) return null
  const date = new Date(EVENT_START)
  date.setDate(date.getDate() + index)
  return date
}

/**
 * Returns the event day index (0..24) for a given date string "YYYY-MM-DD ..." or "YYYY-MM-DD".
 * Returns -1 if the date is outside the event range.
 */
export function getIndexForDateStr(dateStr: string): number {
  const datePart = dateStr.split(' ')[0]
  if (!datePart) return -1
  const [yearStr, monthStr, dayStr] = datePart.split('-')
  if (!yearStr || !monthStr || !dayStr) return -1
  const date = new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr))
  const diff = Math.round(
    (date.getTime() - EVENT_START.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (diff < 0 || diff >= EVENT_DAYS) return -1
  return diff
}

/** Format a Date to "DD.MM.YYYY" */
export function formatDateDE(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}

/** Get short German weekday for a Date */
export function getWeekdayShort(date: Date): string {
  return WEEKDAY_SHORT[date.getDay()]
}

/** Format a Date as "YYYY-MM-DD 06:00:00" for the TYPO3 API */
export function toTypo3DateStr(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day} 06:00:00`
}

/** Format distance number to German string "5,50" */
export function formatDistanceDE(distance: number): string {
  return distance.toFixed(2).replace('.', ',')
}

/**
 * Build the complete list of 25 event days with matched run data.
 * Returns an array of { index, date, weekday, formattedDate, distance } for each day.
 */
export function buildEventDays(
  runs: { runDate: string; runDistance: string }[]
): EventDay[] {
  // Build a map from "YYYY-MM-DD" to distance
  const runMap = new Map<string, number>()
  for (const run of runs) {
    if (!run.runDate) continue
    const datePart = run.runDate.split(' ')[0]
    if (!datePart) continue
    const dist = parseFloat(run.runDistance)
    if (!isNaN(dist) && dist > 0) {
      runMap.set(datePart, dist)
    }
  }

  const days: EventDay[] = []
  for (let i = 0; i < EVENT_DAYS; i++) {
    const date = getDateForIndex(i)!
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateKey = `${year}-${month}-${day}`

    const distance = runMap.get(dateKey) ?? null

    days.push({
      index: i,
      date,
      weekday: getWeekdayShort(date),
      formattedDate: formatDateDE(date),
      distance,
    })
  }

  return days
}

export interface EventDay {
  /** 0..24 */
  index: number
  date: Date
  weekday: string
  formattedDate: string
  /** km or null if no run recorded */
  distance: number | null
}
