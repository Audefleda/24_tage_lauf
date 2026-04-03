/**
 * E2E Tests: Externer Webhook (PROJ-23)
 *
 * TYPO3-Isolation: Alle API-Routen werden via page.route() abgefangen
 * und mit festen Testdaten beantwortet. Es werden KEINE echten Requests
 * an TYPO3, Supabase oder andere externe Systeme gesendet.
 *
 * Tests decken ab:
 * - AC-1: Externer Webhook Bereich auf der Runs-Seite
 * - AC-2: Token-Status Anzeige (aktiv / kein Token)
 * - AC-3: Token-Generierung mit Dialog
 * - AC-4: Token nach Dialog-Schluss nicht mehr sichtbar
 * - AC-5: Anleitung (Collapsible) mit URL, Header, Body
 * - AC-13/AC-15: Admin Webhook-Steuerung
 */

import { test, expect, type Page } from '@playwright/test'

// Mock-Runner-Daten (identisch zu runs.spec.ts)
const MOCK_RUNNER = {
  uid: 42,
  name: 'Test Laeufer*in',
  age: 35,
  teamsNotificationsEnabled: true,
  runs: [
    { runDate: '2026-04-20 06:00:00', runDistance: '5.5' },
  ],
}

/**
 * Mockt alle APIs fuer die Runs-Seite inkl. Webhook-Token-Endpunkte.
 */
async function mockRunnerApiWithoutToken(page: Page) {
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

  // Webhook token: kein Token vorhanden
  await page.route('**/api/runner/webhook-token', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ active: false }),
      })
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd' }),
      })
    }
    if (route.request().method() === 'DELETE') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    }
    return route.continue()
  })
}

/**
 * Mockt alle APIs mit einem aktiven Token.
 */
async function mockRunnerApiWithToken(page: Page) {
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

  // Webhook token: Token vorhanden
  await page.route('**/api/runner/webhook-token', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          active: true,
          created_at: '2026-04-03T10:30:00.000Z',
        }),
      })
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'newtoken123456789newtoken123456789newtoken123456789newtoken12345678' }),
      })
    }
    return route.continue()
  })
}

/**
 * Mockt Admin-APIs inkl. External Webhook Status.
 */
async function mockAdminApiWithWebhookStatus(page: Page, enabled: boolean) {
  await page.route('**/api/admin/assignments', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/admin/runners', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/admin/strava-webhook', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ subscriptionId: null }),
    })
  })

  await page.route('**/api/admin/request-log**', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ entries: [], total: 0 }),
    })
  })

  await page.route('**/api/admin/external-webhook/status', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled }),
      })
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, enabled: !enabled }),
      })
    }
    return route.continue()
  })
}

// ─── Runner-Seite: Kein Token vorhanden ──────────────────────────

