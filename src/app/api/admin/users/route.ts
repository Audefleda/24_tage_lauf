// GET /api/admin/users — Alle Supabase-User mit runner_profiles

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { rateLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  // Rate limiting: 30 requests per 60 seconds per IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`admin-users:${ip}`, { limit: 30, windowSeconds: 60 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Anfragen. Bitte warten.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetIn) } }
    )
  }

  const check = await requireAdmin()
  if (!check.authorized) {
    return NextResponse.json({ error: check.message }, { status: check.status })
  }

  const supabase = createAdminClient()

  const {
    data: { users },
    error: usersError,
  } = await supabase.auth.admin.listUsers()

  if (usersError) {
    return NextResponse.json(
      { error: `Fehler beim Laden der User: ${usersError.message}` },
      { status: 500 }
    )
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('runner_profiles')
    .select('*')

  if (profilesError) {
    return NextResponse.json(
      { error: `Fehler beim Laden der Profile: ${profilesError.message}` },
      { status: 500 }
    )
  }

  const profileMap = new Map(
    (profiles ?? []).map((p: { user_id: string; typo3_uid: number }) => [
      p.user_id,
      p,
    ])
  )

  const result = users.map((user) => {
    const profile = profileMap.get(user.id) as
      | { user_id: string; typo3_uid: number }
      | undefined

    return {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      role: user.app_metadata?.role ?? 'user',
      typo3_uid: profile?.typo3_uid ?? null,
    }
  })

  return NextResponse.json(result)
}
