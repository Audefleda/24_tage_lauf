/**
 * E2E Tests: Läufe-Seite
 *
 * TYPO3-Isolation: Alle API-Routen werden via page.route() abgefangen
 * und mit festen Testdaten beantwortet. Es werden KEINE echten Requests
 * an TYPO3 oder andere externe Systeme gesendet.
 *
 * Voraussetzung: E2E_TEST_EMAIL + E2E_TEST_PASSWORD gesetzt (globaler Setup
 * speichert den Auth-State). Ohne Credentials werden alle Tests übersprungen.
 */

import { test, expect, type Page } from '@playwright/test'

// Fester Testdatensatz — entspricht der API-Antwort von GET /api/runner
// Dates müssen im Event-Zeitraum liegen: 2026-04-20 bis 2026-05-14
const MOCK_RUNNER = {
  uid: 42,
  name: 'Test Läufer*in',
  age: 35,
  teamsNotificationsEnabled: true,
  runs: [
    { runDate: '2026-04-20 06:00:00', runDistance: '5.5' }, // Tag 1: Mo 20.04.
    { runDate: '2026-04-22 06:00:00', runDistance: '10' },  // Tag 3: Mi 22.04.
  ],
}

/**
 * Richtet API-Mocks für alle externen Calls ein.
 * Dadurch werden keine Daten an TYPO3 geschickt.
 */
async function mockRunnerApi(page: Page) {
  // GET /api/runner → liefert Test-Runner-Daten
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

  // PATCH /api/runner/notifications → Opt-out Toggle ohne echten DB-Write
  await page.route('**/api/runner/notifications', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })

  // POST /api/runner/runs → Lauf-Speicherung abfangen, kein TYPO3-Call
  await page.route('**/api/runner/runs', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })

  // GET /api/strava/status → Strava nicht verbunden (kein externes Call)
  await page.route('**/api/strava/status', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ connected: false }),
    })
  })
}

// Alle Tests in dieser Datei benötigen den gespeicherten Auth-State
const hasCredentials = !!(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD)

test.describe('Läufe-Seite', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredentials, 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD nicht gesetzt')
    await mockRunnerApi(page)
    await page.goto('/runs')
  })

  test('lädt die Seite und zeigt Runner-Namen', async ({ page }) => {
    await expect(page.getByText(MOCK_RUNNER.name)).toBeVisible({ timeout: 10_000 })
  })

  test('zeigt Stats-Karten mit Gesamtdistanz und Lauftagen', async ({ page }) => {
    // StatsCard: "15,50 km" Gesamtdistanz + Lauftage-Label neben der "2"
    await expect(page.getByText(/15,50 km/)).toBeVisible({ timeout: 10_000 })
    // "2" direkt nach dem "Lauftage"-Label — im gleichen Container suchen
    await expect(page.getByText('Lauftage')).toBeVisible()
    await expect(page.locator('p.text-2xl', { hasText: '2' })).toBeVisible()
  })

  test('zeigt die Lauftabelle mit Eingabefeldern', async ({ page }) => {
    // RunsTable rendert eine Zeile pro Event-Tag mit einem Input-Feld
    // Inputs haben type="text" mit aria-label "Distanz für ..."
    const firstInput = page.getByLabel(/Distanz für/, { exact: false }).first()
    await expect(firstInput).toBeVisible({ timeout: 10_000 })
  })

  test('zeigt Teams-Benachrichtigungen Toggle', async ({ page }) => {
    const toggle = page.getByRole('switch', { name: /Teams-Benachrichtigungen/i })
    await expect(toggle).toBeVisible({ timeout: 10_000 })
    await expect(toggle).toBeChecked() // teamsNotificationsEnabled: true
  })

  test('Teams-Toggle kann umgeschaltet werden (ohne externen API-Call)', async ({
    page,
  }) => {
    const toggle = page.getByRole('switch', { name: /Teams-Benachrichtigungen/i })
    await toggle.click()
    // Nach dem Klick sollte der Toggle deaktiviert sein
    await expect(toggle).not.toBeChecked()
    // Toast sollte erscheinen
    await expect(page.getByText(/deaktiviert/i)).toBeVisible({ timeout: 5_000 })
  })

  test('Authenticated-Redirect: /runs ist ohne Auth nicht erreichbar', async ({
    browser,
  }) => {
    // Neuer Kontext ohne jeglichen Auth-State
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()
    await page.goto('/runs')
    await expect(page).toHaveURL(/\/login/)
    await context.close()
  })
})

test.describe('Läufe-Seite: Inline-Bearbeitung', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredentials, 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD nicht gesetzt')
    await mockRunnerApi(page)
    await page.goto('/runs')
  })

  test('Distanz-Eingabe: Komma als Dezimaltrennzeichen wird akzeptiert', async ({
    page,
  }) => {
    const firstInput = page.getByLabel(/Distanz für/, { exact: false }).first()
    await firstInput.waitFor({ timeout: 10_000 })

    await firstInput.clear()
    await firstInput.fill('7,5')
    await firstInput.blur()

    // Kein Validierungsfehler sollte erscheinen
    await expect(page.getByText('Bitte eine gültige Zahl eingeben')).not.toBeVisible()
  })

  test('Distanz-Eingabe: Negativer Wert zeigt Validierungsfehler', async ({ page }) => {
    const firstInput = page.getByLabel(/Distanz für/, { exact: false }).first()
    await firstInput.waitFor({ timeout: 10_000 })

    await firstInput.clear()
    await firstInput.fill('-1')
    await firstInput.blur()

    await expect(page.getByText('Distanz muss 0 oder positiv sein')).toBeVisible({
      timeout: 5_000,
    })
  })

  test('Distanz-Eingabe: Zu viele Nachkommastellen zeigt Fehler', async ({ page }) => {
    const firstInput = page.getByLabel(/Distanz für/, { exact: false }).first()
    await firstInput.waitFor({ timeout: 10_000 })

    await firstInput.clear()
    await firstInput.fill('5.1234')
    await firstInput.blur()

    await expect(page.getByText('Maximal 3 Nachkommastellen')).toBeVisible({
      timeout: 5_000,
    })
  })
})