test.describe('Externer Webhook: Kein Token', () => {
  test.beforeEach(async ({ page }) => {
    await mockRunnerApiWithoutToken(page)
    await page.goto('/runs')
  })

  test('AC-1: Externer Webhook Bereich ist auf der Runs-Seite sichtbar', async ({
    page,
  }) => {
    await expect(page.getByText('Externer Webhook')).toBeVisible({ timeout: 10_000 })
  })

  test('AC-2: Zeigt "Kein Token" Badge wenn kein Token vorhanden', async ({ page }) => {
    await expect(page.getByText('Kein Token')).toBeVisible({ timeout: 10_000 })
    await expect(
      page.getByText('Erstelle einen Token, um den Webhook zu nutzen.')
    ).toBeVisible()
  })

  test('AC-2: Zeigt "Token generieren" Button wenn kein Token vorhanden', async ({
    page,
  }) => {
    await expect(
      page.getByRole('button', { name: 'Token generieren' })
    ).toBeVisible({ timeout: 10_000 })
  })

  test('AC-3: Token-Generierung zeigt einmaligen Dialog mit Token', async ({ page }) => {
    const generateButton = page.getByRole('button', { name: 'Token generieren' })
    await generateButton.waitFor({ timeout: 10_000 })
    await generateButton.click()

    // Dialog mit Token sollte erscheinen
    await expect(page.getByText('Dein neuer Webhook-Token')).toBeVisible({ timeout: 5_000 })
    await expect(
      page.getByText(/Dieser Token wird nur einmal angezeigt/)
    ).toBeVisible()
  })

  test('AC-3 + AC-4: Token-Dialog zeigt Token und verschwindet nach Schluss', async ({
    page,
  }) => {
    const generateButton = page.getByRole('button', { name: 'Token generieren' })
    await generateButton.waitFor({ timeout: 10_000 })
    await generateButton.click()

    // Token-Dialog ist sichtbar
    await expect(page.getByText('Dein neuer Webhook-Token')).toBeVisible({ timeout: 5_000 })

    // "Verstanden" Button klicken
    const verstandenButton = page.getByRole('button', { name: 'Verstanden' })
    await verstandenButton.click()

    // Dialog sollte geschlossen sein
    await expect(page.getByText('Dein neuer Webhook-Token')).not.toBeVisible()
  })

  test('AC-5: Anleitung ist nicht sichtbar wenn kein Token aktiv', async ({ page }) => {
    // Warte bis der Bereich geladen ist
    await expect(page.getByText('Kein Token')).toBeVisible({ timeout: 10_000 })
    // Anleitung sollte nicht sichtbar sein (nur bei aktivem Token)
    await expect(
      page.getByText('Anleitung: Make.com / Zapier / curl einrichten')
    ).not.toBeVisible()
  })
})

// ─── Runner-Seite: Token vorhanden ───────────────────────────────

test.describe('Externer Webhook: Token aktiv', () => {
  test.beforeEach(async ({ page }) => {
    await mockRunnerApiWithToken(page)
    await page.goto('/runs')
  })

  test('AC-2: Zeigt "Aktiv" Badge mit Datum wenn Token vorhanden', async ({ page }) => {
    await expect(page.getByText('Aktiv', { exact: true })).toBeVisible({ timeout: 10_000 })
    // Datum im deutschen Format (03.04.2026)
    await expect(page.getByText(/seit.*03\.04\.2026/)).toBeVisible()
  })

  test('AC-2: Zeigt "Token neu generieren" Button wenn Token vorhanden', async ({
    page,
  }) => {
    await expect(
      page.getByRole('button', { name: 'Token neu generieren' })
    ).toBeVisible({ timeout: 10_000 })
  })

  test('AC-5: Anleitung ist sichtbar (collapsed) und aufklappbar', async ({ page }) => {
    const anleitungButton = page.getByText(
      'Anleitung: Make.com / Zapier / curl einrichten'
    )
    await expect(anleitungButton).toBeVisible({ timeout: 10_000 })

    // Aufklappen
    await anleitungButton.click()

    // Nach dem Aufklappen sollte die Webhook-URL sichtbar sein
    await expect(page.getByText('/api/webhook/external')).toBeVisible({ timeout: 5_000 })
    // Header-Anleitung sichtbar
    await expect(page.getByText('Authorization: Bearer')).toBeVisible()
    // Beispiel-Body sichtbar
    await expect(page.getByText('"distance_km"')).toBeVisible()
  })

  test('AC-5: Webhook-URL hat einen Kopier-Button', async ({ page }) => {
    const anleitungButton = page.getByText(
      'Anleitung: Make.com / Zapier / curl einrichten'
    )
    await anleitungButton.waitFor({ timeout: 10_000 })
    await anleitungButton.click()

    // Kopier-Button fuer die URL
    await expect(
      page.getByRole('button', { name: 'Webhook-URL kopieren' })
    ).toBeVisible({ timeout: 5_000 })
  })

  test('EC-1: Regenerierung zeigt Bestaetigungs-Dialog', async ({ page }) => {
    const regenButton = page.getByRole('button', { name: 'Token neu generieren' })
    await regenButton.waitFor({ timeout: 10_000 })
    await regenButton.click()

    // Bestaetigungs-Dialog erscheint
    await expect(page.getByText('Token neu generieren?')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/sofort ungueltig/)).toBeVisible()

    // "Abbrechen" ist verfuegbar
    await expect(page.getByRole('button', { name: 'Abbrechen' })).toBeVisible()
  })

  test('EC-1: Bestaetigungs-Dialog kann abgebrochen werden', async ({ page }) => {
    const regenButton = page.getByRole('button', { name: 'Token neu generieren' })
    await regenButton.waitFor({ timeout: 10_000 })
    await regenButton.click()

    await expect(page.getByText('Token neu generieren?')).toBeVisible({ timeout: 5_000 })

    // Abbrechen klicken
    await page.getByRole('button', { name: 'Abbrechen' }).click()

    // Dialog sollte geschlossen sein
    await expect(page.getByText('Token neu generieren?')).not.toBeVisible()
  })

  test('AC-3: Token-Dialog hat Anzeigen/Verbergen Toggle', async ({ page }) => {
    // Regenerierung bestaetigen, um Token-Dialog zu oeffnen
    const regenButton = page.getByRole('button', { name: 'Token neu generieren' })
    await regenButton.waitFor({ timeout: 10_000 })
    await regenButton.click()

    // Im Bestaetigungs-Dialog auf "Token neu generieren" klicken
    const confirmButton = page.getByRole('button', { name: 'Token neu generieren' }).last()
    await confirmButton.click()

    // Token-Dialog erscheint
    await expect(page.getByText('Dein neuer Webhook-Token')).toBeVisible({ timeout: 5_000 })

    // Toggle-Buttons sind vorhanden (Anzeigen/Verbergen + Kopieren)
    await expect(
      page.getByRole('button', { name: /Token verbergen|Token anzeigen/ })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Token kopieren' })
    ).toBeVisible()
  })
})

