// GET  /api/admin/strava/register-webhook — check current webhook registration status
// POST /api/admin/strava/register-webhook — register global Strava webhook (one-time)

import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { registerStravaWebhook, getStravaWebhookSubscription } from '@/lib/strava'

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

  const subscriptionId = await registerStravaWebhook(callbackUrl)

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
