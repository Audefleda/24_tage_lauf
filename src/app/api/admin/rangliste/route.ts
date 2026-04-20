// GET /api/admin/rangliste — Rangliste aller Laeufer*innen (PROJ-27)
// Holt alle Laeufer mit Laeufen von TYPO3, berechnet Gesamtkilometer
// und Anzahl Laeufe im Event-Zeitraum, sortiert nach km desc.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { typo3Fetch, Typo3Error } from '@/lib/typo3-client'
import { rateLimit } from '@/lib/rate-limit'
import { debug, error as logError } from '@/lib/logger'

/** Event period: 2026-04-20 to 2026-05-14 inclusive */
const EVENT_START = '2026-04-20'
const EVENT_END = '2026-05-14'

interface Typo3RawRun {
  rundate: string
  rundateObj: string
  distance: string
}

interface Typo3Runner {
  uid: number
  nr: number
  name: string
  totaldistance: string
  runs: Typo3RawRun[]
}

interface RankingEntry {
  rank: number
  uid: number
  nr: number
  name: string
  totalKm: number
  runCount: number
}

/** Check if a run date falls within the event period */
function isInEventPeriod(rundate: string): boolean {
  // rundate format: "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD"
  const datePart = rundate.split(' ')[0]
  if (!datePart) return false
  return datePart >= EVENT_START && datePart <= EVENT_END
}

export async function GET(request: NextRequest) {
  // 1. Rate limiting: 30 requests per 60 seconds per IP
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`admin-rangliste:${ip}`, {
    limit: 30,
    windowSeconds: 60,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Anfragen. Bitte warten.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetIn) } }
    )
  }

  // 2. Admin-Check
  const check = await requireAdmin()
  if (!check.authorized) {
    return NextResponse.json(
      { error: check.message },
      { status: check.status }
    )
  }

  try {
    // 3. Fetch all runners with runs from TYPO3 (without sumonly to get individual runs)
    const body = new URLSearchParams({
      type: '195',
      'request[extensionName]': 'SwitRunners',
      'request[pluginName]': 'User',
      'request[controller]': 'User',
      'request[action]': 'getdata',
      'request[arguments][eventtype]': '24d',
    })

    debug('admin-rangliste', 'Lade alle Laeufer*innen mit Laeufen von TYPO3')

    const resp = await typo3Fetch('/runnerget.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: body.toString(),
    })

    if (!resp.ok) {
      logError(
        'admin-rangliste',
        `TYPO3 API antwortet mit HTTP ${resp.status}`
      )
      return NextResponse.json(
        { error: `TYPO3 API antwortet mit HTTP ${resp.status}` },
        { status: 502 }
      )
    }

    const data: { runners: Typo3Runner[] } = await resp.json()
    const runners = data.runners ?? []

    // 4. Calculate per-runner stats (only runs within event period)
    const entries: Omit<RankingEntry, 'rank'>[] = runners.map((runner) => {
      const eventRuns = (runner.runs ?? []).filter((r) =>
        isInEventPeriod(r.rundateObj ?? r.rundate ?? '')
      )

      const totalKm = eventRuns.reduce((sum, r) => {
        const dist = parseFloat((r.distance ?? '0').replace(',', '.'))
        return sum + (isNaN(dist) ? 0 : dist)
      }, 0)

      // Count only runs with distance > 0
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

    // 5. Sort: km desc, then runCount desc, then name alphabetically
    entries.sort((a, b) => {
      if (b.totalKm !== a.totalKm) return b.totalKm - a.totalKm
      if (b.runCount !== a.runCount) return b.runCount - a.runCount
      return a.name.localeCompare(b.name, 'de')
    })

    // 6. Assign ranks
    const ranking: RankingEntry[] = entries.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }))

    debug('admin-rangliste', 'Rangliste berechnet', {
      runnerCount: ranking.length,
      activeRunners: ranking.filter((r) => r.totalKm > 0).length,
    })

    return NextResponse.json(ranking)
  } catch (error) {
    if (error instanceof Typo3Error) {
      logError('admin-rangliste', error.message)
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
    logError('admin-rangliste', 'Unerwarteter Fehler', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'TYPO3-Verbindung fehlgeschlagen',
      },
      { status: 500 }
    )
  }
}
