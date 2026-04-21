/**
 * E2E Tests: Runs Save — Server-side Read-Modify-Write
 *
 * These tests verify the refactored save mechanism where the client sends
 * only a single run { runDate, runDistance } and the server does the
 * read-modify-write cycle with a per-user mutex.
 *
 * TYPO3-Isolation: All API routes are intercepted via page.route().
 * No real requests are sent to TYPO3 or other external systems.
 */

import { test, expect, type Page, type Route } from '@playwright/test'

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

const hasCredentials = !!(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD)

/**
 * Sets up API mocks and captures PUT /api/runner/runs requests
 * for inspection. Returns the captured request bodies array.
 */
async function mockRunnerApiCapturingPut(page: Page): Promise<{ runDate: string; runDistance: string }[]> {
  const capturedBodies: { runDate: string; runDistance: string }[] = []

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

  await page.route('**/api/runner/runs', async (route: Route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON()
      capturedBodies.push(body)
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    }
    return route.continue()
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
      body: JSON.stringify({ visible: false }),
    })
  })

  await page.route('**/api/runner/webhook-token', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ active: false }),
    })
  })

  await page.route('**/api/team/stats', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalKm: 100 }),
    })
  })

  return capturedBodies
}

test.describe('Runs Save: Server-side Read-Modify-Write', () => {
  test.beforeEach(async () => {
    test.skip(!hasCredentials, 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD nicht gesetzt')
  })

  test('PUT payload contains single run {runDate, runDistance} — not full array', async ({
    page,
  }) => {
    const captured = await mockRunnerApiCapturingPut(page)
    await page.goto('/runs')

    // Wait for page to load
    const firstInput = page.getByLabel(/Distanz.*Mo.*20\.04\./)
    await firstInput.waitFor({ timeout: 10_000 })

    // Edit an empty day (day index 1 = 21.04.2026, Tuesday)
    const dayInput = page.getByLabel(/Distanz.*Di.*21\.04\./)
    await dayInput.clear()
    await dayInput.fill('8,5')
    await dayInput.blur()

    // Wait for the request to be captured
    await expect(async () => {
      expect(captured.length).toBeGreaterThan(0)
    }).toPass({ timeout: 5_000 })

    // Verify the payload is a single run, not an array
    const body = captured[0]
    expect(body).toHaveProperty('runDate')
    expect(body).toHaveProperty('runDistance')
    expect(body).not.toHaveProperty('runs')
    expect(body).not.toHaveProperty('notifyRun')

    // Verify correct date and distance
    expect(body.runDate).toBe('2026-04-21 06:00:00')
    expect(body.runDistance).toBe('8.5')
  })

  test('Deleting a run sends runDistance "0" (not empty array)', async ({
    page,
  }) => {
    const captured = await mockRunnerApiCapturingPut(page)
    await page.goto('/runs')

    // Day 1 (Mo 20.04.) has a pre-filled distance of 5.5
    const dayInput = page.getByLabel(/Distanz.*Mo.*20\.04\./)
    await dayInput.waitFor({ timeout: 10_000 })

    // Clear the field to delete the run
    await dayInput.clear()
    await dayInput.blur()

    await expect(async () => {
      expect(captured.length).toBeGreaterThan(0)
    }).toPass({ timeout: 5_000 })

    const body = captured[0]
    expect(body.runDate).toBe('2026-04-20 06:00:00')
    expect(body.runDistance).toBe('0')
  })

  test('Rapid sequential saves produce independent PUT requests', async ({
    page,
  }) => {
    const captured = await mockRunnerApiCapturingPut(page)
    await page.goto('/runs')

    // Wait for page to load
    const day1Input = page.getByLabel(/Distanz.*Mo.*20\.04\./)
    await day1Input.waitFor({ timeout: 10_000 })

    // Rapidly edit day 1 and day 3
    await day1Input.clear()
    await day1Input.fill('12')

    const day3Input = page.getByLabel(/Distanz.*Mi.*22\.04\./)
    await day3Input.clear()
    await day3Input.fill('7')

    // Blur day 1, then immediately blur day 3
    await day1Input.blur()
    // Small delay for the save to queue
    await page.waitForTimeout(100)
    await day3Input.blur()

    // Wait for both requests
    await expect(async () => {
      expect(captured.length).toBe(2)
    }).toPass({ timeout: 10_000 })

    // Each payload is a single run — server handles the merge
    expect(captured[0]).toHaveProperty('runDate')
    expect(captured[0]).not.toHaveProperty('runs')
    expect(captured[1]).toHaveProperty('runDate')
    expect(captured[1]).not.toHaveProperty('runs')
  })

  test('Error response from API restores the original value', async ({
    page,
  }) => {
    // Mock with error response
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

    await page.route('**/api/runner/runs', (route) => {
      return route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'TYPO3-Verbindung fehlgeschlagen' }),
      })
    })

    await page.route('**/api/runner/notifications', (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
    })

    await page.route('**/api/strava/status', (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"connected":false}' })
    })

    await page.route('**/api/strava/ui-visibility', (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"visible":false}' })
    })

    await page.route('**/api/runner/webhook-token', (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"active":false}' })
    })

    await page.route('**/api/team/stats', (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"totalKm":100}' })
    })

    await page.goto('/runs')

    // Day 1 has distance 5.5 (displayed as "5,50")
    const dayInput = page.getByLabel(/Distanz.*Mo.*20\.04\./)
    await dayInput.waitFor({ timeout: 10_000 })

    await dayInput.clear()
    await dayInput.fill('99')
    await dayInput.blur()

    // Error should appear (in the inline error message under the row)
    await expect(
      page.getByRole('main').getByText('TYPO3-Verbindung fehlgeschlagen')
    ).toBeVisible({
      timeout: 5_000,
    })

    // Original value should be restored
    await expect(dayInput).toHaveValue('5,50')
  })

  test('Successful save shows success toast and green checkmark', async ({
    page,
  }) => {
    await mockRunnerApiCapturingPut(page)
    await page.goto('/runs')

    // Edit an empty day
    const dayInput = page.getByLabel(/Distanz.*Di.*21\.04\./)
    await dayInput.waitFor({ timeout: 10_000 })
    await dayInput.clear()
    await dayInput.fill('5')
    await dayInput.blur()

    // Green checkmark should appear
    await expect(page.getByLabel('Gespeichert').first()).toBeVisible({ timeout: 5_000 })

    // Toast "Lauf gespeichert"
    await expect(page.getByText('Lauf gespeichert')).toBeVisible({ timeout: 5_000 })
  })

  test('Deleting a run shows "Lauf entfernt" toast', async ({ page }) => {
    await mockRunnerApiCapturingPut(page)
    await page.goto('/runs')

    const dayInput = page.getByLabel(/Distanz.*Mo.*20\.04\./)
    await dayInput.waitFor({ timeout: 10_000 })
    await dayInput.clear()
    await dayInput.blur()

    await expect(page.getByText('Lauf entfernt')).toBeVisible({ timeout: 5_000 })
  })
})
