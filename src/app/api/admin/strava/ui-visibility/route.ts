// GET  /api/admin/strava/ui-visibility — aktuellen Sichtbarkeits-Status lesen
// POST /api/admin/strava/ui-visibility — Status setzen (visible/hidden)

import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'

const SETTING_KEY = 'strava_ui_visible'

export async function GET() {
  const check = await requireAdmin()
  if (!check.authorized) {
    return NextResponse.json({ error: check.message }, { status: check.status })
  }

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

export async function POST(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) {
    return NextResponse.json({ error: check.message }, { status: check.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungueltiges JSON' }, { status: 422 })
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).visible !== 'boolean'
  ) {
    return NextResponse.json(
      { error: 'Feld "visible" (boolean) fehlt' },
      { status: 422 }
    )
  }

  const { visible } = body as { visible: boolean }

  const supabaseAdmin = createAdminClient()
  const { error } = await supabaseAdmin.from('app_settings').upsert({
    key: SETTING_KEY,
    value: String(visible),
    updated_at: new Date().toISOString(),
  })

  if (error) {
    return NextResponse.json(
      { error: 'Status konnte nicht gespeichert werden' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, visible })
}
