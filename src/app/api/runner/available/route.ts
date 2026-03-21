// GET /api/runner/available — Nicht-vergebene TYPO3-Laeufer fuer Selbstzuordnung
// Gibt Array von { uid, nr, name } zurueck, alphabetisch nach Name sortiert

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { typo3Fetch, Typo3Error } from '@/lib/typo3-client'
import { rateLimit } from '@/lib/rate-limit'

interface Typo3Runner {
  uid: number
  nr: number
  name: string
  totaldistance: string
  crdate: string
  runs: unknown[]
  totaldistanceFromArray: number
}

export async function GET(request: NextRequest) {
  // Rate limiting: 30 requests per 60 seconds per IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`runner-available:${ip}`, { limit: 30, windowSeconds: 60 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Anfragen. Bitte warten.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetIn) } }
    )
  }

  // Auth check — any logged-in user
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

  try {
    // 1. Fetch all TYPO3 runners
    const body = new URLSearchParams({
      type: '195',
      'request[extensionName]': 'SwitRunners',
      'request[pluginName]': 'User',
      'request[controller]': 'User',
      'request[action]': 'getdata',
      'request[arguments][eventtype]': '24d',
      'request[arguments][sumonly]': '1',
    })

    const resp = await typo3Fetch('/runnerget.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body.toString(),
    })

    if (!resp.ok) {
      return NextResponse.json(
        { error: `TYPO3 API antwortet mit HTTP ${resp.status}` },
        { status: 502 }
      )
    }

    const data: { runners: Typo3Runner[] } = await resp.json()

    // 2. Query all already-assigned typo3_uid values from runner_profiles
    // Use admin client to bypass RLS — we need to see ALL assigned UIDs, not just the current user's
    const supabaseAdmin = createAdminClient()
    const { data: assignedProfiles, error: dbError } = await supabaseAdmin
      .from('runner_profiles')
      .select('typo3_uid')

    if (dbError) {
      return NextResponse.json(
        { error: 'Datenbankfehler beim Laden der Zuordnungen' },
        { status: 500 }
      )
    }

    const assignedUids = new Set(
      (assignedProfiles ?? []).map((p) => p.typo3_uid)
    )

    // 3. Filter out already-assigned runners and sort alphabetically by name
    const available = data.runners
      .filter((r) => !assignedUids.has(r.uid))
      .map((r) => ({ uid: r.uid, nr: r.nr, name: r.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))

    return NextResponse.json(available)
  } catch (error) {
    if (error instanceof Typo3Error) {
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
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
