/**
 * Unit Tests: PROJ-28 — /api/team/ranking
 *
 * Tests the pure functions (parseGermanNumber, extractTeams) and
 * the route handler logic with mocked dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------- Test parseGermanNumber and extractTeams ----------
// These are not exported, so we test them indirectly through the route handler.
// However, we can also test the HTML parsing logic directly by importing the module
// and using a known HTML structure.

// We'll test the route handler directly with mocked dependencies.

// Mock 'server-only' (required by logger)
vi.mock('server-only', () => ({}))

// Mock supabase-server
vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn(),
}))

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  debug: vi.fn(),
  error: vi.fn(),
}))

// We need to mock global fetch for the scraping request
const mockFetch = vi.fn()

import { GET } from './route'
import { createClient } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rate-limit'

// ---------- Helpers ----------

function makeRequest(overrides?: { ip?: string }): Request {
  const headers = new Headers()
  if (overrides?.ip) {
    headers.set('x-forwarded-for', overrides.ip)
  }
  return new Request('http://localhost:3000/api/team/ranking', {
    method: 'GET',
    headers,
  }) as unknown as Request
}

function mockAuth(user: { id: string } | null, error: Error | null = null) {
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error,
      }),
    },
  }
  vi.mocked(createClient).mockResolvedValue(supabase as unknown as Awaited<ReturnType<typeof createClient>>)
  return supabase
}

function mockRateLimitAllowed() {
  vi.mocked(rateLimit).mockReturnValue({
    allowed: true,
    remaining: 29,
    resetIn: 60,
  })
}

function mockRateLimitDenied() {
  vi.mocked(rateLimit).mockReturnValue({
    allowed: false,
    remaining: 0,
    resetIn: 30,
  })
}

// Sample HTML that mimics the structure the scraper expects:
// <table class="team-list">
//   <tr><td><a class="team-link">TeamA</a></td><td></td><td></td><td>100,50</td></tr>
//   <tr><td><a class="team-link">BettercallPaul</a></td><td></td><td></td><td>85,30</td></tr>
//   <tr><td><a class="team-link">TeamC</a></td><td></td><td></td><td>50,00</td></tr>
// </table>

function buildMockHtml(teams: { name: string; distance: string }[]): string {
  const rows = teams
    .map(
      (t) =>
        `<tr><td><a class="team-link">${t.name}</a></td><td></td><td></td><td>${t.distance}</td></tr>`
    )
    .join('\n')
  return `<html><body><table class="team-list">${rows}</table></body></html>`
}

// ---------- Tests ----------

describe('/api/team/ranking', () => {
  const originalEnv = process.env.TEAM_NAME
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env.TEAM_NAME = 'BettercallPaul'
    globalThis.fetch = mockFetch
    mockRateLimitAllowed()
  })

  afterEach(() => {
    process.env.TEAM_NAME = originalEnv
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  // ---------- Authentication ----------

  it('returns 401 when user is not authenticated', async () => {
    mockAuth(null)
    const req = makeRequest()
    const resp = await GET(req as any)
    expect(resp.status).toBe(401)
    const body = await resp.json()
    expect(body.error).toBe('Nicht authentifiziert')
  })

  it('returns 401 when auth returns an error', async () => {
    mockAuth(null, new Error('Token expired'))
    const req = makeRequest()
    const resp = await GET(req as any)
    expect(resp.status).toBe(401)
  })

  // ---------- Rate Limiting ----------

  it('returns 429 when rate limited', async () => {
    mockRateLimitDenied()
    mockAuth({ id: 'user-1' })
    const req = makeRequest({ ip: '1.2.3.4' })
    const resp = await GET(req as any)
    expect(resp.status).toBe(429)
    const body = await resp.json()
    expect(body.error).toContain('Zu viele Anfragen')
  })

  // ---------- TEAM_NAME not configured ----------

  it('returns 500 when TEAM_NAME is not set', async () => {
    delete process.env.TEAM_NAME
    mockAuth({ id: 'user-1' })
    const req = makeRequest()
    const resp = await GET(req as any)
    expect(resp.status).toBe(500)
    const body = await resp.json()
    expect(body.error).toContain('TEAM_NAME')
  })

  // ---------- Successful scraping ----------

  it('returns rank and totalTeams for a found team', async () => {
    mockAuth({ id: 'user-1' })
    const html = buildMockHtml([
      { name: 'TeamA', distance: '100,50' },
      { name: 'BettercallPaul', distance: '85,30' },
      { name: 'TeamC', distance: '50,00' },
    ])

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(html),
    })

    const req = makeRequest()
    const resp = await GET(req as any)
    expect(resp.status).toBe(200)

    const body = await resp.json()
    // Teams sorted by distance: TeamA (100.50), BettercallPaul (85.30), TeamC (50.00)
    expect(body.rank).toBe(2)
    expect(body.totalTeams).toBe(3)
  })

  it('returns rank 1 for the team with highest distance', async () => {
    mockAuth({ id: 'user-1' })
    const html = buildMockHtml([
      { name: 'TeamC', distance: '50,00' },
      { name: 'BettercallPaul', distance: '200,00' },
      { name: 'TeamA', distance: '100,50' },
    ])

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(html),
    })

    const req = makeRequest()
    const resp = await GET(req as any)
    const body = await resp.json()
    expect(body.rank).toBe(1)
    expect(body.totalTeams).toBe(3)
  })

  // ---------- Team not found ----------

  it('returns 404 when team name is not in the list', async () => {
    mockAuth({ id: 'user-1' })
    const html = buildMockHtml([
      { name: 'TeamA', distance: '100,50' },
      { name: 'TeamB', distance: '50,00' },
    ])

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(html),
    })

    const req = makeRequest()
    const resp = await GET(req as any)
    expect(resp.status).toBe(404)
    const body = await resp.json()
    expect(body.error).toBe('Team nicht in der Rangliste gefunden')
  })

  // ---------- Case sensitivity ----------

  it('uses case-sensitive matching for team name', async () => {
    mockAuth({ id: 'user-1' })
    const html = buildMockHtml([
      { name: 'bettercallpaul', distance: '100,50' },
      { name: 'BETTERCALLPAUL', distance: '50,00' },
    ])

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(html),
    })

    const req = makeRequest()
    const resp = await GET(req as any)
    // "BettercallPaul" should not match "bettercallpaul" or "BETTERCALLPAUL"
    expect(resp.status).toBe(404)
  })

  // ---------- External website errors ----------

  it('returns 503 when external website returns non-ok response', async () => {
    mockAuth({ id: 'user-1' })
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    const req = makeRequest()
    const resp = await GET(req as any)
    expect(resp.status).toBe(503)
    const body = await resp.json()
    expect(body.error).toBe('Position nicht verfügbar')
  })

  it('returns 503 when fetch throws a network error', async () => {
    mockAuth({ id: 'user-1' })
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const req = makeRequest()
    const resp = await GET(req as any)
    expect(resp.status).toBe(503)
    const body = await resp.json()
    expect(body.error).toBe('Position nicht verfügbar')
  })

  it('returns 503 when fetch is aborted (timeout)', async () => {
    mockAuth({ id: 'user-1' })
    const abortError = new DOMException('The operation was aborted', 'AbortError')
    mockFetch.mockRejectedValueOnce(abortError)

    const req = makeRequest()
    const resp = await GET(req as any)
    expect(resp.status).toBe(503)
    const body = await resp.json()
    expect(body.error).toBe('Position nicht verfügbar')
  })

  // ---------- HTML structure changed ----------

  it('returns 503 when HTML has no table.team-list (structure changed)', async () => {
    mockAuth({ id: 'user-1' })
    const html = '<html><body><p>Seite wurde umgebaut</p></body></html>'

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(html),
    })

    const req = makeRequest()
    const resp = await GET(req as any)
    expect(resp.status).toBe(503)
    const body = await resp.json()
    expect(body.error).toBe('Position nicht verfügbar')
  })

  it('returns 503 when table has no valid rows', async () => {
    mockAuth({ id: 'user-1' })
    const html = '<html><body><table class="team-list"></table></body></html>'

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(html),
    })

    const req = makeRequest()
    const resp = await GET(req as any)
    expect(resp.status).toBe(503)
    const body = await resp.json()
    expect(body.error).toBe('Position nicht verfügbar')
  })

  // ---------- German number parsing ----------

  it('correctly parses German numbers with thousands separator', async () => {
    mockAuth({ id: 'user-1' })
    const html = buildMockHtml([
      { name: 'BettercallPaul', distance: '1.234,56' },
      { name: 'TeamB', distance: '2.000,00' },
    ])

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(html),
    })

    const req = makeRequest()
    const resp = await GET(req as any)
    const body = await resp.json()
    // TeamB: 2000.00, BettercallPaul: 1234.56
    expect(body.rank).toBe(2)
    expect(body.totalTeams).toBe(2)
  })

  // ---------- runnergroup-row exclusion ----------

  it('excludes rows with class runnergroup-row', async () => {
    mockAuth({ id: 'user-1' })
    const html = `<html><body><table class="team-list">
      <tr class="runnergroup-row"><td>Gruppe 1</td><td></td><td></td><td>999</td></tr>
      <tr><td><a class="team-link">BettercallPaul</a></td><td></td><td></td><td>85,30</td></tr>
      <tr><td><a class="team-link">TeamB</a></td><td></td><td></td><td>50,00</td></tr>
    </table></body></html>`

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(html),
    })

    const req = makeRequest()
    const resp = await GET(req as any)
    const body = await resp.json()
    expect(body.rank).toBe(1)
    expect(body.totalTeams).toBe(2) // runnergroup-row excluded
  })

  // ---------- Rate limit key uses correct prefix ----------

  it('uses team-ranking prefix for rate limit key', async () => {
    mockAuth({ id: 'user-1' })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(buildMockHtml([{ name: 'BettercallPaul', distance: '10' }])),
    })

    const req = makeRequest({ ip: '10.0.0.1' })
    await GET(req as any)

    expect(vi.mocked(rateLimit)).toHaveBeenCalledWith(
      'team-ranking:10.0.0.1',
      expect.objectContaining({ limit: 30, windowSeconds: 60 })
    )
  })
})
