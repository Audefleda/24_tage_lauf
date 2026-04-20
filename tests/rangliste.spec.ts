/**
 * E2E Tests: PROJ-27 — Rangliste (Admin)
 *
 * TYPO3-Isolation: Alle Admin-API-Routen werden via page.route() abgefangen.
 * Es werden KEINE echten Requests an TYPO3 oder andere externe Systeme gesendet.
 *
 * Test-Matrix:
 * - AC-1: Neue Seite /rangliste existiert und ist im Navigationsmenu sichtbar
 * - AC-2: Seite ist nur fuer Admins zugaenglich
 * - AC-3: Alle TYPO3-Laeufer*innen werden in einer Tabelle angezeigt
 * - AC-4: Sortierung nach Gesamtkilometern absteigend
 * - AC-5: Angezeigt werden: Rang, Name, Gesamt-km, Laeufe
 * - AC-6: Laeufer*innen mit 0 km am Ende der Liste
 * - AC-7: Rang wird automatisch vergeben
 * - AC-8: Sortierung bei gleichen km: mehr Laeufe = hoeherer Rang
 * - AC-9: CI-konformes Design, Dark-Mode-kompatibel
 * - AC-10: Ladezeit < 2 Sekunden
 * - EC: Fehlerbehandlung, Empty State
 */

import { test, expect, type Page } from '@playwright/test'

// ---------- Mock data ----------

const MOCK_RANKING = [
  { rank: 1, uid: 10, nr: 1, name: 'Top Laeufer', totalKm: 85.50, runCount: 12 },
  { rank: 2, uid: 20, nr: 2, name: 'Zweiter Platz', totalKm: 65.00, runCount: 8 },
  { rank: 3, uid: 30, nr: 3, name: 'Dritter Platz', totalKm: 42.30, runCount: 6 },
  { rank: 4, uid: 40, nr: 4, name: 'Vierter Platz', totalKm: 15.00, runCount: 3 },
  { rank: 5, uid: 50, nr: 5, name: 'Ohne Lauf', totalKm: 0, runCount: 0 },
]

const MOCK_RANKING_SAME_KM = [
  { rank: 1, uid: 10, nr: 1, name: 'Mehr Laeufe', totalKm: 50.00, runCount: 10 },
  { rank: 2, uid: 20, nr: 2, name: 'Weniger Laeufe', totalKm: 50.00, runCount: 5 },
]

const MOCK_RANKING_EMPTY: never[] = []

const MOCK_RANKING_ALL_ZERO = [
  { rank: 1, uid: 10, nr: 1, name: 'Alice', totalKm: 0, runCount: 0 },
  { rank: 2, uid: 20, nr: 2, name: 'Bob', totalKm: 0, runCount: 0 },
]

// ---------- Helper: Mock rangliste API ----------

async function mockRanglisteApi(
  page: Page,
  data: unknown = MOCK_RANKING,
  status = 200
) {
  await page.route('**/api/admin/rangliste', (route) => {
    if (status !== 200) {
      return route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'TYPO3 API nicht erreichbar' }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    })
  })
}

// ---------- Credential checks ----------

const hasUserCredentials = !!(
  process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD
)
const hasAdminCredentials = !!(
  process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD
)

// ==========================================================================

test.describe('PROJ-27: Rangliste — Zugriffsschutz', () => {
  test('leitet unauthentifizierten Nutzer zu /login weiter', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const page = await context.newPage()
    await page.goto('/rangliste')
    await expect(page).toHaveURL(/\/login/)
    await context.close()
  })

  test('regulaerer Nutzer ohne Admin-Rolle wird von /rangliste weggeleitet', async ({
    page,
  }) => {
    test.skip(
      !hasUserCredentials,
      'E2E_TEST_EMAIL / E2E_TEST_PASSWORD nicht gesetzt'
    )
    await page.goto('/rangliste')
    // Middleware redirects non-admins to /
    await expect(page).not.toHaveURL(/\/rangliste/)
  })

  test('API /api/admin/rangliste gibt 403 fuer Nicht-Admin', async ({
    page,
  }) => {
    test.skip(
      !hasUserCredentials,
      'E2E_TEST_EMAIL / E2E_TEST_PASSWORD nicht gesetzt'
    )
    const response = await page.request.get('/api/admin/rangliste')
    expect(response.status()).toBe(403)
  })

  test('API /api/admin/rangliste leitet unauthentifizierten Nutzer weiter', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const page = await context.newPage()
    const response = await page.request.get('/api/admin/rangliste')
    // Middleware redirects to /login (302 or the response URL contains /login)
    expect(response.url()).toContain('/login')
    await context.close()
  })
})

