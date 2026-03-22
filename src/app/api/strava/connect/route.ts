// GET  /api/strava/connect  — redirect to Strava OAuth
// DELETE /api/strava/connect — disconnect (delete strava_connections row)

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getStravaOAuthUrl } from '@/lib/strava'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const origin = request.nextUrl.origin
  const url = getStravaOAuthUrl(origin)
  return NextResponse.redirect(url)
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
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
