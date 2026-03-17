// GET /api/admin/users — Alle Supabase-User mit runner_profiles

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'

export async function GET() {
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
    (profiles ?? []).map((p: { user_id: string; typo3_uid: number; typo3_name: string }) => [
      p.user_id,
      p,
    ])
  )

  const result = users.map((user) => {
    const profile = profileMap.get(user.id) as
      | { user_id: string; typo3_uid: number; typo3_name: string }
      | undefined

    return {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      role: user.user_metadata?.role ?? 'user',
      typo3_uid: profile?.typo3_uid ?? null,
      typo3_name: profile?.typo3_name ?? null,
    }
  })

  return NextResponse.json(result)
}
