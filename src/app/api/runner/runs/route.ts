// PUT /api/runner/runs — Replace all runs for the logged-in user
// Used by PROJ-3 (delete) and PROJ-4 (create/edit)
// Sends the complete runs array to TYPO3 updateruns endpoint

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { typo3Fetch, Typo3Error } from '@/lib/typo3-client'

interface RunPayload {
  runDate: string
  runDistance: string
}

export async function PUT(request: NextRequest) {
  // 1. Authenticate
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

  // 2. Get runner profile
  const { data: profile, error: profileError } = await supabase
    .from('runner_profiles')
    .select('typo3_uid')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'Kein Laeufer-Profil gefunden' },
      { status: 404 }
    )
  }

  // 3. Parse request body
  let runs: RunPayload[]
  try {
    const body = await request.json()
    runs = body.runs
    if (!Array.isArray(runs)) {
      throw new Error('runs muss ein Array sein')
    }
  } catch {
    return NextResponse.json(
      { error: 'Ungueltiges Request-Format' },
      { status: 400 }
    )
  }

  // 4. Send to TYPO3 updateruns
  try {
    const formBody = new URLSearchParams({
      type: '191',
      'request[extensionName]': 'SwitRunners',
      'request[pluginName]': 'User',
      'request[controller]': 'User',
      'request[action]': 'setdata',
      'request[arguments][perform]': 'updateruns',
      'request[arguments][userUid]': String(profile.typo3_uid),
      'request[arguments][runs]': JSON.stringify(runs),
    })

    const resp = await typo3Fetch('/userset.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: formBody.toString(),
    })

    if (!resp.ok) {
      return NextResponse.json(
        { error: `TYPO3 API antwortet mit HTTP ${resp.status}` },
        { status: 502 }
      )
    }

    const typo3Body = await resp.json().catch(() => null)
    if (typo3Body && typo3Body.success === false) {
      return NextResponse.json(
        { error: typo3Body.message ?? 'TYPO3 hat den Speichervorgang abgelehnt' },
        { status: 422 }
      )
    }

    return NextResponse.json({ ok: true })
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
