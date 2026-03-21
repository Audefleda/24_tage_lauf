// PUT /api/runner/runs — Replace all runs for the logged-in user
// Used by PROJ-3 (delete) and PROJ-4 (create/edit)
// Sends the complete runs array to TYPO3 updateruns endpoint

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { typo3Fetch, Typo3Error } from '@/lib/typo3-client'

interface RunPayload {
  runDate: string
  runDistance: string
}

/** Log a TYPO3 updateruns request to Supabase (fire-and-forget, never throws) */
async function logTypo3Request(params: {
  typo3RunnerUid: number
  runs: RunPayload[]
  httpStatus: number | null
  responseText: string
}) {
  try {
    const supabaseAdmin = createAdminClient()

    // One log entry per request (not per individual run).
    // Store the first run's date/distance as representative, or use a summary.
    // Per spec edge case: "Pro Laeufer-Request ein Log-Eintrag (nicht pro Einzellauf)"
    // We log each run individually for better traceability.
    const entries = params.runs.map((run) => ({
      typo3_runner_uid: params.typo3RunnerUid,
      run_date: run.runDate.split(' ')[0], // extract date part from "YYYY-MM-DD HH:MM:SS"
      run_distance_km: parseFloat(run.runDistance) || 0,
      http_status: params.httpStatus,
      response_text: params.responseText,
    }))

    // If there are no runs in the payload, still log with a placeholder
    if (entries.length === 0) {
      entries.push({
        typo3_runner_uid: params.typo3RunnerUid,
        run_date: new Date().toISOString().split('T')[0],
        run_distance_km: 0,
        http_status: params.httpStatus,
        response_text: params.responseText,
      })
    }

    const { error } = await supabaseAdmin
      .from('typo3_request_log')
      .insert(entries)

    if (error) {
      console.error('[PROJ-8] Failed to write TYPO3 request log:', error.message)
    }
  } catch (err) {
    // Logging must never break the main flow
    console.error('[PROJ-8] Unexpected error in logTypo3Request:', err)
  }
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

    const responseText = await resp.text()

    // Log every TYPO3 request (success or failure)
    await logTypo3Request({
      typo3RunnerUid: profile.typo3_uid,
      runs,
      httpStatus: resp.status,
      responseText: responseText.slice(0, 2000), // truncate to avoid huge logs
    })

    if (!resp.ok) {
      return NextResponse.json(
        { error: `TYPO3 API antwortet mit HTTP ${resp.status}` },
        { status: 502 }
      )
    }

    // Parse the already-read response text as JSON
    let typo3Body: { success?: boolean; message?: string } | null = null
    try {
      typo3Body = JSON.parse(responseText)
    } catch {
      // not JSON — that's ok
    }

    if (typo3Body && typo3Body.success === false) {
      return NextResponse.json(
        { error: typo3Body.message ?? 'TYPO3 hat den Speichervorgang abgelehnt' },
        { status: 422 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    // Log timeout / network errors
    await logTypo3Request({
      typo3RunnerUid: profile.typo3_uid,
      runs,
      httpStatus: null,
      responseText: error instanceof Error ? error.message : 'Unknown error',
    })

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
