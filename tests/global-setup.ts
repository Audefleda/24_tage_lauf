/**
 * Playwright Global Setup
 *
 * Loggt sich mit Test-Credentials ein und speichert den Auth-State.
 * Tests können diesen State wiederverwenden, ohne sich jedes Mal neu anzumelden.
 *
 * Voraussetzung: E2E_TEST_EMAIL und E2E_TEST_PASSWORD in .env.local setzen.
 * Ohne diese Variablen wird ein leerer Auth-State gespeichert (Tests laufen
 * dann ohne Authentifizierung und sollten entsprechend skippen).
 */

import { chromium, type FullConfig } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const AUTH_DIR = 'tests/.auth'
const USER_AUTH_FILE = path.join(AUTH_DIR, 'user.json')
const ADMIN_AUTH_FILE = path.join(AUTH_DIR, 'admin.json')

async function loginAndSave(
  baseURL: string,
  email: string,
  password: string,
  outputPath: string
) {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  try {
    await page.goto(`${baseURL}/login`)
    await page.getByLabel('E-Mail').fill(email)
    await page.getByLabel('Passwort').fill(password)
    await page.getByRole('button', { name: 'Anmelden' }).click()

    // Explizit auf /runs warten — wenn die URL /login bleibt, ist der Login fehlgeschlagen
    await page.waitForURL(`${baseURL}/runs`, { timeout: 15_000 }).catch(() => {
      const currentUrl = page.url()
      throw new Error(
        `Login fehlgeschlagen für "${email}" — aktuelle URL: ${currentUrl}. ` +
          'Bitte E2E_TEST_EMAIL / E2E_TEST_PASSWORD prüfen.'
      )
    })

    // Auf vollständige Seitenladung warten, damit alle Auth-Cookies gesetzt sind
    await page.waitForLoadState('networkidle', { timeout: 10_000 })

    await page.context().storageState({ path: outputPath })
    console.log('✅ Auth-State gespeichert:', outputPath)
  } finally {
    await browser.close()
  }
}

async function globalSetup(_config: FullConfig) {
  fs.mkdirSync(AUTH_DIR, { recursive: true })

  const baseURL = 'http://localhost:3000'
  const userEmail = process.env.E2E_TEST_EMAIL
  const userPassword = process.env.E2E_TEST_PASSWORD
  const adminEmail = process.env.E2E_ADMIN_EMAIL
  const adminPassword = process.env.E2E_ADMIN_PASSWORD

  if (!userEmail || !userPassword) {
    console.log(
      '⚠️  E2E_TEST_EMAIL / E2E_TEST_PASSWORD nicht gesetzt — leerer Auth-State wird angelegt.\n' +
        '   Authenticated Tests werden automatisch übersprungen.'
    )
    const empty = JSON.stringify({ cookies: [], origins: [] })
    fs.writeFileSync(USER_AUTH_FILE, empty)
    fs.writeFileSync(ADMIN_AUTH_FILE, empty)
    return
  }

  await loginAndSave(baseURL, userEmail, userPassword, USER_AUTH_FILE)

  if (adminEmail && adminPassword) {
    await loginAndSave(baseURL, adminEmail, adminPassword, ADMIN_AUTH_FILE)
  } else {
    console.log('ℹ️  E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD nicht gesetzt — Admin-Tests werden übersprungen.')
    fs.writeFileSync(ADMIN_AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }))
  }
}

export default globalSetup
