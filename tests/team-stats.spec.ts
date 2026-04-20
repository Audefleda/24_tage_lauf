/**
 * E2E Tests: PROJ-26 — Team-Gesamtkilometer in UI anzeigen
 *
 * TYPO3-Isolation: Alle API-Routen werden via page.route() abgefangen.
 * Es werden KEINE echten Requests an TYPO3 oder andere externe Systeme gesendet.
 *
 * Test-Matrix:
 * - AC-1: Neue StatsCard "Team-Gesamt BettercallPaul" wird angezeigt
 * - AC-2: 3 Karten nebeneinander im Grid
 * - AC-3: 100km-Cap pro Laeufer*in wird angewendet
 * - AC-6: Nur Summe, keine Laeufer*innen-Liste
 * - AC-8: Skeleton-Placeholder waehrend des Ladens
 * - AC-9: "--" bei Fehler
 * - AC-10: Format "XXX,XX km"
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
  teamStats: { totalKm: number } | null,
  teamStatsStatus = 200
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
    if (teamStats === null) {
      return route.fulfill({
        status: teamStatsStatus,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'TYPO3 nicht erreichbar' }),
      })
    }
    return route.fulfill({
      status: teamStatsStatus,
      contentType: 'application/json',
      body: JSON.stringify(teamStats),
    })
  })
}

/**
 * Locate the team stats Card. The StatsCard component renders a grid with
 * Card elements (div.bg-card). We find the specific Card that contains
 * the "Team-Gesamt BettercallPaul" label.
 */
function teamCard(page: Page) {
  return page.locator('.bg-card', {
    has: page.getByText('Team-Gesamt BettercallPaul'),
  })
}

// ---------- Credential checks ----------

const hasCredentials = !!(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD)

// ==========================================================================

