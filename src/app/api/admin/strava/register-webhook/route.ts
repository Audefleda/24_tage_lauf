// GET    /api/admin/strava/register-webhook — check current webhook registration status
// POST   /api/admin/strava/register-webhook — register global Strava webhook (one-time)
// DELETE /api/admin/strava/register-webhook — deregister global Strava webhook

import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { registerStravaWebhook, getStravaWebhookSubscription, deleteStravaWebhook } from '@/lib/strava'

export async function GET() {
  const check = await requireAdmin()
  if (!check.authorized) {
    return NextResponse.json({ error: check.message }, { status: check.status })
  }

  const supabaseAdmin = createAdminClient()
  const { data: setting } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'strava_subscription_id')
    .single()

  const stravaSubscription = await getStravaWebhookSubscription()

  return NextResponse.json({
    registered: !!setting,
    subscription_id: setting?.value ?? null,
    strava_confirmed: stravaSubscription !== null,
    strava_callback_url: stravaSubscription?.callback_url ?? null,
  })
}

export async function POST(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) {
    return NextResponse.json({ error: check.message }, { status: check.status })
  }

  const supabaseAdmin = createAdminClient()

  const { data: existing } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'strava_subscription_id')
    .single()

  if (existing) {
    return NextResponse.json(
      {
        error: `Webhook bereits registriert (subscription_id: ${existing.value}). Erst löschen, dann neu registrieren.`,
      },
      { status: 409 }
    )
  }

  const origin = new URL(request.url).origin
  const callbackUrl = `${origin}/api/strava/webhook`

  let subscriptionId: number
  try {
    subscriptionId = await registerStravaWebhook(callbackUrl)
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    // Strava says subscription already exists — fetch and adopt it
    if (message.includes('already exists')) {
      const existing = await getStravaWebhookSubscription()
      if (!existing) {
        return NextResponse.json(
          { error: 'Strava meldet "already exists", aber Subscription konnte nicht abgerufen werden.' },
          { status: 502 }
        )
      }
      subscriptionId = existing.id
    } else {
      return NextResponse.json({ error: message || 'Registrierung fehlgeschlagen.' }, { status: 502 })
    }
  }

  await supabaseAdmin.from('app_settings').upsert({
    key: 'strava_subscription_id',
    value: String(subscriptionId),
    updated_at: new Date().toISOString(),
  })

  return NextResponse.json({
    ok: true,
    subscription_id: subscriptionId,
    callback_url: callbackUrl,
  })
}

export async function DELETE() {
  const check = await requireAdmin()
  if (!check.authorized) {
    return NextResponse.json({ error: check.message }, { status: check.status })
  }

  const supabaseAdmin = createAdminClient()

  // 1. Read subscription_id from app_settings
  const { data: setting } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'strava_subscription_id')
    .single()

  if (!setting) {
    return NextResponse.json(
      { error: 'Kein Webhook registriert' },
      { status: 404 }
    )
  }

  // 2. Check env vars before calling Strava API
  if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'Strava-Konfiguration unvollständig' },
      { status: 500 }
    )
  }

  // 3. Call Strava API to delete the subscription
  //    deleteStravaWebhook treats both 204 and 404 as success (idempotent).
  //    It throws on network errors or unexpected status codes.
  try {
    await deleteStravaWebhook(setting.value)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Strava API nicht erreichbar'
    return NextResponse.json(
      { error: message },
      { status: 502 }
    )
  }

  // 3. Remove subscription_id from app_settings
  await supabaseAdmin
    .from('app_settings')
    .delete()
    .eq('key', 'strava_subscription_id')

  return NextResponse.json({ ok: true })
}
