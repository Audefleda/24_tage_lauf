// GET /api/strava/callback — receives OAuth code from Strava, stores tokens
// Listed in PUBLIC_ROUTES in middleware; user session cookie provides identity.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { exchangeStravaCode } from '@/lib/strava'
import * as logger from '@/lib/logger'

const STATE_COOKIE = 'strava_oauth_state'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  // User denied access on Strava's authorization page
  if (errorParam) {
    return NextResponse.redirect(`${origin}/runs?strava=denied`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/runs?strava=error`)
  }

  // BUG-2 fix: validate CSRF state token
  const expectedState = request.cookies.get(STATE_COOKIE)?.value
  if (!expectedState || expectedState !== state) {
    console.error('[PROJ-5] OAuth state mismatch — possible CSRF attack')
    return NextResponse.redirect(`${origin}/runs?strava=error`)
  }

  // Identify the logged-in user via session cookie
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    // Session expired during OAuth flow — send back to login
    return NextResponse.redirect(`${origin}/login`)
  }

  try {
    const tokens = await exchangeStravaCode(code)

    logger.debug('strava', 'OAuth-Callback empfangen', { athleteId: tokens.athlete_id, userId: user.id })

    // BUG-1 fix: onConflict:'user_id' now works — UNIQUE constraint added via migration
    const { error: upsertError } = await supabase
      .from('strava_connections')
      .upsert(
        {
          user_id: user.id,
          athlete_id: tokens.athlete_id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: new Date(tokens.expires_at * 1000).toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (upsertError) {
      // BUG-3 fix: athlete_id already used by another account (unique constraint violation)
      if (upsertError.code === '23505' && upsertError.message.includes('athlete_id')) {
        return NextResponse.redirect(`${origin}/runs?strava=already_connected`)
      }
      console.error('[PROJ-5] Failed to save strava tokens:', upsertError.message)
      return NextResponse.redirect(`${origin}/runs?strava=error`)
    }

    // Clear the state cookie
    const response = NextResponse.redirect(`${origin}/runs?strava=connected`)
    response.cookies.delete(STATE_COOKIE)
    return response
  } catch (err) {
    console.error('[PROJ-5] Strava OAuth callback error:', err)
    return NextResponse.redirect(`${origin}/runs?strava=error`)
  }
}
