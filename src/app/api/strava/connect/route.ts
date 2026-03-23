// GET  /api/strava/connect  — redirect to Strava OAuth
// DELETE /api/strava/connect — disconnect (delete strava_connections row)

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getStravaOAuthUrl } from '@/lib/strava'
import { rateLimit } from '@/lib/rate-limit'

const STATE_COOKIE = 'strava_oauth_state'
const STATE_TTL_SECONDS = 600 // 10 minutes

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  // BUG-4 fix: rate limit OAuth initiations per user (5 per 60s)
  const rl = rateLimit(`strava_connect:${user.id}`, { limit: 5, windowSeconds: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte warte kurz.' }, { status: 429 })
  }

  const origin = request.nextUrl.origin

  // BUG-2 fix: generate CSRF state token, store in httpOnly cookie
  const state = crypto.randomUUID()
  const url = getStravaOAuthUrl(origin, state)

  const response = NextResponse.redirect(url)
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: STATE_TTL_SECONDS,
    path: '/',
  })
  return response
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  // BUG-4 fix: rate limit disconnect per user (5 per 60s)
  const rl = rateLimit(`strava_disconnect:${user.id}`, { limit: 5, windowSeconds: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte warte kurz.' }, { status: 429 })
  }

  const { error: deleteError } = await supabase
    .from('strava_connections')
    .delete()
    .eq('user_id', user.id)

  if (deleteError) {
    console.error('[PROJ-5] Failed to delete strava connection:', deleteError.message)
    return NextResponse.json({ error: 'Verbindung konnte nicht getrennt werden' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
