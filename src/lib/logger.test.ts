import { describe, it, expect } from 'vitest'

vi.mock('server-only', () => ({}))

import { maskToken, maskEmail } from './logger'

describe('maskToken', () => {
  it('returns "(empty)" for undefined', () => {
    expect(maskToken(undefined)).toBe('(empty)')
  })

  it('returns "(empty)" for null', () => {
    expect(maskToken(null)).toBe('(empty)')
  })

  it('returns "(empty)" for empty string', () => {
    expect(maskToken('')).toBe('(empty)')
  })

  it('returns "***" for tokens of 8 characters or fewer', () => {
    expect(maskToken('12345678')).toBe('***')
    expect(maskToken('short')).toBe('***')
  })

  it('shows the first 8 characters followed by "..." for longer tokens', () => {
    expect(maskToken('abcdefghijklmnop')).toBe('abcdefgh...')
  })

  it('never reveals the full token value', () => {
    const token = 'super-secret-token-value'
    const masked = maskToken(token)
    expect(masked).not.toBe(token)
    expect(masked.endsWith('...')).toBe(true)
  })
})

describe('maskEmail', () => {
  it('returns "(empty)" for undefined', () => {
    expect(maskEmail(undefined)).toBe('(empty)')
  })

  it('returns "(empty)" for null', () => {
    expect(maskEmail(null)).toBe('(empty)')
  })

  it('returns "(empty)" for empty string', () => {
    expect(maskEmail('')).toBe('(empty)')
  })

  it('returns "***" for a string without @', () => {
    expect(maskEmail('notanemail')).toBe('***')
  })

  it('shows first 2 characters of local part, masks the rest', () => {
    expect(maskEmail('user@example.com')).toBe('us***@example.com')
  })

  it('preserves the domain', () => {
    const masked = maskEmail('jonathan.frankenberger@company.de')
    expect(masked).toMatch(/@company\.de$/)
    expect(masked.startsWith('jo***')).toBe(true)
  })
})
