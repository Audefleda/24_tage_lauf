// PUT /api/runner/profile — Update the logged-in user's runner name and age in TYPO3

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { typo3Fetch, Typo3Error } from '@/lib/typo3-client'
import { parseTypo3Response } from '@/lib/typo3-runs'
import { debug } from '@/lib/logger'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const ProfileSchema = z.object({
  name: z.string().min(1, 'Name darf nicht leer sein').max(100, 'Name zu lang (max. 100 Zeichen)'),
  age: z
    .number()
    .int()
    .min(1)
    .max(120)
    .optional()
    .nullable(),
})

export async function PUT(request: NextRequest) {
  // 1. Rate limiting: 10 requests per 60 seconds per IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`runner-profile:${ip}`, { limit: 10, windowSeconds: 60 })
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
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  // 3. Get runner profile
  const { data: profile, error: profileError } = await supabase
    .from('runner_profiles')
    .select('typo3_uid')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'Kein Läufer*in-Profil gefunden' },
      { status: 404 }
    )
  }

  // 4. Validate request body
  let parsed: z.infer<typeof ProfileSchema>
  try {
    const body = await request.json()
    const result = ProfileSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message ?? 'Ungültige Eingabe' },
        { status: 400 }
      )
    }
    parsed = result.data
  } catch {
    return NextResponse.json({ error: 'Ungültiges Request-Format' }, { status: 400 })
  }

  const age = parsed.age ?? 0

  // 5. Call TYPO3 updaterunner
  const formBody = new URLSearchParams({
    type: '191',
    'request[extensionName]': 'SwitRunners',
    'request[pluginName]': 'User',
    'request[controller]': 'User',
    'request[action]': 'setdata',
    'request[arguments][perform]': 'updaterunner',
    'request[arguments][uid]': String(profile.typo3_uid),
    'request[arguments][name]': parsed.name,
    'request[arguments][age]': String(age),
    'request[arguments][tshirtsize]': 'keins',
    'request[arguments][runnergroup]': '0',
  })

  let responseText = ''
  let httpStatus: number | null = null

  debug('runner-profile', 'PUT-Anfrage an TYPO3 gestartet', {
    runnerUid: profile.typo3_uid,
    name: parsed.name,
    age,
  })

  try {
    const resp = await typo3Fetch('/userset.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: formBody.toString(),
    })

    httpStatus = resp.status
    responseText = await resp.text()

    debug('runner-profile', 'TYPO3-Antwort erhalten', { httpStatus, responseText })

    if (!resp.ok) {
      throw new Typo3Error(`TYPO3 API antwortet mit HTTP ${resp.status}`, resp.status)
    }

    const { responseSuccess, responseMessage } = parseTypo3Response(responseText)
    if (responseSuccess === false) {
      // TYPO3 accepted the request but rejected the data — 422 Unprocessable Entity
      return NextResponse.json(
        { error: responseMessage ?? 'TYPO3 hat die Aktualisierung abgelehnt' },
        { status: 422 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    debug('runner-profile', 'Fehler beim TYPO3-Aufruf', {
      httpStatus,
      error: err instanceof Error ? err.message : String(err),
    })
    if (err instanceof Typo3Error) {
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'TYPO3-Verbindung fehlgeschlagen' },
      { status: 500 }
    )
  }
}
