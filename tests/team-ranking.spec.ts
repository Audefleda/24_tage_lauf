/**
 * E2E Tests: PROJ-28 -- Team-Rangposition anzeigen
 *
 * Alle API-Routen werden via page.route() abgefangen.
 * Es werden KEINE echten Requests an externe Systeme gesendet.
 *
 * Test-Matrix:
 * - AC-1: Neues Kaestchen "Team-Position" auf der Laeufe-Seite
 * - AC-2: Rangposition wird angezeigt (z.B. "Platz 5")
 * - AC-3: Position wird bei jedem Seitenaufruf live aktualisiert
 * - AC-4: Bei Scraping-Fehlern wird "nicht verfuegbar" angezeigt
 * - AC-5: Kaestchen ist fuer alle eingeloggten Nutzer*innen sichtbar
 * - AC-6: Team-Name via Env-Variable (getestet via Unit Test)
 * - AC-7: Design folgt CI (visuell, Grundpruefung)
 * - AC-8: Team-Position auch auf Rangliste-Seite
 * - EC-1: Externe Website nicht erreichbar
 * - EC-2: Team-Name nicht gefunden
 * - EC-3: Langsame API-Antwort (Timeout)
 */

import { test, expect, type Page } from '@playwright/test'

// ---------- Mock data ----------

const MOCK_RUNNER = {
  uid: 42,
  name: 'Test Laeufer*in',
  age: 35,
  teamsNotificationsEnabled: true,
  runs: [
    { runDate: '2026-04-20 06:00:00', runDistance: '5.5' },
    { runDate: '2026-04-22 06:00:00', runDistance: '10' },
  ],
}

// ---------- Helper: Mock all APIs needed for /runs ----------

async function mockAllApis(
  page: Page,
  rankingResponse: { rank: number; totalTeams: number } | { error: string } | null,
  rankingStatus = 200,
  options?: { delayRankingMs?: number }
) {
  await page.route('**/api/runner', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_RUNNER),
      })
    }
    return route.continue()
  })

  await page.route('**/api/runner/notifications', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })

  await page.route('**/api/runner/runs', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })

  await page.route('**/api/strava/status', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ connected: false }),
    })
  })

  await page.route('**/api/strava/ui-visibility', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ visible: true }),
    })
  })

  await page.route('**/api/team/stats', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalKm: 332.0 }),
    })
  })

  await page.route('**/api/team/ranking', async (route) => {
    if (options?.delayRankingMs) {
      await new Promise((resolve) => setTimeout(resolve, options.delayRankingMs))
    }

    if (rankingResponse === null) {
      return route.fulfill({
        status: rankingStatus,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Position nicht verfügbar' }),
      })
    }

    return route.fulfill({
      status: rankingStatus,
      contentType: 'application/json',
      body: JSON.stringify(rankingResponse),
    })
  })
}

/**
 * Locate the team ranking Card.
 */
function rankingCard(page: Page) {
  return page.locator('[class*="bg-card"]', {
    has: page.getByText('Team-Position'),
  })
}

// ---------- Credential checks ----------

const hasCredentials = !!(
  process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD
)

// ==========================================================================

