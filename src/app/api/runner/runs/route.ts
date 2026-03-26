// PUT /api/runner/runs — Replace all runs for the logged-in user
// Used by PROJ-3 (delete) and PROJ-4 (create/edit)
// Sends the complete runs array to TYPO3 updateruns endpoint

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { type RunPayload, updateRunnerRuns } from '@/lib/typo3-runs'
import { Typo3Error } from '@/lib/typo3-client'
import { sendTeamsNotification } from '@/lib/teams-notification'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const NotifyRunSchema = z.object({
  runDate: z.string().min(1),
  runDistance: z.string().min(1),
})

export async function PUT(request: NextRequest) {
  // 1. Rate limiting: 30 requests per 60 seconds per IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`runner-runs:${ip}`, { limit: 30, windowSeconds: 60 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Anfragen. Bitte warten.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetIn) } }
    )
  }

  // 2. Authenticate
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

  // 3. Get runner profile
  const { data: profile, error: profileError } = await supabase
    .from('runner_profiles')
    .select('typo3_uid, teams_notifications_enabled')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'Kein Läufer*in-Profil gefunden' },
      { status: 404 }
    )
  }

  // 4. Parse and validate request body
  let runs: RunPayload[]
  let notifyRun: { runDate: string; runDistance: string } | undefined
  try {
    const body = await request.json()
    runs = body.runs
    if (!Array.isArray(runs)) {
      throw new Error('runs muss ein Array sein')
    }
    // Optional: validate notifyRun with Zod if present (BUG-1 fix)
    if (body.notifyRun !== undefined) {
      const result = NotifyRunSchema.safeParse(body.notifyRun)
      if (result.success) {
        notifyRun = result.data
      }
    }
  } catch {
    return NextResponse.json(
      { error: 'Ungültiges Request-Format' },
      { status: 400 }
    )
  }

  // 5. Send to TYPO3 (shared logic also handles logging)
  try {
    // PROJ-19: Teams notification vor TYPO3 — wird auch bei TYPO3-Fehler gesendet
    if (notifyRun) {
      await sendTeamsNotification({
        typo3Uid: profile.typo3_uid,
        runDate: notifyRun.runDate.split(' ')[0],
        runDistanceKm: notifyRun.runDistance,
        teamsNotificationsEnabled: profile.teams_notifications_enabled,
      })
    }

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
