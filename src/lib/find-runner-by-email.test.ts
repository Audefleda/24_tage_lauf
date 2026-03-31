import { describe, it, expect } from 'vitest'
import { findRunnerByEmail } from './find-runner-by-email'

const runners = [
  { uid: 1, nr: 1, name: 'Anna Schmidt' },
  { uid: 2, nr: 2, name: 'Thomas B.' },
  { uid: 3, nr: 3, name: 'Peter' },
  { uid: 4, nr: 4, name: 'Ela' },
  { uid: 5, nr: 5, name: 'Annegret Schäfer' },
]

describe('findRunnerByEmail', () => {
  describe('guard conditions', () => {
    it('returns null for null email', () => {
      expect(findRunnerByEmail(runners, null)).toBeNull()
    })

    it('returns null for undefined email', () => {
      expect(findRunnerByEmail(runners, undefined)).toBeNull()
    })

    it('returns null for empty string email', () => {
      expect(findRunnerByEmail(runners, '')).toBeNull()
    })

    it('returns null for empty runners list', () => {
      expect(findRunnerByEmail([], 'anna.schmidt@example.com')).toBeNull()
    })

    it('returns null when email has no local part (starts with @)', () => {
      expect(findRunnerByEmail(runners, '@example.com')).toBeNull()
    })
  })

  describe('Stage 1: full name match (Vorname Nachname)', () => {
    it('matches "anna.schmidt" to runner "Anna Schmidt"', () => {
      expect(findRunnerByEmail(runners, 'anna.schmidt@example.com')).toBe(1)
    })

    it('is case-insensitive', () => {
      expect(findRunnerByEmail(runners, 'ANNA.SCHMIDT@EXAMPLE.COM')).toBe(1)
    })

    it('ignores middle parts in email (only uses first and last)', () => {
      expect(findRunnerByEmail(runners, 'anna.marie.schmidt@example.com')).toBe(1)
    })
  })

  describe('Stage 2: abbreviated last name (Vorname N.)', () => {
    it('matches "thomas.bauer" to runner "Thomas B."', () => {
      expect(findRunnerByEmail(runners, 'thomas.bauer@example.com')).toBe(2)
    })
  })

  describe('Stage 3: exact first name match', () => {
    it('matches "peter@..." to runner "Peter" (no last name in email)', () => {
      expect(findRunnerByEmail(runners, 'peter@example.com')).toBe(3)
    })
  })

  describe('Stage 4: first name as substring in runner name', () => {
    it('matches "chris@..." to runner "Christopher Huber" when no exact match exists', () => {
      const stage4Runners = [{ uid: 10, nr: 10, name: 'Christopher Huber' }]
      expect(findRunnerByEmail(stage4Runners, 'chris@example.com')).toBe(10)
    })
  })

  describe('Stage 5: runner name as substring in email local part (nickname handling)', () => {
    it('matches runner "Ela" when email local part is "daniela.aumann"', () => {
      const nickNameRunners = [{ uid: 4, nr: 4, name: 'Ela' }]
      expect(findRunnerByEmail(nickNameRunners, 'daniela.aumann@example.com')).toBe(4)
    })
  })

  describe('no match', () => {
    it('returns null when no stage matches', () => {
      expect(findRunnerByEmail(runners, 'xyz.unknown@example.com')).toBeNull()
    })
  })
})