test.describe('PROJ-28: Team-Rangposition anzeigen', () => {
  test.beforeEach(async () => {
    test.skip(
      !hasCredentials,
      'E2E_TEST_EMAIL / E2E_TEST_PASSWORD nicht gesetzt'
    )
  })

  // AC-1: Neues Kaestchen "Team-Position" auf der Laeufe-Seite
  test('AC-1: zeigt Kaestchen "Team-Position" auf der /runs-Seite', async ({
    page,
  }) => {
    await mockAllApis(page, { rank: 5, totalTeams: 42 })
    await page.goto('/runs')

    await expect(page.getByText('Team-Position')).toBeVisible({
      timeout: 10_000,
    })
  })

  // AC-2: Rangposition wird angezeigt (z.B. "Platz 5")
  test('AC-2: zeigt die aktuelle Rangposition (z.B. "Platz 5")', async ({
    page,
  }) => {
    await mockAllApis(page, { rank: 5, totalTeams: 42 })
    await page.goto('/runs')

    const card = rankingCard(page)
    await expect(card).toBeVisible({ timeout: 10_000 })
    await expect(card.getByText('Platz 5')).toBeVisible()
  })

  // AC-3: Position wird bei jedem Seitenaufruf live aktualisiert (kein Caching)
  test('AC-3: Position wird bei jedem Seitenaufruf live abgefragt', async ({
    page,
  }) => {
    let callCount = 0
    await page.route('**/api/runner', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_RUNNER),
        })
      }
      return route.continue()
    })

    await page.route('**/api/runner/notifications', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    )
    await page.route('**/api/strava/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ connected: false }),
      })
    )
    await page.route('**/api/strava/ui-visibility', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ visible: true }),
      })
    )
    await page.route('**/api/team/stats', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ totalKm: 332.0 }),
      })
    )

    await page.route('**/api/team/ranking', (route) => {
      callCount++
      const rank = callCount === 1 ? 5 : 3
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rank, totalTeams: 42 }),
      })
    })

    // First load
    await page.goto('/runs')
    const card = rankingCard(page)
    await expect(card.getByText('Platz 5')).toBeVisible({ timeout: 10_000 })

    // Second load
    await page.goto('/runs')
    await expect(card.getByText('Platz 3')).toBeVisible({ timeout: 10_000 })

    // Verify the API was called at least twice
    expect(callCount).toBeGreaterThanOrEqual(2)
  })

  // AC-4: Bei Scraping-Fehlern wird "nicht verfuegbar" angezeigt
  test('AC-4: zeigt "nicht verfuegbar" bei API-Fehler', async ({
    page,
  }) => {
    await mockAllApis(page, null, 503)
    await page.goto('/runs')

    const card = rankingCard(page)
    await expect(card).toBeVisible({ timeout: 10_000 })
    await expect(
      card.getByText('nicht verfügbar')
    ).toBeVisible({ timeout: 5_000 })
  })

  // AC-5: Kaestchen ist fuer alle eingeloggten Nutzer*innen sichtbar
  test('AC-5: Kaestchen ist nach Login sichtbar', async ({ page }) => {
    await mockAllApis(page, { rank: 5, totalTeams: 42 })
    await page.goto('/runs')

    await expect(rankingCard(page)).toBeVisible({ timeout: 10_000 })
  })

  // AC-7: Design folgt CI — Trophy-Icon vorhanden
  test('AC-7: Trophy-Icon ist im Ranking-Kaestchen vorhanden', async ({
    page,
  }) => {
    await mockAllApis(page, { rank: 5, totalTeams: 42 })
    await page.goto('/runs')

    const card = rankingCard(page)
    await expect(card).toBeVisible({ timeout: 10_000 })

    const icon = card.locator('svg')
    await expect(icon.first()).toBeVisible()
  })

  // AC-7: Grid-Layout hat 4 Karten
  test('AC-7: StatsCard-Grid enthaelt 4 Karten', async ({ page }) => {
    await mockAllApis(page, { rank: 5, totalTeams: 42 })
    await page.goto('/runs')

    await expect(page.getByText('Team-Position')).toBeVisible({
      timeout: 10_000,
    })

    const statsGrid = page.locator('.xl\\:grid-cols-4', {
      has: page.getByText('Gesamtdistanz'),
    })
    await expect(statsGrid).toBeVisible()

    const cards = statsGrid.locator('[class*="bg-card"]')
    await expect(cards).toHaveCount(4)
  })

  // ---------- Edge Cases ----------

  // EC-1: Externe Website nicht erreichbar
  test('EC-1: zeigt Fehlertext bei nicht erreichbarer externer Website', async ({
    page,
  }) => {
    await mockAllApis(page, { error: 'Position nicht verfügbar' }, 503)
    await page.goto('/runs')

    const card = rankingCard(page)
    await expect(card).toBeVisible({ timeout: 10_000 })
    await expect(
      card.getByText('nicht verfügbar')
    ).toBeVisible({ timeout: 5_000 })

    // Rest of page should still work
    await expect(page.getByText('Gesamtdistanz')).toBeVisible()
    await expect(page.getByText('Lauftage')).toBeVisible()
  })

  // EC-2: Team-Name nicht gefunden
  test('EC-2: zeigt Fehlertext wenn Team nicht in Rangliste gefunden', async ({
    page,
  }) => {
    await mockAllApis(
      page,
      { error: 'Team nicht in der Rangliste gefunden' },
      404
    )
    await page.goto('/runs')

    const card = rankingCard(page)
    await expect(card).toBeVisible({ timeout: 10_000 })
    await expect(
      card.getByText('nicht verfügbar')
    ).toBeVisible({ timeout: 5_000 })
  })

  // EC-3: Langsame API-Antwort — Skeleton wird gezeigt
  test('EC-3: zeigt Skeleton waehrend des Ladens und Daten nach Antwort', async ({
    page,
  }) => {
    await mockAllApis(page, { rank: 5, totalTeams: 42 }, 200, {
      delayRankingMs: 3000,
    })
    await page.goto('/runs')

    await expect(page.getByText(MOCK_RUNNER.name)).toBeVisible({
      timeout: 10_000,
    })

    const card = rankingCard(page)
    await expect(card).toBeVisible({ timeout: 5_000 })
    const skeleton = card.locator('.animate-pulse')
    await expect(skeleton).toBeVisible({ timeout: 5_000 })

    await expect(card.getByText('Platz 5')).toBeVisible({ timeout: 10_000 })
  })

  // Ranking-Fehler beeinflusst andere Stats nicht
  test('Persoenliche Stats und Team-Stats bleiben sichtbar bei Ranking-Fehler', async ({
    page,
  }) => {
    await mockAllApis(page, null, 503)
    await page.goto('/runs')

    await expect(page.getByText(/15,50 km/)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Lauftage')).toBeVisible()
    await expect(page.getByText('332,00 km')).toBeVisible()
  })

  // Verschiedene Rang-Positionen korrekt angezeigt
  test('Zeigt Platz 1 korrekt an', async ({ page }) => {
    await mockAllApis(page, { rank: 1, totalTeams: 10 })
    await page.goto('/runs')

    const card = rankingCard(page)
    await expect(card).toBeVisible({ timeout: 10_000 })
    await expect(card.getByText('Platz 1')).toBeVisible()
  })

  test('Zeigt letzten Platz korrekt an', async ({ page }) => {
    await mockAllApis(page, { rank: 100, totalTeams: 100 })
    await page.goto('/runs')

    const card = rankingCard(page)
    await expect(card).toBeVisible({ timeout: 10_000 })
    await expect(card.getByText('Platz 100')).toBeVisible()
  })

  // Auth protection
  test('API /api/team/ranking ist ohne Auth nicht erreichbar', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const page = await context.newPage()

    const response = await page.request.get('/api/team/ranking')
    expect(response.url()).toContain('/login')

    await context.close()
  })
})
