import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Auth Callback Route
 * Handles the token exchange from Supabase auth emails:
 * - Password reset (type=recovery) -> redirect to /reset-password
 * - Invite (type=invite) -> redirect to /reset-password (initial password)
 * - Sign-up / magic link (type=signup) -> redirect to /reset-password (initial password)
 * - Other -> redirect to /runs (default)
 *
 * Supabase sends: /auth/callback?code=...&type=recovery (PKCE)
 *            or:  /auth/callback?token_hash=...&type=invite (legacy)
 */

/** Token types that require setting a (new) password before proceeding. */
const PASSWORD_REQUIRED_TYPES = new Set(['recovery', 'invite', 'signup'])

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  // PROJ-10: For invite and signup flows, always redirect to /reset-password
  // so the user sets their own password before using the app.
  const needsPasswordSetup = PASSWORD_REQUIRED_TYPES.has(type ?? '')

  const nextParam = searchParams.get('next') ?? '/runs'

  // BUG-4 fix: Prevent open redirect by validating the next parameter.
  const ALLOWED_REDIRECT_PATHS = ['/runs', '/reset-password', '/admin']
  const validatedNext =
    nextParam.startsWith('/') &&
    !nextParam.startsWith('//') &&
    ALLOWED_REDIRECT_PATHS.some((p) => nextParam === p || nextParam.startsWith(`${p}/`))
      ? nextParam
      : '/runs'

  // Override redirect target for password-setup flows (invite, signup, recovery)
  // For first-time users (invite/signup), add ?welcome=true so the form can show appropriate messaging
  const isFirstTimeUser = type === 'invite' || type === 'signup'
  const next = needsPasswordSetup
    ? isFirstTimeUser ? '/reset-password?welcome=true' : '/reset-password'
    : validatedNext

  const response = NextResponse.redirect(new URL(next, origin))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // PKCE flow (default in @supabase/ssr): email link contains ?code=...
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return response
  }

  // Legacy implicit flow: email link contains ?token_hash=...&type=recovery|invite|signup
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'recovery' | 'email' | 'invite' | 'signup',
    })
    if (!error) return response
  }

  // Token ungueltig oder abgelaufen — zur Login-Seite mit Fehlermeldung
  const errorUrl = new URL('/login', origin)
  errorUrl.searchParams.set(
    'error',
    'Der Link ist ungueltig oder abgelaufen. Bitte fordere einen neuen Link an.'
  )
  return NextResponse.redirect(errorUrl)
}
