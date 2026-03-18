import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Auth Callback Route
 * Handles the token exchange from Supabase password reset emails.
 * Supabase sends: /auth/callback?token_hash=...&type=recovery&next=/reset-password
 * This route exchanges the token for a session and redirects the user.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const nextParam = searchParams.get('next') ?? '/runs'

  // BUG-4 fix: Prevent open redirect by validating the next parameter.
  const ALLOWED_REDIRECT_PATHS = ['/runs', '/reset-password', '/admin']
  const next =
    nextParam.startsWith('/') &&
    !nextParam.startsWith('//') &&
    ALLOWED_REDIRECT_PATHS.some((p) => nextParam === p || nextParam.startsWith(`${p}/`))
      ? nextParam
      : '/runs'

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

  // Legacy implicit flow: email link contains ?token_hash=...&type=recovery
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'recovery' | 'email',
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
