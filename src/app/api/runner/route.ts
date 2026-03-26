// GET /api/runner — Fetch the logged-in user's runner data (including runs) from TYPO3
// Returns runner name, uid, and runs array

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { typo3Fetch, Typo3Error } from '@/lib/typo3-client'

interface Typo3Run {
  runDate: string
  runDistance: string
}

interface Typo3Runner {
  uid: number
  nr: number
  name: string
  age?: number
  totaldistance: string
  crdate: string
  runs: Typo3Run[]
  totaldistanceFromArray: number
}

export async function GET() {
  // 1. Get current user from Supabase session
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

  // 2. Get runner profile (typo3_uid) for this user
  const { data: profile, error: profileError } = await supabase
    .from('runner_profiles')
    .select('typo3_uid, teams_notifications_enabled')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      {
        error:
          'Kein Läufer*in-Profil gefunden. Bitte Admin kontaktieren.',
      },
      { status: 404 }
    )
  }

  // 3. Fetch all runners from TYPO3 API (no per-runner endpoint available)
  try {
    const body = new URLSearchParams({
      type: '195',
      'request[extensionName]': 'SwitRunners',
      'request[pluginName]': 'User',
      'request[controller]': 'User',
      'request[action]': 'getdata',
      'request[arguments][eventtype]': '24d',
    })

    const resp = await typo3Fetch('/runnerget.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: body.toString(),
    })

    if (!resp.ok) {
      return NextResponse.json(
        { error: `TYPO3 API antwortet mit HTTP ${resp.status}` },
        { status: 502 }
      )
    }

    const data: { runners: Typo3Runner[] } = await resp.json()

    // 4. Find this user's runner by typo3_uid
    const runner = data.runners.find((r) => r.uid === profile.typo3_uid)

    if (!runner) {
      return NextResponse.json(
        {
          error: `Läufer*in mit UID ${profile.typo3_uid} nicht in TYPO3 gefunden`,
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      uid: runner.uid,
      name: runner.name,
      age: (Number(runner.age) > 0 ? Number(runner.age) : null),
      runs: runner.runs ?? [],
      teamsNotificationsEnabled: profile.teams_notifications_enabled,
    })
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
