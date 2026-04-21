// PUT /api/runner/runs — Update a single run for the logged-in user
// Uses server-side read-modify-write with per-user mutex to prevent race conditions.
// The client sends only the changed run { runDate, runDistance }.
// The server fetches the current list from TYPO3, applies the change, and writes back.

import { NextResponse, type NextRequest, after } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { fetchRunnerRuns, updateRunnerRuns } from '@/lib/typo3-runs'
import { Typo3Error } from '@/lib/typo3-client'
import { sendTeamsNotification } from '@/lib/teams-notification'
import { withUserLock } from '@/lib/typo3-mutex'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const PutBodySchema = z.object({
  runDate: z.string().min(1),
  runDistance: z.string().regex(/^\d+(\.\d+)?$/, 'Ungültige Distanz'),
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
  let change: { runDate: string; runDistance: string }
  try {
    const body = await request.json()
    const result = PutBodySchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: 'Ungültige Laufdaten' }, { status: 400 })
    }
    change = result.data
  } catch {
    return NextResponse.json(
      { error: 'Ungültiges Request-Format' },
      { status: 400 }
    )
  }

  // 5. Read-modify-write inside per-user mutex
  try {
    await withUserLock(user.id, async () => {
      const existing = await fetchRunnerRuns(profile.typo3_uid)

      const targetDatePart = change.runDate.split(' ')[0]

      const filtered = existing.filter(
        (r) => r.runDate && r.runDate.split(' ')[0] !== targetDatePart
      )
      const updatedRuns = [...filtered, { runDate: change.runDate, runDistance: change.runDistance }]

      await updateRunnerRuns(profile.typo3_uid, updatedRuns)
    })

    // PROJ-19: Teams notification after successful TYPO3 update — non-blocking
    const distance = parseFloat(change.runDistance)
    if (distance > 0) {
      const notifyPayload = {
        typo3Uid: profile.typo3_uid,
        runDate: change.runDate.split(' ')[0],
        runDistanceKm: change.runDistance,
        teamsNotificationsEnabled: profile.teams_notifications_enabled,
      }
      after(() => sendTeamsNotification(notifyPayload))
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
