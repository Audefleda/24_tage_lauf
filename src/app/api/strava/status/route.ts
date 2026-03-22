// GET /api/strava/status — returns the current user's Strava connection status

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const { data: connection } = await supabase
    .from('strava_connections')
    .select('athlete_id, last_synced_at')
    .eq('user_id', user.id)
    .single()

  if (!connection) {
    return NextResponse.json({ connected: false, last_synced_at: null })
  }

  return NextResponse.json({
    connected: true,
    athlete_id: connection.athlete_id,
    last_synced_at: connection.last_synced_at,
  })
}
