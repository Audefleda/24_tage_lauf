// GET /api/strava/ui-visibility — oeffentlicher Endpoint
// Gibt zurueck, ob die Strava-UI fuer Laeufer*innen sichtbar ist.
// Keine Authentifizierung erforderlich (der Wert ist nicht sensitiv).

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

const SETTING_KEY = 'strava_ui_visible'

export async function GET() {
  const supabaseAdmin = createAdminClient()
  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', SETTING_KEY)
    .single()

  // Kein Eintrag = standardmaessig sichtbar (AC-9)
  const visible = data ? data.value !== 'false' : true

  return NextResponse.json({ visible })
}
