// Shared TYPO3 runs operations — used by /api/runner/runs and /api/strava/webhook
import 'server-only'

import { createAdminClient } from '@/lib/supabase-admin'
import { typo3Fetch, Typo3Error } from '@/lib/typo3-client'
import { debug } from '@/lib/logger'

export interface RunPayload {
  runDate: string
  runDistance: string
}

interface Typo3RawRun {
  uid?: number
  rundate: string
  rundateObj: string
  distance: string
}

interface Typo3Runner {
  uid: number
  runs: Typo3RawRun[]
}

function mapTypo3Run(raw: Typo3RawRun): RunPayload | null {
  const dateStr = raw.rundateObj
  if (!dateStr) return null
  return {
    runDate: dateStr + ' 06:00:00',
    runDistance: (raw.distance ?? '0').replace(',', '.'),
  }
}

export function parseTypo3Response(responseText: string): {
  responseSuccess: boolean | null
  responseMessage: string | null
} {
  try {
    const json = JSON.parse(responseText)
    const responseSuccess = typeof json.success === 'boolean' ? json.success : null
    const responseMessage = typeof json.message === 'string' ? json.message : null
    return { responseSuccess, responseMessage }
  } catch {
    return {
      responseSuccess: null,
      responseMessage: responseText ? responseText.slice(0, 2000) : null,
    }
  }
}

export async function logTypo3Request(params: {
  typo3RunnerUid: number
  runs: RunPayload[]
  httpStatus: number | null
  responseText: string
}): Promise<void> {
  try {
    const supabaseAdmin = createAdminClient()
    const { responseSuccess, responseMessage } = parseTypo3Response(params.responseText)

    const entries = params.runs.filter((run) => run.runDate).map((run) => ({
      typo3_runner_uid: params.typo3RunnerUid,
      run_date: run.runDate.split(' ')[0],
      run_distance_km: parseFloat(run.runDistance) || 0,
      http_status: params.httpStatus,
      response_success: responseSuccess,
      response_message: responseMessage,
    }))

    if (entries.length === 0) {
      entries.push({
        typo3_runner_uid: params.typo3RunnerUid,
        run_date: new Date().toISOString().split('T')[0],
        run_distance_km: 0,
        http_status: params.httpStatus,
        response_success: responseSuccess,
        response_message: responseMessage,
      })
    }

    const { error } = await supabaseAdmin.from('typo3_request_log').insert(entries)
    if (error) {
      console.error('[PROJ-8] Failed to write TYPO3 request log:', error.message)
    }
  } catch (err) {
    console.error('[PROJ-8] Unexpected error in logTypo3Request:', err)
  }
}

/** Fetch the current runs for a runner from TYPO3 */
export async function fetchRunnerRuns(typo3Uid: number): Promise<RunPayload[]> {
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
    throw new Typo3Error(`TYPO3 API antwortet mit HTTP ${resp.status}`, resp.status)
  }

  const data: { runners: Typo3Runner[] } = await resp.json()
  const runner = data.runners.find((r) => r.uid === typo3Uid)
  if (!runner) return []
  return runner.runs
    .map(mapTypo3Run)
    .filter((r): r is RunPayload => r !== null)
}

/** Replace all runs for a runner in TYPO3 (calls updateruns + logs). Throws on failure. */
export async function updateRunnerRuns(
  typo3Uid: number,
  runs: RunPayload[]
): Promise<void> {
  const formBody = new URLSearchParams({
    type: '191',
    'request[extensionName]': 'SwitRunners',
    'request[pluginName]': 'User',
    'request[controller]': 'User',
    'request[action]': 'setdata',
    'request[arguments][perform]': 'updateruns',
    'request[arguments][userUid]': String(typo3Uid),
    'request[arguments][runs]': JSON.stringify(runs),
  })

  debug('typo3-runs', 'PUT-Anfrage an TYPO3 gestartet', { runnerUid: typo3Uid, runCount: runs.length })
  debug('typo3-runs', 'Gesendete Laufdaten', runs)

  let responseText = ''
  let httpStatus: number | null = null

  try {
    const resp = await typo3Fetch('/userset.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: formBody.toString(),
    })

    httpStatus = resp.status
    responseText = await resp.text()

    debug('typo3-runs', 'HTTP-Status der TYPO3-Antwort', { httpStatus })
    debug('typo3-runs', 'TYPO3-Antwort-Body', responseText)

    await logTypo3Request({ typo3RunnerUid: typo3Uid, runs, httpStatus, responseText })

    if (!resp.ok) {
      throw new Typo3Error(`TYPO3 API antwortet mit HTTP ${resp.status}`, resp.status)
    }

    let body: { success?: boolean; message?: string } | null = null
    try { body = JSON.parse(responseText) } catch { /* not JSON */ }

    if (body?.success === false) {
      throw new Typo3Error(body.message ?? 'TYPO3 hat den Speichervorgang abgelehnt')
    }
  } catch (err) {
    if (httpStatus === null) {
      // Network/timeout error — log and re-throw
      await logTypo3Request({
        typo3RunnerUid: typo3Uid,
        runs,
        httpStatus: null,
        responseText: err instanceof Error ? err.message : 'Unknown error',
      })
    }
    throw err
  }
}
