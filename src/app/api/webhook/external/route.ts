// PROJ-23: External webhook endpoint for Make.com / Zapier / curl
// POST /api/webhook/external — accepts Bearer token, creates run in TYPO3

import { NextResponse, type NextRequest, after } from 'next/server'
import { z } from 'zod'
import { createHash, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase-admin'
import { fetchRunnerRuns, updateRunnerRuns } from '@/lib/typo3-runs'
import { Typo3Error } from '@/lib/typo3-client'
import { sendTeamsNotification } from '@/lib/teams-notification'
import { withUserLock } from '@/lib/typo3-mutex'
import { rateLimit } from '@/lib/rate-limit'
import * as logger from '@/lib/logger'

const ExternalRunSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum muss im Format YYYY-MM-DD sein')
    .refine((d) => {
      const parsed = new Date(d + 'T00:00:00Z')
      return !isNaN(parsed.getTime()) && d === parsed.toISOString().split('T')[0]
    }, 'Ungueltiges Datum'),
  distance_km: z
    .number({ error: 'distance_km muss eine Zahl sein' })
    .finite()
    .nonnegative()
    .max(1000, 'distance_km darf maximal 1000 km betragen'),
})

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function POST(request: NextRequest) {
  // 1. Rate limiting: 60 requests per 60 seconds per IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`webhook-external:${ip}`, { limit: 60, windowSeconds: 60 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Anfragen. Bitte warten.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetIn) } }
    )
  }

  const supabaseAdmin = createAdminClient()

  // 2. Globalen Aktivierungsstatus prüfen (fail-fast)
  const { data: enabledSetting } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'external_webhook_enabled')
    .single()

  const webhookEnabled = enabledSetting ? enabledSetting.value !== 'false' : true
  if (!webhookEnabled) {
    return NextResponse.json(
      { error: 'Der externe Webhook ist derzeit deaktiviert. Bitte wende dich an den Administrator.' },
      { status: 503 }
    )
  }

  // 3. Extract Bearer token from Authorization header
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Authorization-Header fehlt oder ungueltig. Erwartet: Bearer <token>' },
      { status: 401 }
    )
  }

  const plainToken = authHeader.slice(7).trim()
  if (!plainToken) {
    return NextResponse.json(
      { error: 'Token ist leer' },
      { status: 401 }
    )
  }

  // 4. Hash incoming token and look up in DB
  const tokenHash = hashToken(plainToken)

  const { data: tokenRow } = await supabaseAdmin
    .from('external_webhook_tokens')
    .select('user_id, token_hash')
    .eq('token_hash', tokenHash)
    .single()

  if (
    !tokenRow ||
    !timingSafeEqual(Buffer.from(tokenHash, 'hex'), Buffer.from(tokenRow.token_hash, 'hex'))
  ) {
    return NextResponse.json(
      { error: 'Ungueltiger Token' },
      { status: 401 }
    )
  }

  // 4. Parse and validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Ungueltiges JSON im Request-Body' },
      { status: 422 }
    )
  }

  const parsed = ExternalRunSchema.safeParse(body)
  if (!parsed.success) {
    const errors = parsed.error.issues.map((e) => e.message).join('; ')
    return NextResponse.json(
      { error: `Validierungsfehler: ${errors}` },
      { status: 422 }
    )
  }

  const { date, distance_km } = parsed.data

  // 5. Look up TYPO3 runner profile for this user
  const { data: profile } = await supabaseAdmin
    .from('runner_profiles')
    .select('typo3_uid, teams_notifications_enabled')
    .eq('user_id', tokenRow.user_id)
    .single()

  if (!profile) {
    return NextResponse.json(
      { error: 'Kein TYPO3-Laeuferprofil zugeordnet' },
      { status: 422 }
    )
  }

  // 6. Fetch existing runs and append the new one (with per-user mutex)
  try {
    await withUserLock(tokenRow.user_id, async () => {
      const existingRuns = await fetchRunnerRuns(profile.typo3_uid)

      const newRun = {
        runDate: date,
        runDistance: distance_km.toFixed(2),
      }

      const updatedRuns = [
        ...existingRuns.filter((r) => r.runDate !== date),
        newRun,
      ]
      await updateRunnerRuns(profile.typo3_uid, updatedRuns)
    })

    logger.debug('webhook-external', 'Lauf eingetragen', {
      typo3Uid: profile.typo3_uid,
      date,
      distance_km,
    })

    // PROJ-19: Teams notification (non-blocking)
    const notifyPayload = {
      typo3Uid: profile.typo3_uid,
      runDate: date,
      runDistanceKm: distance_km.toFixed(2),
      teamsNotificationsEnabled: profile.teams_notifications_enabled,
    }
    after(() => sendTeamsNotification(notifyPayload))

    return NextResponse.json({ ok: true, date, distance_km })
  } catch (error) {
    if (error instanceof Typo3Error) {
      logger.error('webhook-external', 'TYPO3-Fehler', error)
      return NextResponse.json(
        { error: `TYPO3-Fehler: ${error.message}` },
        { status: 500 }
      )
    }
    logger.error('webhook-external', 'Unerwarteter Fehler', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 }
    )
  }
}