test.describe('PROJ-26: Team-Gesamtkilometer in UI', () => {
  test.beforeEach(async () => {
    test.skip(!hasCredentials, 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD nicht gesetzt')
  })

  // AC-1: StatsCard "Team-Gesamt BettercallPaul" angezeigt
  test('AC-1: zeigt StatsCard "Team-Gesamt BettercallPaul" auf der /runs-Seite', async ({
    page,
  }) => {
    await mockAllApis(page, { totalKm: 332.0 })
    await page.goto('/runs')

    await expect(
      page.getByText('Team-Gesamt BettercallPaul')
    ).toBeVisible({ timeout: 10_000 })
  })

  // AC-2: 3 Karten nebeneinander (Grid-Layout)
  test('AC-2: drei StatsCards werden im Grid angezeigt', async ({ page }) => {
    await mockAllApis(page, { totalKm: 332.0 })
    await page.goto('/runs')

    // All three labels should be visible
    await expect(page.getByText('Gesamtdistanz')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Lauftage')).toBeVisible()
    await expect(page.getByText('Team-Gesamt BettercallPaul')).toBeVisible()

    // The stats grid (with xl:grid-cols-3) should contain exactly 3 Card elements
    const statsGrid = page.locator('.xl\\:grid-cols-3')
    const cards = statsGrid.locator('.bg-card')
    await expect(cards).toHaveCount(3)
  })

  // AC-3: 100km-Cap pro Laeufer*in (tested via API response value)
  test('AC-3: zeigt gekappte Team-Summe (Wert aus API)', async ({ page }) => {
    await mockAllApis(page, { totalKm: 332.0 })
    await page.goto('/runs')

    await expect(page.getByText('332,00 km')).toBeVisible({ timeout: 10_000 })
  })

  // AC-6: Nur Summe, keine Laeufer*innen-Liste
  test('AC-6: zeigt nur die Summe, keine einzelnen Laeufer*innen', async ({
    page,
  }) => {
    await mockAllApis(page, { totalKm: 332.0 })
    await page.goto('/runs')

    const card = teamCard(page)
    await expect(card).toBeVisible({ timeout: 10_000 })

    // Card should show the km value
    await expect(card.getByText('332,00 km')).toBeVisible()

    // Should not contain "gekappt" or detail text
    await expect(card.getByText(/gekappt/i)).not.toBeVisible()
  })

  // AC-8: Skeleton-Placeholder waehrend des Ladens
  test('AC-8: zeigt Skeleton waehrend Team-Stats geladen werden', async ({
    page,
  }) => {
    // Set up all APIs except team stats (which we delay)
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

    // Delay team stats API by 3 seconds
    await page.route('**/api/team/stats', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000))
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ totalKm: 332.0 }),
      })
    })

    await page.goto('/runs')

    // Wait for the page to render the runner data (personal stats loaded)
    await expect(page.getByText(MOCK_RUNNER.name)).toBeVisible({ timeout: 10_000 })

    // The team card should show a skeleton (animate-pulse class) while loading
    const card = teamCard(page)
    await expect(card).toBeVisible({ timeout: 5_000 })
    const skeleton = card.locator('.animate-pulse')
    await expect(skeleton).toBeVisible({ timeout: 5_000 })

    // After response arrives, value should appear
    await expect(card.getByText('332,00 km')).toBeVisible({ timeout: 10_000 })
  })

  // AC-9: "--" bei Fehler (API nicht erreichbar)
  test('AC-9: zeigt "--" wenn Team-Stats-API einen Fehler zurueckgibt', async ({
    page,
  }) => {
    await mockAllApis(page, null, 503)
    await page.goto('/runs')

    const card = teamCard(page)
    await expect(card).toBeVisible({ timeout: 10_000 })

    // Team card should show "--" as the value
    await expect(card.locator('p.text-2xl', { hasText: '--' })).toBeVisible({ timeout: 5_000 })
  })

  // AC-10: Format "XXX,XX km" (deutsches Zahlenformat)
  test('AC-10: zeigt Team-Summe im Format "XXX,XX km"', async ({ page }) => {
    await mockAllApis(page, { totalKm: 1234.56 })
    await page.goto('/runs')

    await expect(page.getByText('1234,56 km')).toBeVisible({ timeout: 10_000 })
  })

  test('AC-10: zeigt "0,00 km" wenn alle Laeufer bei 0km', async ({ page }) => {
    await mockAllApis(page, { totalKm: 0 })
    await page.goto('/runs')

    const card = teamCard(page)
    await expect(card).toBeVisible({ timeout: 10_000 })
    await expect(card.getByText('0,00 km')).toBeVisible({ timeout: 5_000 })
  })

  // Persoenliche Stats bleiben sichtbar auch bei Team-Stats-Fehler
  test('Persoenliche Stats bleiben sichtbar bei Team-Stats-Fehler', async ({
    page,
  }) => {
    await mockAllApis(page, null, 503)
    await page.goto('/runs')

    // Personal stats should still display correctly
    await expect(page.getByText(/15,50 km/)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Lauftage')).toBeVisible()
    await expect(page.locator('p.text-2xl', { hasText: '2' })).toBeVisible()
  })

  // Team-Stats werden nach Lauf-Aenderung aktualisiert (refresh)
  test('Team-Stats werden nach Lauf-Aenderung aktualisiert', async ({ page }) => {
    let teamStatsCallCount = 0
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
      teamStatsCallCount++
      const km = teamStatsCallCount === 1 ? 332.0 : 340.5
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ totalKm: km }),
      })
    })

    await page.goto('/runs')

    // Initial load: 332,00 km
    await expect(page.getByText('332,00 km')).toBeVisible({ timeout: 10_000 })

    // Trigger a run save (fill input and blur)
    const firstInput = page.getByLabel(/Distanz f/, { exact: false }).first()
    await firstInput.waitFor({ timeout: 10_000 })
    await firstInput.clear()
    await firstInput.fill('8.5')
    await firstInput.blur()

    // After save + refresh: should show updated team stats (340,50 km)
    await expect(page.getByText('340,50 km')).toBeVisible({ timeout: 10_000 })
  })

  // Auth protection: /api/team/stats nicht erreichbar ohne Auth
  test('API ist ohne Auth nicht erreichbar (redirect zu /login)', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const page = await context.newPage()

    const response = await page.request.get('/api/team/stats')
    expect(response.url()).toContain('/login')

    await context.close()
  })
})
