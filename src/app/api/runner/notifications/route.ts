// PATCH /api/runner/notifications — Toggle Teams notification opt-out for the logged-in user
// PROJ-20: Uses user-scoped createClient() with RLS — NOT createAdminClient()

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const BodySchema = z.object({
  enabled: z.boolean(),
})

export async function PATCH(request: NextRequest) {
  // 1. Rate limiting: 10 requests per 60 seconds per IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`runner-notifications:${ip}`, { limit: 10, windowSeconds: 60 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Anfragen. Bitte warten.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetIn) } }
    )
  }

  // 2. Authenticate
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

  // 3. Validate request body
  let body: z.infer<typeof BodySchema>
  try {
    const raw = await request.json()
    const result = BodySchema.safeParse(raw)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Ungueltige Anfrage: enabled muss ein Boolean sein' },
        { status: 400 }
      )
    }
    body = result.data
  } catch {
    return NextResponse.json(
      { error: 'Ungueltiges JSON' },
      { status: 400 }
    )
  }

  // 4. Update runner_profiles (RLS ensures user can only update own row)
  const { error: updateError } = await supabase
    .from('runner_profiles')
    .update({ teams_notifications_enabled: body.enabled })
    .eq('user_id', user.id)

  if (updateError) {
    return NextResponse.json(
      { error: 'Datenbankfehler beim Speichern der Einstellung' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
