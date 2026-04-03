// PROJ-23: Manage external webhook token for the logged-in user
// GET  — Token status (active since, no plaintext)
// POST — Generate / regenerate token (returns plaintext once)
// DELETE — Delete token

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createHash, randomBytes } from 'crypto'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// GET /api/runner/webhook-token — Token status
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const { data: token } = await supabase
    .from('external_webhook_tokens')
    .select('created_at')
    .eq('user_id', user.id)
    .single()

  if (!token) {
    return NextResponse.json({ active: false })
  }

  return NextResponse.json({
    active: true,
    created_at: token.created_at,
  })
}

// POST /api/runner/webhook-token — Generate or regenerate token
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  // Generate cryptographically secure token (32 bytes = 64 hex chars)
  const plainToken = randomBytes(32).toString('hex')
  const tokenHash = hashToken(plainToken)

  // Upsert: insert or replace existing token for this user
  const { error: upsertError } = await supabase
    .from('external_webhook_tokens')
    .upsert(
      {
        user_id: user.id,
        token_hash: tokenHash,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (upsertError) {
    console.error('[PROJ-23] Token upsert failed:', upsertError.message)
    return NextResponse.json(
      { error: 'Token konnte nicht gespeichert werden' },
      { status: 500 }
    )
  }

  // Return plaintext token ONCE — it will never be shown again
  return NextResponse.json({ token: plainToken })
}

// DELETE /api/runner/webhook-token — Delete token
export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const { error: deleteError } = await supabase
    .from('external_webhook_tokens')
    .delete()
    .eq('user_id', user.id)

  if (deleteError) {
    console.error('[PROJ-23] Token delete failed:', deleteError.message)
    return NextResponse.json(
      { error: 'Token konnte nicht geloescht werden' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
