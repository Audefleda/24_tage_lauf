import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/login',
}))

// Mock supabase client
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: vi.fn(),
    },
  }),
}))

// Store original env
const originalEnv = { ...process.env }

beforeEach(() => {
  // Reset env vars before each test
  delete process.env.NEXT_PUBLIC_VERCEL_ENV
  delete process.env.NEXT_PUBLIC_DEPLOY_TIME
  delete process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF
})

describe('EnvironmentBadge (via AppHeader)', () => {
  // Dynamic import to pick up env changes per test
  async function renderHeader() {
    // Clear module cache so env vars are re-read
    vi.resetModules()
    const { AppHeader } = await import('./app-header')
    return render(<AppHeader />)
  }

  it('shows "Lokale Entwicklung" when no Vercel env is set', async () => {
    await renderHeader()
    expect(screen.getByText('Lokale Entwicklung')).toBeInTheDocument()
  })

  it('shows no date/time for local development', async () => {
    process.env.NEXT_PUBLIC_DEPLOY_TIME = '2026-03-31T14:22:00.000Z'
    await renderHeader()
    const badge = screen.getByText('Lokale Entwicklung')
    expect(badge).toBeInTheDocument()
    // Should not contain any date format
    expect(badge.textContent).not.toMatch(/\d{2}\.\d{2}\.\s\d{2}:\d{2}/)
  })

  it('shows Preview badge with branch and time', async () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview'
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF = 'feat/my-branch'
    process.env.NEXT_PUBLIC_DEPLOY_TIME = '2026-03-31T14:22:00.000Z'
    await renderHeader()
    const badge = screen.getByLabelText('Preview-Umgebung')
    expect(badge).toBeInTheDocument()
    expect(badge.textContent).toContain('Preview')
    expect(badge.textContent).toContain('feat/my-branch')
  })

  it('truncates long branch names to 20 chars with ellipsis', async () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview'
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF = 'feature/very-long-branch-name-exceeding-twenty'
    process.env.NEXT_PUBLIC_DEPLOY_TIME = '2026-03-31T14:22:00.000Z'
    await renderHeader()
    const badge = screen.getByLabelText('Preview-Umgebung')
    // Branch should be truncated: first 20 chars + ellipsis
    expect(badge.textContent).toContain('feature/very-long-br\u2026')
    expect(badge.textContent).not.toContain('feature/very-long-branch-name-exceeding-twenty')
  })

  it('shows Preview without branch when VERCEL_GIT_COMMIT_REF is missing', async () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview'
    process.env.NEXT_PUBLIC_DEPLOY_TIME = '2026-03-31T14:22:00.000Z'
    await renderHeader()
    const badge = screen.getByLabelText('Preview-Umgebung')
    expect(badge.textContent).toContain('Preview')
    // Should not have branch, just Preview and time
    const parts = badge.textContent!.split(' \u00b7 ')
    expect(parts[0]).toBe('Preview')
  })

  it('shows production deploy time', async () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'production'
    process.env.NEXT_PUBLIC_DEPLOY_TIME = '2026-03-31T14:22:00.000Z'
    await renderHeader()
    const badge = screen.getByLabelText('Deployment-Zeitpunkt')
    expect(badge).toBeInTheDocument()
    expect(badge.textContent).toContain('Deploy:')
  })

  it('production without deploy time shows "Deploy" label without timestamp', async () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'production'
    // No NEXT_PUBLIC_DEPLOY_TIME set
    await renderHeader()
    const badge = screen.queryByLabelText('Deployment-Zeitpunkt')
    expect(badge).not.toBeNull()
    expect(badge?.textContent).toBe('Deploy')
  })

  it('Preview badge without deploy time shows only Preview and branch', async () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview'
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF = 'main'
    // No NEXT_PUBLIC_DEPLOY_TIME
    await renderHeader()
    const badge = screen.getByLabelText('Preview-Umgebung')
    expect(badge.textContent).toBe('Preview \u00b7 main')
  })

  it('badge is hidden on mobile via CSS class', async () => {
    await renderHeader()
    const badge = screen.getByText('Lokale Entwicklung')
    expect(badge.className).toContain('hidden')
    expect(badge.className).toContain('sm:inline-flex')
  })

  it('formats deploy time as DD.MM. HH:MM', async () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'production'
    // Use a date where we know the local representation
    // Note: The format depends on the timezone of the test runner
    process.env.NEXT_PUBLIC_DEPLOY_TIME = '2026-01-05T08:03:00.000Z'
    await renderHeader()
    const badge = screen.getByLabelText('Deployment-Zeitpunkt')
    // Should contain DD.MM. HH:MM format
    expect(badge.textContent).toMatch(/Deploy: \d{2}\.\d{2}\. \d{2}:\d{2}/)
  })
})
