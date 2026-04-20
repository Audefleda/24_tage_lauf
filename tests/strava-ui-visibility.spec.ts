/**
 * E2E Tests: PROJ-25 — Strava UI-Sichtbarkeit Toggle (Admin)
 *
 * TYPO3-Isolation: Alle API-Routen werden via page.route() abgefangen.
 * Es werden KEINE echten Requests an TYPO3, Supabase oder Strava gesendet.
 *
 * Test-Matrix:
 * - Admin-Seite: Toggle-Bereich sichtbar, Status-Badge, Bestaetigungs-Dialog
 * - Laeufer-Seite: Strava-Bereich ein-/ausgeblendet je nach Toggle-Status
 * - API-Validierung: Ungueltige Eingaben werden abgelehnt
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
  ],
}

// ---------- Helper: Mock all APIs needed for /runs ----------

async function mockRunsPageApis(page: Page, stravaUiVisible: boolean) {
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
      body: JSON.stringify({ visible: stravaUiVisible }),
    })
  })
}

// ---------- Helper: Mock all APIs needed for /admin ----------

async function mockAdminApis(page: Page, stravaUiVisible: boolean) {
  // Nutzer-Runner-Zuordnungen
  await page.route('**/api/admin/assignments', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'user-1', email: 'laeufer@example.com', runnerUid: 1, runnerName: 'Max Mustermann' },
        ]),
      })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
  })

  await page.route('**/api/admin/runners', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ uid: 1, name: 'Max Mustermann', age: 30 }]),
    })
  })

  await page.route('**/api/admin/strava-webhook', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ subscriptionId: null }),
    })
  })

  // Strava UI visibility — admin endpoint
  let currentVisible = stravaUiVisible
  await page.route('**/api/admin/strava/ui-visibility', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ visible: currentVisible }),
      })
    }
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      currentVisible = body.visible
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, visible: currentVisible }),
      })
    }
    return route.continue()
  })

  // External webhook status
  await page.route('**/api/admin/external-webhook/status', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ enabled: true }),
    })
  })

  await page.route('**/api/admin/request-log**', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ entries: [], total: 0 }),
    })
  })
}

// ---------- Credential checks ----------

const hasUserCredentials = !!(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD)
const hasAdminCredentials = !!(process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD)

// ==========================================================================
// Admin-Seite Tests
// ==========================================================================