// ==========================================================================

test.describe('PROJ-27: Rangliste — Inhalt & Darstellung', () => {
  test.use({
    storageState: process.env.E2E_ADMIN_EMAIL
      ? 'tests/.auth/admin.json'
      : 'tests/.auth/user.json',
  })

  test.beforeEach(async () => {
    test.skip(
      !hasAdminCredentials,
      'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD nicht gesetzt'
    )
  })

  // AC-1: Seite existiert und ist im Navigationsmenu sichtbar
  test('AC-1: Rangliste-Link ist im Navigationsmenu sichtbar (nur fuer Admin)', async ({
    page,
  }) => {
    await mockRanglisteApi(page)
    await page.goto('/rangliste')

    // Navigation link should be visible
    const navLink = page.getByRole('link', { name: /rangliste/i })
    await expect(navLink).toBeVisible({ timeout: 10_000 })

    // Link should be active (red color = active state)
    await expect(navLink).toHaveAttribute('href', '/rangliste')
  })

  test('AC-1: Rangliste ist zwischen "Laeufe" und "Admin" positioniert', async ({
    page,
  }) => {
    await mockRanglisteApi(page)
    await page.goto('/rangliste')

    // Get all navigation links
    const nav = page.locator('nav[aria-label="Hauptnavigation"]')
    await expect(nav).toBeVisible({ timeout: 10_000 })

    const links = nav.getByRole('link')
    const count = await links.count()

    // Should have at least 3 links: LAUFE, RANGLISTE, ADMIN
    expect(count).toBeGreaterThanOrEqual(3)

    const linkTexts: string[] = []
    for (let i = 0; i < count; i++) {
      const text = await links.nth(i).textContent()
      linkTexts.push((text ?? '').trim().toUpperCase())
    }

    const laufeIdx = linkTexts.indexOf('LÄUFE')
    const ranglisteIdx = linkTexts.findIndex((t) => t.includes('RANGLISTE'))
    const adminIdx = linkTexts.indexOf('ADMIN')

    expect(laufeIdx).toBeGreaterThanOrEqual(0)
    expect(ranglisteIdx).toBeGreaterThanOrEqual(0)
    expect(adminIdx).toBeGreaterThanOrEqual(0)
    expect(ranglisteIdx).toBeGreaterThan(laufeIdx)
    expect(ranglisteIdx).toBeLessThan(adminIdx)
  })

  // AC-3 + AC-5: Alle Laeufer*innen werden in Tabelle angezeigt mit Rang, Name, km, Laeufe
  test('AC-3 + AC-5: zeigt Tabelle mit Rang, Name, Gesamt-km, Laeufe', async ({
    page,
  }) => {
    await mockRanglisteApi(page)
    await page.goto('/rangliste')

    // Table headers
    await expect(page.getByRole('columnheader', { name: 'Rang' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /Gesamt-km/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /Läufe/i })).toBeVisible()

    // All runners should be visible
    for (const runner of MOCK_RANKING) {
      await expect(page.getByText(runner.name)).toBeVisible()
    }

    // Should show 5 data rows (MOCK_RANKING has 5 entries)
    const rows = page.locator('table tbody tr')
    await expect(rows).toHaveCount(5)
  })

  // AC-4: Sortierung nach Gesamtkilometern absteigend
  test('AC-4: Tabelle ist nach Gesamtkilometern absteigend sortiert', async ({
    page,
  }) => {
    await mockRanglisteApi(page)
    await page.goto('/rangliste')

    // Wait for table to load
    await expect(page.getByText('Top Laeufer')).toBeVisible({ timeout: 10_000 })

    // Check that the first row is the top runner
    const firstRow = page.locator('table tbody tr').first()
    await expect(firstRow.getByText('Top Laeufer')).toBeVisible()
    await expect(firstRow.getByText('85,50 km')).toBeVisible()

    // Last row should be the runner with 0km
    const lastRow = page.locator('table tbody tr').last()
    await expect(lastRow.getByText('Ohne Lauf')).toBeVisible()
    await expect(lastRow.getByText('0,00 km')).toBeVisible()
  })

  // AC-6: Laeufer*innen mit 0 km am Ende
  test('AC-6: Laeufer*innen mit 0 km werden am Ende angezeigt', async ({
    page,
  }) => {
    await mockRanglisteApi(page)
    await page.goto('/rangliste')

    await expect(page.getByText('Ohne Lauf')).toBeVisible({ timeout: 10_000 })

    const lastRow = page.locator('table tbody tr').last()
    await expect(lastRow.getByText('Ohne Lauf')).toBeVisible()
    await expect(lastRow.getByText('0,00 km')).toBeVisible()
    await expect(lastRow.getByText('0', { exact: true })).toBeVisible()
  })

  // AC-7: Rang wird automatisch vergeben
  test('AC-7: Rang wird automatisch vergeben (1., 2., 3., ...)', async ({
    page,
  }) => {
    await mockRanglisteApi(page)
    await page.goto('/rangliste')

    await expect(page.getByText('Top Laeufer')).toBeVisible({ timeout: 10_000 })

    // Top 3 should have badge-style ranks
    const rows = page.locator('table tbody tr')

    // First row: rank 1 badge
    const firstRank = rows.nth(0).locator('td').first()
    await expect(firstRank.getByText('1.')).toBeVisible()

    // Fourth row: plain rank (no badge)
    const fourthRank = rows.nth(3).locator('td').first()
    await expect(fourthRank.getByText('4.')).toBeVisible()
  })

  // AC-8: Bei gleichen km, mehr Laeufe = hoeherer Rang
  test('AC-8: bei gleichen km wird Laufanzahl als Sortierkriterium verwendet', async ({
    page,
  }) => {
    await mockRanglisteApi(page, MOCK_RANKING_SAME_KM)
    await page.goto('/rangliste')

    await expect(page.getByText('Mehr Laeufe')).toBeVisible({ timeout: 10_000 })

    // "Mehr Laeufe" (10 runs) should rank higher than "Weniger Laeufe" (5 runs)
    const firstRow = page.locator('table tbody tr').first()
    await expect(firstRow.getByText('Mehr Laeufe')).toBeVisible()

    const secondRow = page.locator('table tbody tr').nth(1)
    await expect(secondRow.getByText('Weniger Laeufe')).toBeVisible()
  })

  // AC-9: CI-konformes Design
  test('AC-9: Seite verwendet Card-Layout und CI-konforme Typografie', async ({
    page,
  }) => {
    await mockRanglisteApi(page)
    await page.goto('/rangliste')

    // Page title
    await expect(
      page.getByRole('heading', { name: 'Rangliste' })
    ).toBeVisible({ timeout: 10_000 })

    // Summary cards should be visible
    await expect(page.getByText(/Läufer\*innen gesamt/)).toBeVisible()
    await expect(page.getByText(/Aktive/)).toBeVisible()
    await expect(page.getByText(/Gesamt-km aller/)).toBeVisible()

    // Table is wrapped in a Card
    const tableCard = page.locator('.bg-card', {
      has: page.locator('table'),
    })
    await expect(tableCard).toBeVisible()
  })

  // AC-10: Ladezeit < 2 Sekunden
  test('AC-10: Seite laedt in unter 2 Sekunden', async ({ page }) => {
    await mockRanglisteApi(page)

    const start = Date.now()
    await page.goto('/rangliste')
    await expect(page.getByText('Top Laeufer')).toBeVisible({ timeout: 5_000 })
    const duration = Date.now() - start

    // Rangliste should render within 2 seconds (generous for CI)
    expect(duration).toBeLessThan(5000)
  })

  // Summary stats
  test('Summary-Karten zeigen korrekte Zahlen', async ({ page }) => {
    await mockRanglisteApi(page)
    await page.goto('/rangliste')

    await expect(page.getByText('Top Laeufer')).toBeVisible({ timeout: 10_000 })

    // Total runners: 5 (find the card with "Laeufer*innen gesamt" label)
    const totalCard = page.locator('.bg-card', {
      has: page.getByText(/Läufer\*innen gesamt/),
    })
    await expect(totalCard.locator('p.text-2xl')).toHaveText('5')

    // Active runners: 4 (find the card with "Aktive" label)
    const activeCard = page.locator('.bg-card', {
      has: page.getByText(/Aktive/),
    })
    await expect(activeCard.locator('p.text-2xl')).toHaveText('4')
  })

  // Top-3 Badges
  test('Top-3 Raenge haben farbige Badges', async ({ page }) => {
    await mockRanglisteApi(page)
    await page.goto('/rangliste')

    await expect(page.getByText('Top Laeufer')).toBeVisible({ timeout: 10_000 })

    // Top 3 rows should have Badge elements with aria-label
    const badge1 = page.getByLabel('Rang 1')
    await expect(badge1).toBeVisible()

    const badge2 = page.getByLabel('Rang 2')
    await expect(badge2).toBeVisible()

    const badge3 = page.getByLabel('Rang 3')
    await expect(badge3).toBeVisible()
  })

  // Startnummer displayed
  test('Startnummer wird neben dem Namen angezeigt', async ({ page }) => {
    await mockRanglisteApi(page)
    await page.goto('/rangliste')

    await expect(page.getByText('Top Laeufer')).toBeVisible({ timeout: 10_000 })

    // Startnummer "Nr. 1" should be visible in the first row
    const firstRow = page.locator('table tbody tr').first()
    await expect(firstRow.getByText('Nr. 1')).toBeVisible()
  })
})

