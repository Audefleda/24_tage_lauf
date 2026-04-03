// GET  /api/admin/external-webhook/status — aktuellen Status lesen
// POST /api/admin/external-webhook/status — Status setzen (enabled/disabled)

import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'

const SETTING_KEY = 'external_webhook_enabled'

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

  // Kein Eintrag = standardmäßig aktiv
  const enabled = data ? data.value !== 'false' : true

  return NextResponse.json({ enabled })
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

  if (typeof body !== 'object' || body === null || typeof (body as Record<string, unknown>).enabled !== 'boolean') {
    return NextResponse.json({ error: 'Feld "enabled" (boolean) fehlt' }, { status: 422 })
  }

  const { enabled } = body as { enabled: boolean }

  const supabaseAdmin = createAdminClient()
  await supabaseAdmin.from('app_settings').upsert({
    key: SETTING_KEY,
    value: String(enabled),
    updated_at: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true, enabled })
}
