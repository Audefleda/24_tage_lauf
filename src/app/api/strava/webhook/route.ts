// GET  /api/strava/webhook — Strava hub challenge verification (public)
// POST /api/strava/webhook — receives activity events from Strava (public, validated via subscription_id)

import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  STRAVA_VERIFY_TOKEN,
  ALLOWED_ACTIVITY_TYPES,
  getValidAccessToken,
  fetchStravaActivity,
} from '@/lib/strava'
import { fetchRunnerRuns, updateRunnerRuns } from '@/lib/typo3-runs'

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
  let body: {
    object_type?: string
    aspect_type?: string
    object_id?: number
    owner_id?: number
    subscription_id?: number
  }

  try {
    body = await request.json()
  } catch {
    // Malformed body — ignore silently
    return NextResponse.json({ ok: true })
  }

  // Only handle activity create events
  if (body.object_type !== 'activity' || body.aspect_type !== 'create') {
    return NextResponse.json({ ok: true })
  }

  const activityId = body.object_id
  const athleteId = body.owner_id
  const subscriptionId = body.subscription_id

  if (!activityId || !athleteId || !subscriptionId) {
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
    // No user has connected this Strava account — ignore
    return NextResponse.json({ ok: true })
  }

  // Look up user's TYPO3 runner profile
  const { data: profile } = await supabaseAdmin
    .from('runner_profiles')
    .select('typo3_uid')
    .eq('user_id', connection.user_id)
    .single()

  if (!profile) {
    // User has no TYPO3 runner assigned yet — ignore
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
        console.warn('[PROJ-5] Activity not found:', activityId)
        return
      }

      // Filter by allowed activity types
      if (!ALLOWED_ACTIVITY_TYPES.has(activity.type)) {
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
    } catch (err) {
      // Log error but never throw — Strava must receive HTTP 200
      console.error('[PROJ-5] Error processing webhook event:', err)
    }
  })

  return NextResponse.json({ ok: true })
}