test.describe('PROJ-25: Admin-Seite — Strava UI-Sichtbarkeit Toggle', () => {
  test.use({
    storageState: process.env.E2E_ADMIN_EMAIL
      ? 'tests/.auth/admin.json'
      : 'tests/.auth/user.json',
  })

  test.beforeEach(async ({ page }) => {
    test.skip(!hasAdminCredentials, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD nicht gesetzt')
  })

  // AC-1: Admin-Seite Toggle-Bereich existiert
  test('AC-1: zeigt "Strava UI-Sichtbarkeit" Card auf der Admin-Seite', async ({ page }) => {
    await mockAdminApis(page, true)
    await page.goto('/admin')

    await expect(page.getByText('Strava UI-Sichtbarkeit')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Strava-Bereich auf der Laufseite ein- oder ausblenden/)).toBeVisible()
  })

  // AC-2: Status-Badge "Sichtbar" (gruen) wenn aktiv
  test('AC-2a: zeigt gruenes "Sichtbar" Badge wenn Toggle aktiv ist', async ({ page }) => {
    await mockAdminApis(page, true)
    await page.goto('/admin')

    // Wait for the Strava UI visibility section to load
    await expect(page.getByText('Strava UI-Sichtbarkeit')).toBeVisible({ timeout: 10_000 })
    const badge = page.locator('text=Sichtbar').first()
    await expect(badge).toBeVisible({ timeout: 5_000 })
  })

  // AC-2: Status-Badge "Ausgeblendet" (grau) wenn inaktiv
  test('AC-2b: zeigt "Ausgeblendet" Badge wenn Toggle inaktiv ist', async ({ page }) => {
    await mockAdminApis(page, false)
    await page.goto('/admin')

    await expect(page.getByText('Strava UI-Sichtbarkeit')).toBeVisible({ timeout: 10_000 })
    const badge = page.locator('text=Ausgeblendet').first()
    await expect(badge).toBeVisible({ timeout: 5_000 })
  })

  // AC-2: Bestaetigungs-Dialog beim Deaktivieren
  test('AC-2c: zeigt Bestaetigungs-Dialog beim Deaktivieren', async ({ page }) => {
    await mockAdminApis(page, true)
    await page.goto('/admin')

    await expect(page.getByText('Strava UI-Sichtbarkeit')).toBeVisible({ timeout: 10_000 })

    // Find the "Ausblenden" button within the Strava UI visibility section
    const stravaSection = page.locator('div', { has: page.getByText('Strava UI-Sichtbarkeit') })
    const hideButton = stravaSection.getByRole('button', { name: 'Ausblenden' })
    await expect(hideButton).toBeVisible({ timeout: 5_000 })
    await hideButton.click()

    // Bestaetigungs-Dialog sollte erscheinen
    await expect(page.getByText('Strava-Bereich ausblenden?')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/Bestehende Strava-Verbindungen bleiben aktiv/)).toBeVisible()

    // Abbrechen-Button im Dialog
    await page.getByRole('button', { name: 'Abbrechen' }).click()
    await expect(page.getByText('Strava-Bereich ausblenden?')).not.toBeVisible()
  })

  // AC-2: Kein Dialog beim Aktivieren
  test('AC-2d: kein Bestaetigungs-Dialog beim Aktivieren', async ({ page }) => {
    await mockAdminApis(page, false)
    await page.goto('/admin')

    await expect(page.getByText('Strava UI-Sichtbarkeit')).toBeVisible({ timeout: 10_000 })

    const stravaSection = page.locator('div', { has: page.getByText('Strava UI-Sichtbarkeit') })
    const showButton = stravaSection.getByRole('button', { name: 'Sichtbar machen' })
    await expect(showButton).toBeVisible({ timeout: 5_000 })
    await showButton.click()

    // Kein Dialog — stattdessen direkte Statusaenderung
    await expect(page.getByText('Strava-Bereich ausblenden?')).not.toBeVisible()

    // Toast-Nachricht sollte erscheinen
    await expect(page.getByText(/Strava-Bereich ist jetzt sichtbar/)).toBeVisible({ timeout: 5_000 })
  })

  // AC-7: Toggle ist immer sichtbar (auch ohne registrierten Webhook)
  test('AC-7: Toggle ist sichtbar auch ohne registrierten Webhook', async ({ page }) => {
    await mockAdminApis(page, true)
    await page.goto('/admin')

    // Webhook ist nicht registriert (subscriptionId: null)
    // Toggle sollte trotzdem sichtbar sein
    await expect(page.getByText('Strava UI-Sichtbarkeit')).toBeVisible({ timeout: 10_000 })
    const stravaSection = page.locator('div', { has: page.getByText('Strava UI-Sichtbarkeit') })
    const button = stravaSection.getByRole('button', { name: /Ausblenden|Sichtbar machen/ })
    await expect(button).toBeVisible({ timeout: 5_000 })
  })

  // AC-8: Sofortige DB-Aktualisierung (Toggle via Dialog bestaetigen)
  test('AC-8: Toggle-Umschaltung aktualisiert den Status sofort', async ({ page }) => {
    await mockAdminApis(page, true)
    await page.goto('/admin')

    await expect(page.getByText('Strava UI-Sichtbarkeit')).toBeVisible({ timeout: 10_000 })

    // Schritt 1: Deaktivieren
    const stravaSection = page.locator('div', { has: page.getByText('Strava UI-Sichtbarkeit') })
    await stravaSection.getByRole('button', { name: 'Ausblenden' }).click()
    await page.getByRole('button', { name: 'Ausblenden' }).last().click() // Dialog-Bestaetigung

    // Badge sollte zu "Ausgeblendet" wechseln
    await expect(page.getByText(/Strava-Bereich ist jetzt ausgeblendet/)).toBeVisible({ timeout: 5_000 })

    // Schritt 2: Wieder aktivieren
    await stravaSection.getByRole('button', { name: 'Sichtbar machen' }).click()
    await expect(page.getByText(/Strava-Bereich ist jetzt sichtbar/)).toBeVisible({ timeout: 5_000 })
  })
})

