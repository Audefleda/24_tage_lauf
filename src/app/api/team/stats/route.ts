// GET /api/team/stats — Team total km with 100km cap per runner (PROJ-26)
// Returns the capped team total for the BettercallPaul company reimbursement display.
// Accessible by any authenticated user (not admin-only).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { typo3Fetch, Typo3Error } from '@/lib/typo3-client'
import { rateLimit } from '@/lib/rate-limit'
import { debug, error as logError } from '@/lib/logger'

/** Maximum reimbursable km per runner (company cap) */
const REIMBURSEMENT_CAP_KM = 100

interface Typo3RawRun {
  rundate: string
  rundateObj: string
  distance: string
}

interface Typo3Runner {
  uid: number
  name: string
  totaldistance: string
  runs: Typo3RawRun[]
}

/** Sum individual run distances for a runner (consistent with PROJ-19 fix dbf5a94) */
function sumRunsKm(runs: Typo3RawRun[]): number {
  return runs.reduce((sum, r) => {
    const dist = parseFloat((r.distance ?? '0').replace(',', '.'))
    return sum + (isNaN(dist) ? 0 : dist)
  }, 0)
}

export async function GET(request: NextRequest) {
  // 1. Rate limiting: 30 requests per 60 seconds per IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`team-stats:${ip}`, { limit: 30, windowSeconds: 60 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Anfragen. Bitte warten.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetIn) } }
    )
  }

  // 2. Authentication check — any logged-in user can access this
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Nicht authentifiziert' },
      { status: 401 }
    )
  }

  // 3. Fetch all runners from TYPO3 (without sumonly so we get individual runs)
  try {
    const body = new URLSearchParams({
      type: '195',
      'request[extensionName]': 'SwitRunners',
      'request[pluginName]': 'User',
      'request[controller]': 'User',
      'request[action]': 'getdata',
      'request[arguments][eventtype]': '24d',
    })

    debug('team-stats', 'Lade alle Laeufer*innen von TYPO3')

    const resp = await typo3Fetch('/runnerget.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: body.toString(),
    })

    if (!resp.ok) {
      logError('team-stats', `TYPO3 API antwortet mit HTTP ${resp.status}`)
      return NextResponse.json(
        { error: `TYPO3 API antwortet mit HTTP ${resp.status}` },
        { status: 503 }
      )
    }

    const data: { runners: Typo3Runner[] } = await resp.json()
    const runners = data.runners ?? []

    // 4. Calculate capped team total: sum(min(runnerKm, 100)) for all runners
    const totalKm = runners.reduce((sum, runner) => {
      const runnerKm = sumRunsKm(runner.runs ?? [])
      return sum + Math.min(runnerKm, REIMBURSEMENT_CAP_KM)
    }, 0)

    // Round to 2 decimal places to avoid floating point artifacts
    const totalKmRounded = Math.round(totalKm * 100) / 100

    debug('team-stats', 'Team-Gesamtkilometer berechnet', {
      runnerCount: runners.length,
      totalKm: totalKmRounded,
    })

    return NextResponse.json({ totalKm: totalKmRounded })
  } catch (err) {
    if (err instanceof Typo3Error) {
      logError('team-stats', err.message)
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    logError('team-stats', 'Unerwarteter Fehler', err)
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'TYPO3-Verbindung fehlgeschlagen',
      },
      { status: 500 }
    )
  }
}