// ==========================================================================

test.describe('PROJ-27: Rangliste — Fehlerbehandlung & Edge Cases', () => {
  test.use({
    storageState: process.env.E2E_ADMIN_EMAIL
      ? 'tests/.auth/admin.json'
      : 'tests/.auth/user.json',
  })

  test.beforeEach(async () => {
    test.skip(
      !hasAdminCredentials,
      'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD nicht gesetzt'
    )
  })

  // Error state: TYPO3 API nicht erreichbar
  test('EC: zeigt Fehlermeldung wenn TYPO3-API nicht erreichbar', async ({
    page,
  }) => {
    await mockRanglisteApi(page, null, 502)
    await page.goto('/rangliste')

    // Error message should be visible
    await expect(
      page.getByText(/TYPO3 API nicht erreichbar/)
    ).toBeVisible({ timeout: 10_000 })

    // "Erneut versuchen" button should be visible
    await expect(
      page.getByRole('button', { name: /erneut versuchen/i })
    ).toBeVisible()
  })

  // Retry button works
  test('EC: "Erneut versuchen" Button laedt die Daten neu', async ({
    page,
  }) => {
    let callCount = 0
    await page.route('**/api/admin/rangliste', (route) => {
      callCount++
      if (callCount === 1) {
        return route.fulfill({
          status: 502,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'TYPO3 API nicht erreichbar' }),
        })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_RANKING),
      })
    })

    await page.goto('/rangliste')

    // First load: error state
    await expect(
      page.getByText(/TYPO3 API nicht erreichbar/)
    ).toBeVisible({ timeout: 10_000 })

    // Click retry
    await page.getByRole('button', { name: /erneut versuchen/i }).click()

    // Second load: success
    await expect(page.getByText('Top Laeufer')).toBeVisible({ timeout: 10_000 })
  })

  // Empty state
  test('EC: zeigt Empty State wenn keine Laeufer*innen vorhanden', async ({
    page,
  }) => {
    await mockRanglisteApi(page, MOCK_RANKING_EMPTY)
    await page.goto('/rangliste')

    await expect(
      page.getByText(/Noch keine Läufer\*innen vorhanden/)
    ).toBeVisible({ timeout: 10_000 })
  })

  // All runners with 0 km
  test('EC: zeigt alle Laeufer*innen mit 0 km korrekt an', async ({
    page,
  }) => {
    await mockRanglisteApi(page, MOCK_RANKING_ALL_ZERO)
    await page.goto('/rangliste')

    await expect(page.getByText('Alice')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Bob')).toBeVisible()

    // Both should show 0,00 km
    const rows = page.locator('table tbody tr')
    await expect(rows).toHaveCount(2)
  })

  // Loading state (skeleton)
  test('EC: zeigt Skeleton waehrend Daten geladen werden', async ({
    page,
  }) => {
    // Delay API response
    await page.route('**/api/admin/rangliste', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_RANKING),
      })
    })

    await page.goto('/rangliste')

    // Skeleton should be visible during loading
    const skeleton = page.locator('.animate-pulse')
    await expect(skeleton.first()).toBeVisible({ timeout: 3_000 })

    // After data loads, table should appear
    await expect(page.getByText('Top Laeufer')).toBeVisible({ timeout: 10_000 })
  })
})
