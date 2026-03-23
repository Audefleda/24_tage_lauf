// PUT /api/runner/runs — Replace all runs for the logged-in user
// Used by PROJ-3 (delete) and PROJ-4 (create/edit)
// Sends the complete runs array to TYPO3 updateruns endpoint

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { type RunPayload, updateRunnerRuns } from '@/lib/typo3-runs'
import { Typo3Error } from '@/lib/typo3-client'

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
      { error: 'Kein Läufer*in-Profil gefunden' },
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
      { error: 'Ungültiges Request-Format' },
      { status: 400 }
    )
  }

  // 4. Send to TYPO3 (shared logic also handles logging)
  try {
    await updateRunnerRuns(profile.typo3_uid, runs)
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
