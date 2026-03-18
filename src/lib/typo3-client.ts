// Server-only module — never import in Client Components
// All TYPO3 credentials stay on the server
import 'server-only'

const BASE_URL = process.env.TYPO3_BASE_URL ?? ''
const LOGIN_PATH = process.env.TYPO3_LOGIN_PATH ?? ''
const EMAIL = process.env.TYPO3_EMAIL ?? ''
const PASSWORD = process.env.TYPO3_PASSWORD ?? ''

export class Typo3Error extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message)
    this.name = 'Typo3Error'
  }
}

// Module-level cookie cache (server process lifetime).
// On Vercel serverless, this resets on cold starts — re-auth happens automatically.
let cachedCookie: string | null = null

function extractFormFields(
  html: string,
  baseUrl: string
): { action: string; data: Record<string, string> } {
  // Extract form action attribute (decode HTML entities like &amp; → &)
  const actionMatch = html.match(/<form[^>]+action="([^"]*)"/)
  const rawAction = actionMatch
    ? actionMatch[1].replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    : ''
  const action = rawAction
    ? new URL(rawAction, baseUrl).toString()
    : baseUrl

  // Extract all <input> fields
  const data: Record<string, string> = {}
  const inputRegex = /<input([^>]*)>/gi
  let match: RegExpExecArray | null

  while ((match = inputRegex.exec(html)) !== null) {
    const attrs = match[1]
    const nameMatch = attrs.match(/\bname="([^"]*)"/)
    const valueMatch = attrs.match(/\bvalue="([^"]*)"/)
    const typeMatch = attrs.match(/\btype="([^"]*)"/)

    if (!nameMatch) continue

    const name = nameMatch[1]
    const value = valueMatch ? valueMatch[1] : ''
    const type = typeMatch ? typeMatch[1].toLowerCase() : 'text'

    if (name.toLowerCase() === 'user') {
      data[name] = EMAIL
    } else if (name.toLowerCase() === 'pass') {
      data[name] = PASSWORD
    } else if (type === 'email' || name.toLowerCase().includes('email')) {
      data[name] = EMAIL
    } else if (type === 'password' || name.toLowerCase().includes('pass')) {
      data[name] = PASSWORD
    } else {
      data[name] = value
    }
  }

  return { action, data }
}

async function login(): Promise<string> {
  if (!BASE_URL || !LOGIN_PATH || !EMAIL || !PASSWORD) {
    throw new Typo3Error(
      'TYPO3-Konfiguration unvollständig. Bitte TYPO3_BASE_URL, TYPO3_LOGIN_PATH, TYPO3_EMAIL und TYPO3_PASSWORD in .env.local setzen.'
    )
  }

  const loginUrl = `${BASE_URL}${LOGIN_PATH}`

  // Step 1: GET login page to extract form + session cookies for CSRF validation
  const getResp = await fetch(loginUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
  })

  if (!getResp.ok) {
    throw new Typo3Error(
      `Login-Seite nicht erreichbar: HTTP ${getResp.status} bei GET ${loginUrl}`,
      getResp.status
    )
  }

  // Collect session cookies from GET (e.g. PHPSESSID tied to __RequestToken CSRF value)
  const getSessionCookies: string[] =
    typeof getResp.headers.getSetCookie === 'function'
      ? getResp.headers.getSetCookie()
      : [(getResp.headers.get('set-cookie') ?? '')]
  const sessionCookieHeader = getSessionCookies
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ')

  const html = await getResp.text()
  const { action, data } = extractFormFields(html, loginUrl)

  // Step 2: POST login form WITH session cookies so CSRF token validates correctly
  const postResp = await fetch(action, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0',
      Referer: loginUrl,
      ...(sessionCookieHeader ? { Cookie: sessionCookieHeader } : {}),
    },
    body: new URLSearchParams(data).toString(),
    redirect: 'manual',
  })

  // Step 3: Collect cookies from POST response
  const collectCookies = (resp: Response): Map<string, string> => {
    const raw: string[] =
      typeof resp.headers.getSetCookie === 'function'
        ? resp.headers.getSetCookie()
        : [(resp.headers.get('set-cookie') ?? '')]
    const map = new Map<string, string>()
    for (const c of raw) {
      const part = c.split(';')[0].trim()
      if (part) {
        const [name] = part.split('=')
        map.set(name, part)
      }
    }
    return map
  }

  const cookieMap = collectCookies(postResp)

  // Step 4: Follow redirect manually to collect any updated cookies
  const location = postResp.headers.get('location')
  if (location) {
    const redirectUrl = location.startsWith('http')
      ? location
      : new URL(location, BASE_URL).toString()
    const cookieHeader = [...cookieMap.values()].join('; ')
    const getResp2 = await fetch(redirectUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Cookie: cookieHeader,
      },
      redirect: 'manual',
    })
    const redirectCookies = collectCookies(getResp2)
    for (const [name, value] of redirectCookies) {
      cookieMap.set(name, value)
    }
  }

  if (!cookieMap.has('fe_typo_user')) {
    throw new Typo3Error(
      'Login fehlgeschlagen: fe_typo_user Cookie nicht gesetzt. Bitte Credentials in .env.local prüfen.'
    )
  }

  return [...cookieMap.values()].join('; ')
}

async function getAuthCookie(): Promise<string> {
  if (!cachedCookie) {
    cachedCookie = await login()
  }
  return cachedCookie
}

/** Authenticated fetch against the TYPO3 website */
export async function typo3Fetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const cookie = await getAuthCookie()
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`

  const headers: Record<string, string> = {
    Cookie: cookie,
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': 'Mozilla/5.0',
    Referer: `${BASE_URL}${LOGIN_PATH}`,
    Origin: BASE_URL,
    ...(options.headers as Record<string, string> | undefined),
  }

  const resp = await fetch(url, { ...options, headers })

  // On auth errors, clear cookie and retry once
  if (resp.status === 401 || resp.status === 403) {
    cachedCookie = null
    headers.Cookie = await getAuthCookie()
    return fetch(url, { ...options, headers })
  }

  return resp
}

/** Test the TYPO3 connection — used by the /api/health endpoint */
export async function checkConnection(): Promise<{
  ok: boolean
  message: string
}> {
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
      return { ok: false, message: `API antwortet mit HTTP ${resp.status}` }
    }

    return { ok: true, message: 'Verbindung zur Lauf-Website erfolgreich' }
  } catch (error) {
    if (error instanceof Typo3Error) {
      return { ok: false, message: error.message }
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Verbindung fehlgeschlagen',
    }
  }
}
