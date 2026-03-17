// PATCH /api/admin/users/[id] — Runner-Profil aktualisieren

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'

const UpdateProfileSchema = z.object({
  typo3_uid: z.number().int().positive('TYPO3-UID muss eine positive Ganzzahl sein'),
  typo3_name: z.string().min(1, 'TYPO3-Name darf nicht leer sein'),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Admin-Check
  const check = await requireAdmin()
  if (!check.authorized) {
    return NextResponse.json(
      { error: check.message },
      { status: check.status }
    )
  }

  const { id: userId } = await params

  // UUID-Format validieren
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(userId)) {
    return NextResponse.json(
      { error: 'Ungueltige User-ID' },
      { status: 400 }
    )
  }

  // Body parsen und validieren
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Ungueltiger JSON-Body' },
      { status: 400 }
    )
  }

  const parsed = UpdateProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { typo3_uid, typo3_name } = parsed.data
  const supabase = createAdminClient()

  // Pruefen ob typo3_uid bereits von einem anderen User verwendet wird
  const { data: existing } = await supabase
    .from('runner_profiles')
    .select('id, user_id')
    .eq('typo3_uid', typo3_uid)
    .maybeSingle()

  if (existing && existing.user_id !== userId) {
    return NextResponse.json(
      { error: `TYPO3-UID ${typo3_uid} ist bereits einem anderen Account zugeordnet` },
      { status: 409 }
    )
  }

  // Profil aktualisieren (upsert: falls noch kein Profil existiert, anlegen)
  const { data: profile, error: profileError } = await supabase
    .from('runner_profiles')
    .upsert(
      {
        user_id: userId,
        typo3_uid,
        typo3_name,
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single()

  if (profileError) {
    // Unique constraint violation auf typo3_uid (Race Condition)
    if (profileError.code === '23505') {
      return NextResponse.json(
        { error: `TYPO3-UID ${typo3_uid} ist bereits einem anderen Account zugeordnet` },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: `Profil-Update fehlgeschlagen: ${profileError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json(profile)
}