// ─── Admin-Seite: Webhook-Steuerung ─────────────────────────────

test.describe('Admin: Externer Webhook Steuerung', () => {
  test.use({
    storageState: process.env.E2E_ADMIN_EMAIL
      ? 'tests/.auth/admin.json'
      : 'tests/.auth/user.json',
  })

  test('AC-15: Zeigt Webhook-Status "Aktiv" Badge und Deaktivieren-Button', async ({
    page,
  }) => {
    await mockAdminApiWithWebhookStatus(page, true)
    await page.goto('/admin')

    await expect(page.getByText('Externer Webhook').first()).toBeVisible({ timeout: 10_000 })
    // "Aktiv" Badge in der Webhook-Control-Sektion
    await expect(
      page.getByText('Webhook-Aufrufe werden an TYPO3 weitergeleitet.')
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Webhook deaktivieren' })
    ).toBeVisible()
  })

  test('AC-15: Zeigt Webhook-Status "Deaktiviert" Badge und Aktivieren-Button', async ({
    page,
  }) => {
    await mockAdminApiWithWebhookStatus(page, false)
    await page.goto('/admin')

    await expect(page.getByText('Deaktiviert')).toBeVisible({ timeout: 10_000 })
    await expect(
      page.getByText('Alle Webhook-Aufrufe werden mit 503 abgewiesen.')
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Webhook aktivieren' })
    ).toBeVisible()
  })

  test('AC-15: Deaktivieren zeigt Bestaetigungs-Dialog', async ({ page }) => {
    await mockAdminApiWithWebhookStatus(page, true)
    await page.goto('/admin')

    const deactivateButton = page.getByRole('button', { name: 'Webhook deaktivieren' })
    await deactivateButton.waitFor({ timeout: 10_000 })
    await deactivateButton.click()

    // Bestaetigungs-Dialog
    await expect(page.getByText('Webhook deaktivieren?')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/503 Service Unavailable/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Abbrechen' })).toBeVisible()
  })
})
