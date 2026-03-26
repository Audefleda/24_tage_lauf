// PROJ-19: Teams-Benachrichtigung nach Lauf-Eintrag
// Server-only — fire-and-forget notification to Microsoft Teams via Incoming Webhook
import 'server-only'

import { createAdminClient } from '@/lib/supabase-admin'
import { typo3Fetch } from '@/lib/typo3-client'
import * as logger from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TeamsNotificationPayload {
  /** TYPO3 runner UID — used to look up name + stats */
  typo3Uid: number
  /** Date of the run (YYYY-MM-DD) */
  runDate: string
  /** Distance in km (e.g. "8.40") */
  runDistanceKm: string
  /** PROJ-20: If false, the notification is skipped (opt-out) */
  teamsNotificationsEnabled?: boolean
}

interface Typo3Runner {
  uid: number
  name: string
  totaldistance: string
  runs: { runDate: string; runDistance: string }[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a date string from YYYY-MM-DD to DD.MM.YYYY */
function formatDate(isoDate: string): string {
  const parts = isoDate.split('-')
  if (parts.length !== 3) return isoDate
  return `${parts[2]}.${parts[1]}.${parts[0]}`
}

/** Format a number string to German locale (dot → comma), e.g. "8.40" → "8,4" */
function formatKm(km: string): string {
  const num = parseFloat(km)
  if (isNaN(num)) return km
  // Use German locale: comma as decimal separator, remove trailing zeros
  return num.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
}

/** Replace {name}, {datum}, {km} placeholders in a template string */
function replacePlaceholders(
  template: string,
  name: string,
  datum: string,
  km: string
): string {
  return template
    .replace(/\{name\}/g, `**${name}**`)
    .replace(/\{datum\}/g, datum)
    .replace(/\{km\} km/g, `**${km} km**`)  // bold number + unit together
    .replace(/\{km\}/g, `**${km}**`)         // fallback for templates without trailing " km"
}

// ---------------------------------------------------------------------------
// Fetch runner data from TYPO3 for statistics
// ---------------------------------------------------------------------------

async function fetchAllRunners(): Promise<Typo3Runner[]> {
  try {
    const body = new URLSearchParams({
      type: '195',
      'request[extensionName]': 'SwitRunners',
      'request[pluginName]': 'User',
      'request[controller]': 'User',
      'request[action]': 'getdata',
      'request[arguments][eventtype]': '24d',
    })

    const resp = await typo3Fetch('/runnerget.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body.toString(),
    })

    if (!resp.ok) {
      logger.error('teams', `TYPO3 getdata fehlgeschlagen: HTTP ${resp.status}`)
      return []
    }

    const data: { runners: Typo3Runner[] } = await resp.json()
    return data.runners ?? []
  } catch (err) {
    logger.error('teams', 'Fehler beim Abrufen der TYPO3-Laeufer*innen-Daten', err)
    return []
  }
}

// ---------------------------------------------------------------------------
// Fetch random message template from Supabase
// ---------------------------------------------------------------------------

async function fetchRandomTemplate(): Promise<string | null> {
  try {
    const supabase = createAdminClient()

    // Count active messages first, then pick a random offset
    const { count, error: countError } = await supabase
      .from('teams_messages')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)

    if (countError || !count || count === 0) {
      return null
    }

    const randomOffset = Math.floor(Math.random() * count)

    const { data, error } = await supabase
      .from('teams_messages')
      .select('message')
      .eq('active', true)
      .range(randomOffset, randomOffset)
      .limit(1)
      .single()

    if (error || !data) {
      return null
    }

    return data.message
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Build Adaptive Card payload
// ---------------------------------------------------------------------------

function buildAdaptiveCard(
  headerText: string,
  facts: { title: string; value: string }[]
): Record<string, unknown> {
  const factsBlock = {
    type: 'ColumnSet',
    spacing: 'Small',
    columns: [
      {
        type: 'Column',
        width: 'auto',
        items: facts.map((fact) => ({
          type: 'TextBlock',
          text: fact.title,
          wrap: false,
          size: 'Small',
        })),
      },
      {
        type: 'Column',
        width: 'auto',
        spacing: 'Small',
        items: facts.map((fact) => ({
          type: 'TextBlock',
          text: fact.value,
          wrap: false,
          size: 'Small',
        })),
      },
    ],
  }

  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          type: 'AdaptiveCard',
          version: '1.2',
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          msteams: { width: 'Full' },
          body: [
            {
              type: 'TextBlock',
              text: headerText,
              weight: 'Bolder',
              size: 'Medium',
              wrap: true,
            },
            factsBlock,
          ],
        },
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Main: send Teams notification (fire-and-forget)
// ---------------------------------------------------------------------------

/**
 * Sends a motivational Teams notification after a run is saved.
 *
 * Must be awaited by the caller. Never throws — all errors are caught internally.
 */
export async function sendTeamsNotification(payload: TeamsNotificationPayload): Promise<void> {
  // PROJ-20: Skip notification if user has opted out
  if (payload.teamsNotificationsEnabled === false) {
    logger.debug('teams', 'Teams-Benachrichtigung deaktiviert (Opt-out)')
    return
  }

  const webhookUrl = process.env.TEAMS_WEBHOOK_URL

  if (!webhookUrl) {
    logger.debug('teams', 'TEAMS_WEBHOOK_URL nicht gesetzt — Benachrichtigung uebersprungen')
    return
  }

  await doSendNotification(webhookUrl, payload).catch((err) => {
    logger.error('teams', 'Unerwarteter Fehler in doSendNotification', err)
  })
}

async function doSendNotification(
  webhookUrl: string,
  payload: TeamsNotificationPayload
): Promise<void> {
  const { typo3Uid, runDate, runDistanceKm } = payload

  // 1. Fetch all runners from TYPO3 for name + statistics
  const runners = await fetchAllRunners()

  const runner = runners.find((r) => r.uid === typo3Uid)
  const runnerName = runner?.name ?? `Läufer*in #${typo3Uid}`
  const runnerTotalRuns = runner?.runs?.length ?? 0
  const runnerTotalKm = runner ? (parseFloat(runner.totaldistance) || 0) : 0

  // Team total km: sum totaldistance from all runners (AC-10)
  const teamTotalKm = runners.reduce((sum, r) => {
    return sum + (parseFloat(r.totaldistance) || 0)
  }, 0)

  const formattedDate = formatDate(runDate)
  const formattedKm = formatKm(runDistanceKm)

  // 2. Fetch random message template
  let template = await fetchRandomTemplate()

  // Fallback if no templates available
  if (!template) {
    template = '{name} ist am {datum} {km} km gelaufen 🏃'
  }

  const headerText = replacePlaceholders(template, runnerName, formattedDate, formattedKm)

  // 3. Build facts
  const facts = [
    {
      title: `Läufe gesamt ${runnerName}`,
      value: String(runnerTotalRuns),
    },
    {
      title: `Kilometer gesamt ${runnerName}`,
      value: runnerTotalKm > 0
        ? `${runnerTotalKm.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
        : '–',
    },
    {
      title: 'Kilometer gesamt BettercallPaul',
      value: teamTotalKm > 0
        ? `${teamTotalKm.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
        : '–',
    },
  ]

  // 4. Build and send Adaptive Card
  const card = buildAdaptiveCard(headerText, facts)

  logger.debug('teams', 'Sende Teams-Benachrichtigung', {
    runner: runnerName,
    date: formattedDate,
    km: formattedKm,
  })

  try {
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    })

    if (!resp.ok) {
      const body = await resp.text().catch(() => '(unreadable)')
      logger.error('teams', `Teams-Webhook HTTP ${resp.status}`, body)
    } else {
      logger.debug('teams', 'Teams-Benachrichtigung erfolgreich gesendet')
    }
  } catch (err) {
    logger.error('teams', 'Netzwerkfehler beim Senden der Teams-Benachrichtigung', err)
  }
}
