import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'

// .env.local laden damit E2E_TEST_EMAIL etc. im globalSetup verfügbar sind
config({ path: '.env.local' })

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    // Verwendet BASE_URL aus Env-Variable (für CI gegen Vercel Preview/Production)
    // Fallback zu localhost für lokale Entwicklung
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    // Desktop Chrome — authentifizierte Tests verwenden gespeicherten Auth-State
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/user.json',
      },
    },
    // Mobile Safari — gleiche Auth-State wie Desktop
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 13'],
        storageState: 'tests/.auth/user.json',
      },
    },
  ],
  // Startet lokalen Dev-Server nur wenn gegen localhost getestet wird
  // Bei BASE_URL (CI gegen Vercel) wird dieser Schritt übersprungen
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
      },
})
