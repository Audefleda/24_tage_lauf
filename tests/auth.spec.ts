/**
 * E2E Tests: Authentifizierung
 *
 * Testet die Login-Seite, Formular-Validierung und Auth-Redirects.
 * Diese Tests benötigen KEINE Credentials — sie testen das UI-Verhalten
 * und die Redirect-Logik der Middleware.
 *
 * Hinweis: test.use({ storageState: { cookies: [], origins: [] } }) stellt
 * sicher, dass diese Tests immer ohne Auth-State laufen, auch wenn der
 * globale Setup einen gespeicherten State erzeugt hat.
 */

import { test, expect } from '@playwright/test'

// Alle Tests in dieser Datei ohne Auth-State ausführen
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Login-Seite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('zeigt Login-Formular mit allen Elementen', async ({ page }) => {
    // CardTitle rendert als <div>, nicht als heading — daher .first() für den Titel-Text
    await expect(page.getByText('Anmelden').first()).toBeVisible()
    await expect(page.getByLabel('E-Mail')).toBeVisible()
    await expect(page.getByLabel('Passwort')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Passwort vergessen?' })).toBeVisible()
  })

  test('zeigt Validierungsfehler bei leerem Formular', async ({ page }) => {
    await page.getByRole('button', { name: 'Anmelden' }).click()
    // Zod-Validierung: E-Mail ist Pflichtfeld
    await expect(page.getByText('Bitte eine gültige E-Mail-Adresse eingeben')).toBeVisible()
  })

  test('zeigt Validierungsfehler bei ungültiger E-Mail', async ({ page }) => {
    // Direkt via JS setzen, um browser-native email-Validierung zu umgehen
    // (Chrome blockt den submit bei type="email" mit ungültigem Wert)
    await page.getByLabel('E-Mail').evaluate((el) => {
      ;(el as HTMLInputElement).value = 'keine-email'
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await page.getByLabel('Passwort').fill('irgendwas')
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await expect(page.getByText('Bitte eine gültige E-Mail-Adresse eingeben')).toBeVisible()
  })

  test('zeigt Fehlermeldung bei falschen Credentials', async ({ page }) => {
    // pressSequentially statt fill() — WebKit verarbeitet React-SyntheticEvents
    // bei fill() nicht immer korrekt (react-hook-form getValues liefert "")
    await page.getByLabel('E-Mail').pressSequentially('test@example.com')
    await page.getByLabel('Passwort').pressSequentially('falschespasswort123')
    await page.getByRole('button', { name: 'Anmelden' }).click()
    // Supabase-Antwort kann auf langsameren Browsern bis zu 15s dauern
    await expect(page.getByText('E-Mail oder Passwort falsch')).toBeVisible({
      timeout: 15_000,
    })
  })

  test('zeigt Ladeindikator während des Anmeldevorgangs', async ({ page, browserName }) => {
    // WebKit überspringen: route-Delays für Supabase CORS-Requests funktionieren
    // in WebKit-Playwright nicht zuverlässig genug für diesen Timing-Test
    test.skip(browserName === 'webkit', 'Netzwerk-Delays für Cross-Origin-Requests unzuverlässig auf WebKit')

    // Supabase-Token-Endpoint verzögern damit Button disabled bleibt
    await page.route('**/auth/v1/**', (route) => {
      return new Promise((resolve) => setTimeout(() => resolve(route.continue()), 800))
    })

    await page.getByLabel('E-Mail').fill('test@example.com')
    await page.getByLabel('Passwort').fill('irgendeinpasswort')

    const submitButton = page.getByRole('button', { name: /Anmelden/ })
    await submitButton.click()

    // Während der (verzögerten) Netzwerkanfrage sollte der Button deaktiviert sein
    await expect(submitButton).toBeDisabled({ timeout: 3_000 })
  })
})

test.describe('Passwort-Reset Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('zeigt Passwort-Reset-Formular nach Klick auf "Passwort vergessen?"', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Passwort vergessen?' }).click()

    await expect(
      page.getByText('Gib deine E-Mail-Adresse ein und wir senden dir einen Link')
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Passwort zurücksetzen' })
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Zurück zum Login' })).toBeVisible()
  })

  test('überträgt E-Mail-Adresse aus dem Login-Formular ins Reset-Formular', async ({
    page,
  }) => {
    const testEmail = 'vorausgefuellt@example.com'
    const emailInput = page.getByLabel('E-Mail')
    // pressSequentially triggert echte Key-Events — zuverlässiger als fill() für
    // react-hook-form's getValues() auf allen Browsern
    await emailInput.pressSequentially(testEmail)
    await emailInput.press('Tab')

    await page.getByRole('button', { name: 'Passwort vergessen?' }).click()

    // E-Mail-Feld im Reset-Formular sollte vorausgefüllt sein
    await expect(
      page.getByRole('textbox', { name: /E-Mail für Passwort-Zurücksetzung/i })
    ).toHaveValue(testEmail)
  })

  test('kehrt zum Login-Formular zurück', async ({ page }) => {
    await page.getByRole('button', { name: 'Passwort vergessen?' }).click()
    await page.getByRole('button', { name: 'Zurück zum Login' }).click()

    await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Passwort vergessen?' })).toBeVisible()
  })

  test('deaktiviert Reset-Button ohne E-Mail-Eingabe', async ({ page }) => {
    await page.getByRole('button', { name: 'Passwort vergessen?' }).click()

    // E-Mail-Feld leeren falls vorausgefüllt
    const emailInput = page.getByRole('textbox', {
      name: /E-Mail für Passwort-Zurücksetzung/i,
    })
    await emailInput.clear()

    await expect(
      page.getByRole('button', { name: 'Passwort zurücksetzen' })
    ).toBeDisabled()
  })
})

test.describe('Auth-Middleware Redirects', () => {
  test('leitet unauthentifizierten Nutzer von /runs zu /login weiter', async ({
    page,
  }) => {
    await page.goto('/runs')
    await expect(page).toHaveURL(/\/login/)
    // redirect-Parameter sollte in der URL enthalten sein
    await expect(page).toHaveURL(/redirect=%2Fruns/)
  })

  test('leitet unauthentifizierten Nutzer von /admin zu /login weiter', async ({
    page,
  }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/login/)
  })

  test('Login-Seite ist ohne Auth direkt zugänglich', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByText('Anmelden').first()).toBeVisible()
  })

  test('reset-password-Seite ist ohne Auth zugänglich', async ({ page }) => {
    await page.goto('/reset-password')
    // Seite sollte laden, nicht zu /login weiterleiten
    await expect(page).not.toHaveURL(/\/login/)
  })
})
