/**
 * Smoke Tests für Production
 *
 * Diese Tests laufen OHNE Mocks gegen die echte Production-Umgebung.
 * Ziel: Schnelle Verifikation nach Deployment, dass kritische Funktionen erreichbar sind.
 *
 * KRITISCHE REGEL:
 * ❌ NIEMALS Tests hinzufügen die Daten SCHREIBEN (POST/PUT/DELETE)
 * ✅ NUR Tests die Daten LESEN (GET-Requests)
 *
 * Grund: Smoke Tests laufen gegen echte Production-Daten.
 * Schreibende Tests würden TYPO3-Daten verändern!
 */

import { test, expect } from '@playwright/test'

// Keine Auth-State verwenden - diese Tests laufen unauthentifiziert oder mit echten Credentials
test.use({ storageState: undefined })

test.describe('Smoke Tests - Production', () => {
  test('@smoke Startseite lädt ohne Fehler', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBeLessThan(400)

    // Prüfe dass die Seite nicht komplett kaputt ist
    await expect(page).toHaveTitle(/24.*Tage.*Lauf/i)
  })

  test('@smoke Login-Seite ist erreichbar', async ({ page }) => {
    await page.goto('/login')

    // Login-Formular sollte sichtbar sein
    await expect(page.getByRole('heading', { name: /anmelden/i })).toBeVisible()
    await expect(page.getByLabel(/e-mail/i)).toBeVisible()
    await expect(page.getByLabel(/passwort/i)).toBeVisible()
  })

  test('@smoke API Health Check', async ({ request }) => {
    // Prüfe ob die API grundsätzlich erreichbar ist
    const response = await request.get('/api/health')
    expect(response.status()).toBe(200)

    const body = await response.json()
    expect(body).toHaveProperty('status', 'ok')
  })

  test('@smoke Login funktioniert mit Test-Account', async ({ page }) => {
    // Nutzt E2E_TEST_EMAIL + E2E_TEST_PASSWORD aus GitHub Secrets
    const email = process.env.E2E_TEST_EMAIL
    const password = process.env.E2E_TEST_PASSWORD

    if (!email || !password) {
      test.skip(true, 'E2E_TEST_EMAIL oder E2E_TEST_PASSWORD nicht gesetzt')
    }

    await page.goto('/login')
    await page.getByLabel(/e-mail/i).fill(email!)
    await page.getByLabel(/passwort/i).fill(password!)
    await page.getByRole('button', { name: /anmelden/i }).click()

    // Nach Login sollte zur Läufe-Seite weitergeleitet werden
    await expect(page).toHaveURL(/\/runs/)
    await expect(page.getByText(/läufer/i)).toBeVisible({ timeout: 10_000 })
  })

  test('@smoke Läufe-Seite lädt Daten von TYPO3', async ({ page }) => {
    // Nutzt gespeicherten Auth-State vom Login-Test (muss vorher laufen)
    const email = process.env.E2E_TEST_EMAIL
    const password = process.env.E2E_TEST_PASSWORD

    if (!email || !password) {
      test.skip(true, 'E2E_TEST_EMAIL oder E2E_TEST_PASSWORD nicht gesetzt')
    }

    // Login für diesen Test (unabhängig vom vorherigen Test)
    await page.goto('/login')
    await page.getByLabel(/e-mail/i).fill(email!)
    await page.getByLabel(/passwort/i).fill(password!)
    await page.getByRole('button', { name: /anmelden/i }).click()
    await page.waitForURL(/\/runs/)

    // Prüfe dass TYPO3-Daten geladen werden (keine 500-Fehler)
    // Dieser Test macht nur GET-Requests, schreibt KEINE Läufe!
    await expect(page.getByText(/läufer/i)).toBeVisible({ timeout: 10_000 })

    // Stats-Karten sollten sichtbar sein (werden von TYPO3-Daten befüllt)
    await expect(page.getByText(/gesamtdistanz/i)).toBeVisible()
    await expect(page.getByText(/lauftage/i)).toBeVisible()
  })

  // ❌ KEIN Test für "Lauf eintragen" - würde Production-Daten in TYPO3 verändern!
  // Schreibende Tests gehören NICHT in Smoke Tests.
  // Verwende stattdessen die E2E Tests mit Mocks (runs.spec.ts, external-webhook.spec.ts)
})
