// Strava API helpers — server-only
import 'server-only'

const CLIENT_ID = process.env.STRAVA_CLIENT_ID ?? ''
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET ?? ''
const VERIFY_TOKEN = process.env.STRAVA_VERIFY_TOKEN ?? ''

export const STRAVA_VERIFY_TOKEN = VERIFY_TOKEN

/** Activity types that should be forwarded to TYPO3 */
export const ALLOWED_ACTIVITY_TYPES = new Set([
  'Run',
  'TrailRun',
  'VirtualRun',
  'Hike',
  'Walk',
])

export interface StravaTokens {
  access_token: string
  refresh_token: string
  expires_at: number // Unix timestamp
}

export interface StravaConnection {
  user_id: string
  athlete_id: number
  access_token: string
  refresh_token: string
  token_expires_at: string // ISO timestamptz
}

export interface StravaActivity {
  id: number
  type: string
  start_date: string // ISO 8601
  distance: number   // metres
}

/** Generate the Strava OAuth authorization URL */
export function getStravaOAuthUrl(origin: string, state: string): string {
  if (!CLIENT_ID) throw new Error('STRAVA_CLIENT_ID is not configured')
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: `${origin}/api/strava/callback`,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
    state,
  })
  return `https://www.strava.com/oauth/authorize?${params}`
}

/** Exchange OAuth authorization code for tokens */
export async function exchangeStravaCode(code: string): Promise<StravaTokens & { athlete_id: number }> {
  const resp = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`Strava token exchange failed: HTTP ${resp.status} — ${text}`)
  }

  const data = await resp.json()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete_id: data.athlete.id,
  }
}

/** Refresh a Strava access token using the refresh token. Returns new tokens. */
export async function refreshStravaToken(
  refreshToken: string
): Promise<StravaTokens> {
  const resp = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`Strava token refresh failed: HTTP ${resp.status} — ${text}`)
  }

  const data = await resp.json()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  }
}

/**
 * Return a valid access token for the connection, refreshing if needed.
 * Returns the (possibly updated) tokens so the caller can persist them.
 */
export async function getValidAccessToken(connection: StravaConnection): Promise<{
  access_token: string
  newTokens: StravaTokens | null // non-null if token was refreshed
}> {
  const expiresAt = new Date(connection.token_expires_at).getTime()
  const nowMs = Date.now()
  const bufferMs = 5 * 60 * 1000 // refresh 5 minutes early

  if (nowMs < expiresAt - bufferMs) {
    return { access_token: connection.access_token, newTokens: null }
  }

  const newTokens = await refreshStravaToken(connection.refresh_token)
  return { access_token: newTokens.access_token, newTokens }
}

/** Fetch activity details from Strava API */
export async function fetchStravaActivity(
  activityId: number,
  accessToken: string
): Promise<StravaActivity | null> {
  const resp = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (resp.status === 404) return null

  if (!resp.ok) {
    throw new Error(`Strava activities API: HTTP ${resp.status}`)
  }

  return resp.json()
}

/** Register the app's webhook subscription with Strava. Returns the subscription_id. */
export async function registerStravaWebhook(callbackUrl: string): Promise<number> {
  if (!CLIENT_ID || !CLIENT_SECRET || !VERIFY_TOKEN) {
    throw new Error('STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET and STRAVA_VERIFY_TOKEN must be set')
  }

  const resp = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      callback_url: callbackUrl,
      verify_token: VERIFY_TOKEN,
    }),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`Strava webhook registration failed: HTTP ${resp.status} — ${text}`)
  }

  const data = await resp.json()
  return data.id as number
}

/** Check existing Strava webhook subscriptions for this app */
export async function getStravaWebhookSubscription(): Promise<{ id: number; callback_url: string } | null> {
  if (!CLIENT_ID || !CLIENT_SECRET) return null

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  })

  const resp = await fetch(`https://www.strava.com/api/v3/push_subscriptions?${params}`)
  if (!resp.ok) return null

  const data = await resp.json()
  return Array.isArray(data) && data.length > 0 ? data[0] : null
}
