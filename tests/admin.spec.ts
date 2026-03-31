/**
 * E2E Tests: Admin-Seite
 *
 * TYPO3-Isolation: Alle Admin-API-Routen werden via page.route() abgefangen.
 * Es werden KEINE echten Requests an TYPO3 oder Supabase Admin-APIs gesendet.
 *
 * Tests ohne Admin-Credentials prüfen nur, dass der Redirect für Nicht-Admins
 * korrekt funktioniert (kein Login nötig).
 *
 * Tests mit Admin-Credentials (E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD) testen
 * die Admin-Seite selbst.
 */

import { test, expect, type Page } from '@playwright/test'

// Mock-Daten für Admin-APIs
const MOCK_ASSIGNMENT_TABLE = [
  {
    id: 'user-1',
    email: 'laeufer@example.com',
    runnerUid: 1,
    runnerName: 'Max Mustermann',
  },
  {
    id: 'user-2',
    email: 'laeufer2@example.com',
    runnerUid: null,
    runnerName: null,
  },
]

const MOCK_RUNNERS = [
  { uid: 1, name: 'Max Mustermann', age: 30 },
  { uid: 2, name: 'Maria Musterfrau', age: 28 },
]

/**
 * Mockt alle Admin-API-Routen.
 */
async function mockAdminApi(page: Page) {
  // GET /api/admin/assignments → Nutzer-Runner-Zuordnungen
  await page.route('**/api/admin/assignments', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ASSIGNMENT_TABLE),
      })
    }
    // PATCH → Zuordnung speichern (kein echter DB-Write)
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })

  // GET /api/admin/runners → TYPO3-Läuferliste (kein TYPO3-Call)
  await page.route('**/api/admin/runners', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_RUNNERS),
    })
  })

  // GET /api/admin/strava-webhook → Webhook-Status
  await page.route('**/api/admin/strava-webhook', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ subscriptionId: null }),
      })
    }
    return route.continue()
  })

  // GET /api/admin/request-log → leere Log-Liste
  await page.route('**/api/admin/request-log**', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ entries: [], total: 0 }),
    })
  })
}

// Credential-Flags
const hasUserCredentials = !!(
  process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD
)
const hasAdminCredentials = !!(
  process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD
)

test.describe('Admin-Seite: Zugriffsschutz', () => {
  test('leitet unauthentifizierten Nutzer zu /login weiter', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/login/)
    await context.close()
  })

  test('regulärer Nutzer ohne Admin-Rolle wird von /admin weggeleitet', async ({
    page,
  }) => {
    test.skip(!hasUserCredentials, 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD nicht gesetzt')

    // Mit regulärem User-Auth-State zur Admin-Seite navigieren
    await page.goto('/admin')

    // Middleware leitet Nicht-Admins zur Startseite weiter
    await expect(page).not.toHaveURL(/\/admin/)
  })
})

test.describe('Admin-Seite: Inhalt', () => {
  // Diese Tests benötigen Admin-Credentials
  test.use({
    storageState: process.env.E2E_ADMIN_EMAIL
      ? 'tests/.auth/admin.json'
      : 'tests/.auth/user.json',
  })

  test.beforeEach(async ({ page }) => {
    test.skip(
      !hasAdminCredentials,
      'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD nicht gesetzt'
    )
    await mockAdminApi(page)
    await page.goto('/admin')
  })

  test('zeigt alle Admin-Sektionen', async ({ page }) => {
    await expect(page.getByText('Nutzer*innenverwaltung')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Strava Webhook')).toBeVisible()
    await expect(page.getByText('TYPO3 Request Log')).toBeVisible()
  })

  test('zeigt Link zum Request Log', async ({ page }) => {
    const logLink = page.getByRole('link', { name: /Request Log öffnen/i })
    await expect(logLink).toBeVisible({ timeout: 10_000 })
    await expect(logLink).toHaveAttribute('href', '/admin/request-log')
  })

  test('Request Log Seite ist zugänglich', async ({ page }) => {
    await mockAdminApi(page)
    await page.goto('/admin/request-log')
    // Seite sollte laden, nicht zu /login weiterleiten
    await expect(page).not.toHaveURL(/\/login/)
  })
})