// ==========================================================================
// Laeufer-Seite Tests
// ==========================================================================

test.describe('PROJ-25: Laeufer-Seite — Strava-Bereich Sichtbarkeit', () => {
  test.beforeEach(async () => {
    test.skip(!hasUserCredentials, 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD nicht gesetzt')
  })

  // AC-4: StravaConnectSection wird nicht gerendert wenn strava_ui_visible = false
  test('AC-4: Strava-Bereich wird nicht angezeigt wenn Toggle deaktiviert', async ({ page }) => {
    await mockRunsPageApis(page, false)
    await page.goto('/runs')

    // Runner-Name sollte sichtbar sein (Seite hat geladen)
    await expect(page.getByText(MOCK_RUNNER.name)).toBeVisible({ timeout: 10_000 })

    // Strava-Bereich sollte NICHT sichtbar sein
    await expect(page.getByText('Strava')).not.toBeVisible()
    await expect(page.getByText(/Strava verbinden/)).not.toBeVisible()
  })

  // AC-4 (inverse): StravaConnectSection wird gerendert wenn strava_ui_visible = true
  test('AC-4 (inverse): Strava-Bereich wird angezeigt wenn Toggle aktiv', async ({ page }) => {
    await mockRunsPageApis(page, true)
    await page.goto('/runs')

    await expect(page.getByText(MOCK_RUNNER.name)).toBeVisible({ timeout: 10_000 })

    // Strava-Bereich sollte sichtbar sein
    await expect(page.locator('text=Strava').first()).toBeVisible({ timeout: 5_000 })
  })

  // AC-9: Default-Wert true wenn kein Eintrag in app_settings
  test('AC-9: Strava-Bereich wird angezeigt wenn API nicht erreichbar (Default: true)', async ({ page }) => {
    // Mock runner but let strava/ui-visibility return an error
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
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
    })

    await page.route('**/api/strava/status', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ connected: false }),
      })
    })

    // Simulate API error — default should be true
    await page.route('**/api/strava/ui-visibility', (route) => {
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"DB down"}' })
    })

    await page.goto('/runs')
    await expect(page.getByText(MOCK_RUNNER.name)).toBeVisible({ timeout: 10_000 })

    // Strava-Bereich should still be visible (default: true)
    await expect(page.locator('text=Strava').first()).toBeVisible({ timeout: 5_000 })
  })
})

// ==========================================================================
// Zugriffsschutz-Tests (Sicherheit)
// ==========================================================================

test.describe('PROJ-25: Zugriffsschutz', () => {
  test('Admin-API ist ohne Auth nicht erreichbar (redirect zu /login)', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    // Middleware redirects unauthenticated API requests to /login.
    // page.request follows redirects, so we end up on the login page (200 HTML).
    // Verify by checking the response URL contains /login.
    const response = await page.request.get('/api/admin/strava/ui-visibility')
    expect(response.url()).toContain('/login')

    await context.close()
  })

  test('Admin-API POST ist ohne Auth nicht erreichbar (redirect zu /login)', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    const response = await page.request.post('/api/admin/strava/ui-visibility', {
      data: { visible: false },
    })
    expect(response.url()).toContain('/login')

    await context.close()
  })

  test('Regulaerer Nutzer kann Admin-API nicht aufrufen (403)', async ({ page }) => {
    test.skip(!hasUserCredentials, 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD nicht gesetzt')

    // User auth state is already loaded (not admin)
    const response = await page.request.get('/api/admin/strava/ui-visibility')
    expect(response.status()).toBe(403)
  })
})
