// GET /api/admin/runners — TYPO3 Laeuferliste fuer Admin-Dropdown
// Gibt Array von { uid, name } zurueck

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { typo3Fetch, Typo3Error } from '@/lib/typo3-client'
import { rateLimit } from '@/lib/rate-limit'

interface Typo3Runner {
  uid: number
  nr: number
  name: string
  totaldistance: string
  crdate: string
  runs: unknown[]
  totaldistanceFromArray: number
}

export async function GET(request: NextRequest) {
  // Rate limiting: 30 requests per 60 seconds per IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`admin-runners:${ip}`, { limit: 30, windowSeconds: 60 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Anfragen. Bitte warten.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetIn) } }
    )
  }

  // Admin-Check
  const check = await requireAdmin()
  if (!check.authorized) {
    return NextResponse.json(
      { error: check.message },
      { status: check.status }
    )
  }

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

    const resp = await typo3Fetch('/runnerget.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body.toString(),
    })

    if (!resp.ok) {
      return NextResponse.json(
        { error: `TYPO3 API antwortet mit HTTP ${resp.status}` },
        { status: 502 }
      )
    }

    const data: { runners: Typo3Runner[] } = await resp.json()

    const runners = data.runners.map((r) => ({
      uid: r.uid,
      nr: r.nr,
      name: r.name,
    }))

    return NextResponse.json(runners)
  } catch (error) {
    if (error instanceof Typo3Error) {
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'TYPO3-Verbindung fehlgeschlagen',
      },
      { status: 500 }
    )
  }
}
