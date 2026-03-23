// GET  /api/strava/webhook — Strava hub challenge verification (public)
// POST /api/strava/webhook — receives activity events from Strava (public, validated via subscription_id)

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  STRAVA_VERIFY_TOKEN,
  ALLOWED_ACTIVITY_TYPES,
  getValidAccessToken,
  fetchStravaActivity,
} from '@/lib/strava'
import { fetchRunnerRuns, updateRunnerRuns } from '@/lib/typo3-runs'
import * as logger from '@/lib/logger'

// BUG-5 fix: Zod schema for incoming Strava webhook event
const StravaEventSchema = z.object({
  object_type: z.string(),
  aspect_type: z.string(),
  object_id: z.number(),
  owner_id: z.number(),
  subscription_id: z.number(),
})

// ---------------------------------------------------------------------------
// Per-user in-memory mutex (serializes concurrent webhook events for same user)
// Note: effective within a single Vercel function instance only.
// For a 5–30 user app, this is sufficient.
// ---------------------------------------------------------------------------
const userLocks = new Map<string, Promise<void>>()

async function processWithLock(userId: string, fn: () => Promise<void>): Promise<void> {
  // Read previous lock and set new one atomically (before any await)
  const previous = userLocks.get(userId) ?? Promise.resolve()
  let resolveMyLock!: () => void
  const myLock = new Promise<void>((resolve) => {
    resolveMyLock = resolve
  })
  userLocks.set(userId, myLock)

  // Wait for the previous operation to finish
  await previous.catch(() => {}) // swallow errors from the previous task

  try {
    await fn()
  } finally {
    resolveMyLock()
    // Clean up map entry if no other task has replaced ours
    if (userLocks.get(userId) === myLock) {
      userLocks.delete(userId)
    }
  }
}

// ---------------------------------------------------------------------------
// GET — Strava hub challenge verification
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const mode = searchParams.get('hub.mode')
  const challenge = searchParams.get('hub.challenge')
  const verifyToken = searchParams.get('hub.verify_token')

  if (mode !== 'subscribe' || verifyToken !== STRAVA_VERIFY_TOKEN || !challenge) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
  }

  return NextResponse.json({ 'hub.challenge': challenge })
}

// ---------------------------------------------------------------------------
// POST — Strava activity event
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  // Always respond 200 to Strava — errors are logged internally
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  // BUG-5 fix: validate body shape with Zod before processing
  const parsed = StravaEventSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ ok: true })
  }

  const { object_type, aspect_type, object_id: activityId, owner_id: athleteId, subscription_id: subscriptionId } = parsed.data

  logger.debug('strava', 'Webhook-Event empfangen', { object_type, aspect_type, activityId, athleteId, subscriptionId })

  // Only handle activity create events
  if (object_type !== 'activity' || aspect_type !== 'create') {
    logger.debug('strava', 'Webhook-Event ignoriert (kein activity:create)', { object_type, aspect_type })
    return NextResponse.json({ ok: true })
  }

  // Validate subscription_id against stored value (Option B from spec)
  const supabaseAdmin = createAdminClient()
  const { data: setting } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'strava_subscription_id')
    .single()

  if (!setting || String(subscriptionId) !== setting.value) {
    console.warn('[PROJ-5] Webhook received unknown subscription_id:', subscriptionId)
    return NextResponse.json({ ok: true })
  }

  // Look up user by athlete_id
  const { data: connection } = await supabaseAdmin
    .from('strava_connections')
    .select('user_id, athlete_id, access_token, refresh_token, token_expires_at')
    .eq('athlete_id', athleteId)
    .single()

  if (!connection) {
    logger.debug('strava', 'Webhook-Event ignoriert (kein User für athleteId)', { athleteId })
    return NextResponse.json({ ok: true })
  }

  // Look up user's TYPO3 runner profile
  const { data: profile } = await supabaseAdmin
    .from('runner_profiles')
    .select('typo3_uid')
    .eq('user_id', connection.user_id)
    .single()

  if (!profile) {
    logger.debug('strava', 'Webhook-Event ignoriert (kein TYPO3-Profil)', { userId: connection.user_id })
    return NextResponse.json({ ok: true })
  }

  // Process the activity with a per-user lock to prevent race conditions
  await processWithLock(connection.user_id, async () => {
    try {
      // Refresh access token if needed
      const { access_token, newTokens } = await getValidAccessToken(connection)

      if (newTokens) {
        await supabaseAdmin
          .from('strava_connections')
          .update({
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token,
            token_expires_at: new Date(newTokens.expires_at * 1000).toISOString(),
          })
          .eq('user_id', connection.user_id)
      }

      // Fetch activity details from Strava
      const activity = await fetchStravaActivity(activityId, access_token)

      if (!activity) {
        logger.debug('strava', 'Aktivität nicht gefunden', { activityId })
        return
      }

      logger.debug('strava', 'Aktivitätsdetails abgerufen', { activityId, type: activity.type, distance: activity.distance, date: activity.start_date })

      // Filter by allowed activity types
      if (!ALLOWED_ACTIVITY_TYPES.has(activity.type)) {
        logger.debug('strava', 'Aktivitätstyp ignoriert', { type: activity.type, activityId })
        return
      }

      // Fetch existing runs from TYPO3
      const existingRuns = await fetchRunnerRuns(profile.typo3_uid)

      // Build new run: date (YYYY-MM-DD) and distance (km, 2 decimal places)
      const newRun = {
        runDate: activity.start_date.split('T')[0],
        runDistance: (activity.distance / 1000).toFixed(2),
      }

      // Append and write back all runs
      const updatedRuns = [...existingRuns, newRun]
      await updateRunnerRuns(profile.typo3_uid, updatedRuns)

      // Update last_synced_at
      await supabaseAdmin
        .from('strava_connections')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('user_id', connection.user_id)

      logger.debug('strava', 'Webhook-Event verarbeitet', { activityId, runDate: newRun.runDate, runDistance: newRun.runDistance })
    } catch (err) {
      logger.error('strava', 'Fehler beim Verarbeiten des Webhook-Events', err)
    }
  })

  return NextResponse.json({ ok: true })
}
