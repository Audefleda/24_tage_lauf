// POST /api/runner/assign — Selbstzuordnung eines Benutzers zu einem TYPO3-Läufer
// Erstellt einen runner_profiles-Eintrag fuer den eingeloggten User

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { typo3Fetch, Typo3Error } from '@/lib/typo3-client'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const AssignSchema = z.object({
  typo3_uid: z.number().int().positive('typo3_uid muss eine positive Ganzzahl sein'),
})

export async function POST(request: NextRequest) {
  // Rate limiting: 10 requests per 60 seconds per IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`runner-assign:${ip}`, { limit: 10, windowSeconds: 60 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Anfragen. Bitte warten.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetIn) } }
    )
  }

  // Auth check — any logged-in user
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Nicht authentifiziert' },
      { status: 401 }
    )
  }

  // Parse and validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Ungültiger JSON-Body' },
      { status: 400 }
    )
  }

  const parsed = AssignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe' },
      { status: 400 }
    )
  }

  const { typo3_uid } = parsed.data

  // Use admin client for all DB operations — runner_profiles has no INSERT policy for regular users
  const supabaseAdmin = createAdminClient()

  // BUG-2 fix: Validate that typo3_uid exists in TYPO3 before inserting
  try {
    const body = new URLSearchParams({
      type: '195',
      'request[extensionName]': 'SwitRunners',
      'request[pluginName]': 'User',
      'request[controller]': 'User',
      'request[action]': 'getdata',
      'request[arguments][eventtype]': '24d',
      'request[arguments][sumonly]': '1',
    })
    const typo3Resp = await typo3Fetch('/runnerget.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body.toString(),
    })
    if (!typo3Resp.ok) {
      return NextResponse.json(
        { error: `TYPO3 API antwortet mit HTTP ${typo3Resp.status}` },
        { status: 502 }
      )
    }
    const typo3Data: { runners: { uid: number }[] } = await typo3Resp.json()
    const validUids = new Set(typo3Data.runners.map((r) => r.uid))
    if (!validUids.has(typo3_uid)) {
      return NextResponse.json(
        { error: 'Ungültige Läufer*in — UID nicht in TYPO3 gefunden' },
        { status: 400 }
      )
    }
  } catch (error) {
    if (error instanceof Typo3Error) {
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
    return NextResponse.json(
      { error: 'TYPO3-Verbindung fehlgeschlagen' },
      { status: 500 }
    )
  }

  // Check: user must not already have a runner_profiles entry
  const { data: existingProfile } = await supabaseAdmin
    .from('runner_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (existingProfile) {
    return NextResponse.json(
      { error: 'Du hast bereits eine Läufer*in zugeordnet' },
      { status: 409 }
    )
  }

  // Check: chosen typo3_uid must not already be assigned to another user
  const { data: takenProfile } = await supabaseAdmin
    .from('runner_profiles')
    .select('id')
    .eq('typo3_uid', typo3_uid)
    .single()

  if (takenProfile) {
    return NextResponse.json(
      { error: 'Diese Läufer*in ist bereits einer anderen Nutzer*in zugeordnet' },
      { status: 409 }
    )
  }

  // Insert the assignment
  const { error: insertError } = await supabaseAdmin
    .from('runner_profiles')
    .insert({ user_id: user.id, typo3_uid })

  if (insertError) {
    // Handle unique constraint violation (race condition)
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: 'Zuordnung fehlgeschlagen — diese Läufer*in wurde gerade von jemand anderem gewählt. Bitte wähle eine andere.' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Datenbankfehler beim Speichern der Zuordnung' },
      { status: 500 }
    )
  }

  return NextResponse.json(
    { message: 'Läufer*in erfolgreich zugeordnet' },
    { status: 201 }
  )
}
