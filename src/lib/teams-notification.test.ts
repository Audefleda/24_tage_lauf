import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase-admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/typo3-client', () => ({ typo3Fetch: vi.fn() }))
vi.mock('@/lib/logger', () => ({ debug: vi.fn(), error: vi.fn() }))

import { sendTeamsNotification } from './teams-notification'

const basePayload = {
  typo3Uid: 1,
  runDate: '2026-03-31',
  runDistanceKm: '5.0',
}

describe('sendTeamsNotification', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 200 }))
    delete process.env.TEAMS_WEBHOOK_URL
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('opt-out guard (PROJ-20)', () => {
    it('does not send when teamsNotificationsEnabled is false', async () => {
      await sendTeamsNotification({ ...basePayload, teamsNotificationsEnabled: false })
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('does send when teamsNotificationsEnabled is true (if webhook URL is set)', async () => {
      process.env.TEAMS_WEBHOOK_URL = 'https://example.webhook.url'
      // typo3Fetch needs to return runner data — mock it to return empty list
      const { typo3Fetch } = await import('@/lib/typo3-client')
      vi.mocked(typo3Fetch).mockResolvedValue(
        new Response(JSON.stringify({ runners: [] }), { status: 200 })
      )
      // supabase mock: createAdminClient returns a chainable mock
      const { createAdminClient } = await import('@/lib/supabase-admin')
      vi.mocked(createAdminClient).mockReturnValue({
        from: () => ({
          select: () => ({ eq: () => ({ count: 'exact', head: true, error: null, count: 0 }) }),
        }),
      } as unknown as ReturnType<typeof createAdminClient>)

      await sendTeamsNotification({ ...basePayload, teamsNotificationsEnabled: true })
      expect(fetchSpy).toHaveBeenCalledOnce()
    })
  })

  describe('missing webhook URL guard', () => {
    it('does not send when TEAMS_WEBHOOK_URL is not set', async () => {
      await sendTeamsNotification(basePayload)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('does not send when TEAMS_WEBHOOK_URL is an empty string', async () => {
      process.env.TEAMS_WEBHOOK_URL = ''
      await sendTeamsNotification(basePayload)
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })
})
