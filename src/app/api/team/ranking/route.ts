import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rate-limit'
import { debug, error as logError } from '@/lib/logger'
import * as cheerio from 'cheerio'

const RANKING_URL =
  'https://www.stuttgarter-kinderstiftung.de/unsere-arbeit/24-tage-lauf-fuer-kinderrechte/alle-teams'
const FETCH_TIMEOUT_MS = 5000

interface TeamEntry {
  name: string
  distanceKm: number
}

function parseGermanNumber(raw: string): number {
  const cleaned = raw.trim().replace(/\./g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

function extractTeams(html: string): TeamEntry[] {
  const $ = cheerio.load(html)
  const teams: TeamEntry[] = []

  $('table.team-list tr').each((_, row) => {
    const $row = $(row)
    if ($row.hasClass('runnergroup-row')) return

    const cells = $row.find('td')
    if (cells.length < 4) return

    const nameCell = cells.eq(0)
    const link = nameCell.find('a.team-link')
    const name = (link.length ? link.text() : nameCell.text()).trim()
    if (!name) return

    const distanceText = cells.eq(3).text()
    const distanceKm = parseGermanNumber(distanceText)

    teams.push({ name, distanceKm })
  })

  return teams
}

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`team-ranking:${ip}`, {
    limit: 30,
    windowSeconds: 60,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Anfragen. Bitte warten.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetIn) } }
    )
  }

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

  const teamName = process.env.TEAM_NAME
  if (!teamName) {
    logError('team-ranking', 'TEAM_NAME Env-Variable nicht konfiguriert')
    return NextResponse.json(
      { error: 'TEAM_NAME nicht konfiguriert' },
      { status: 500 }
    )
  }

  try {
    debug('team-ranking', 'Lade Rangliste von externer Website')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const resp = await fetch(RANKING_URL, { signal: controller.signal })
    clearTimeout(timeout)

    if (!resp.ok) {
      logError(
        'team-ranking',
        `Externe Website antwortet mit HTTP ${resp.status}`
      )
      return NextResponse.json(
        { error: 'Position nicht verfügbar' },
        { status: 503 }
      )
    }

    const html = await resp.text()
    const teams = extractTeams(html)

    if (teams.length === 0) {
      logError(
        'team-ranking',
        'Keine Teams in HTML gefunden — Seitenstruktur hat sich vermutlich geaendert'
      )
      return NextResponse.json(
        { error: 'Position nicht verfügbar' },
        { status: 503 }
      )
    }

    teams.sort((a, b) => b.distanceKm - a.distanceKm)

    const rank = teams.findIndex((t) => t.name === teamName) + 1

    if (rank === 0) {
      logError(
        'team-ranking',
        `Team "${teamName}" nicht in der Rangliste gefunden (${teams.length} Teams geparst)`
      )
      return NextResponse.json(
        { error: 'Team nicht in der Rangliste gefunden' },
        { status: 404 }
      )
    }

    debug('team-ranking', 'Team-Position ermittelt', {
      rank,
      totalTeams: teams.length,
      teamName,
    })

    return NextResponse.json({ rank, totalTeams: teams.length })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      logError('team-ranking', 'Timeout beim Laden der externen Website')
    } else {
      logError('team-ranking', 'Unerwarteter Fehler', err)
    }
    return NextResponse.json(
      { error: 'Position nicht verfügbar' },
      { status: 503 }
    )
  }
}
