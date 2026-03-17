// Server-only — Admin-Authentifizierungspruefung
// Prueft ob der aktuelle User die Admin-Rolle hat (via user_metadata.role)

import { createClient } from '@/lib/supabase-server'

export type AdminCheckResult =
  | { authorized: true; userId: string }
  | { authorized: false; status: number; message: string }

/**
 * Prueft ob der aktuelle Request von einem authentifizierten Admin kommt.
 * Gibt bei Erfolg die User-ID zurueck, bei Fehler Status + Fehlermeldung.
 *
 * Verwendung in API Routes:
 * ```ts
 * const check = await requireAdmin()
 * if (!check.authorized) {
 *   return NextResponse.json({ error: check.message }, { status: check.status })
 * }
 * // check.userId ist verfuegbar
 * ```
 */
export async function requireAdmin(): Promise<AdminCheckResult> {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      authorized: false,
      status: 401,
      message: 'Nicht authentifiziert',
    }
  }

  const role = user.user_metadata?.role
  if (role !== 'admin') {
    return {
      authorized: false,
      status: 403,
      message: 'Keine Admin-Berechtigung',
    }
  }

  return { authorized: true, userId: user.id }
}
