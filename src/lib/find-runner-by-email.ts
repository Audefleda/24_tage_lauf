/**
 * PROJ-18: Laeufer-Vorauswahl anhand E-Mail-Adresse
 *
 * Pure helper function that finds the best matching runner from a list
 * based on the user's email address. Used to pre-select a runner in
 * the RunnerSelectDialog.
 *
 * Matching stages (first match wins):
 * 1. Full name: "Vorname Nachname" (case-insensitive)
 * 2. Abbreviated last name: "Vorname N." (case-insensitive)
 * 3. Exact first name match (case-insensitive)
 * 4. First name as substring in runner name (case-insensitive)
 * 5. Runner name as substring in email local part (handles nicknames, e.g. "Ela" in "daniela")
 * 6. No match: return null
 */

interface Runner {
  uid: number
  nr: number
  name: string
}

/**
 * Extracts first name and last name from an email address.
 * Format expected: vorname.nachname@domain.tld
 *
 * - No dot before @: entire local part is the first name, no last name
 * - Multiple dots: first part = first name, last part = last name, middle parts ignored
 */
function parseEmailName(email: string): { firstName: string; lastName: string | null } {
  const localPart = email.split('@')[0]
  if (!localPart) {
    return { firstName: '', lastName: null }
  }

  const parts = localPart.split('.')

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null }
  }

  return {
    firstName: parts[0],
    lastName: parts[parts.length - 1],
  }
}

/**
 * Finds the best matching runner UID from a list of available runners
 * based on the user's email address.
 *
 * @param runners - List of available (unassigned) runners, expected to be alphabetically sorted
 * @param email - The user's email address from Supabase session
 * @returns The UID of the matched runner, or null if no match found
 */
export function findRunnerByEmail(runners: Runner[], email: string | null | undefined): number | null {
  if (!email || runners.length === 0) {
    return null
  }

  const { firstName, lastName } = parseEmailName(email)

  if (!firstName) {
    return null
  }

  const firstNameLower = firstName.toLowerCase()
  const lastNameLower = lastName?.toLowerCase() ?? null

  // Stage 1: Full name match "Vorname Nachname"
  if (lastNameLower) {
    const fullName = `${firstNameLower} ${lastNameLower}`
    const match = runners.find(
      (r) => r.name.toLowerCase() === fullName
    )
    if (match) return match.uid
  }

  // Stage 2: Abbreviated last name "Vorname N."
  if (lastNameLower) {
    const abbreviated = `${firstNameLower} ${lastNameLower[0]}.`
    const match = runners.find(
      (r) => r.name.toLowerCase() === abbreviated
    )
    if (match) return match.uid
  }

  // Stage 3: Exact first name match
  const exactFirstNameMatch = runners.find(
    (r) => r.name.toLowerCase() === firstNameLower
  )
  if (exactFirstNameMatch) return exactFirstNameMatch.uid

  // Stage 4: First name as substring in runner name
  const substringMatch = runners.find(
    (r) => r.name.toLowerCase().includes(firstNameLower)
  )
  if (substringMatch) return substringMatch.uid

  // Stage 5: Runner name as substring in email local part
  // Handles nicknames where the display name is embedded in the email address
  // e.g. "Ela" is contained in "daniela.aumann-kindl"
  const localPartLower = email.split('@')[0].toLowerCase()
  const reverseSubstringMatch = runners.find(
    (r) => r.name.toLowerCase().split(' ').every(
      (part) => localPartLower.includes(part)
    )
  )
  if (reverseSubstringMatch) return reverseSubstringMatch.uid

  // Stage 6: No match
  return null
}
