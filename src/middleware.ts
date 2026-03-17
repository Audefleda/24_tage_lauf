// Middleware: Route Protection
// - Alle Routen ausser /login und /api/strava/webhook: Supabase Session pruefen
// - /admin/* Routen zusaetzlich: Admin-Rolle pruefen

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Routen die ohne Authentifizierung zugaenglich sind
const PUBLIC_ROUTES = ['/login', '/api/strava/webhook']

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}

function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith('/admin') || pathname.startsWith('/api/admin')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Oeffentliche Routen durchlassen
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // Supabase-Client fuer Middleware erstellen
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Session pruefen (refresht auch abgelaufene Tokens)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Nicht authentifiziert: Redirect zu /login
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Admin-Routen: Zusaetzliche Rollenprüfung
  if (isAdminRoute(pathname)) {
    const role = user.user_metadata?.role
    if (role !== 'admin') {
      // API-Routen: 403 JSON Response
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Keine Admin-Berechtigung' },
          { status: 403 }
        )
      }
      // Seiten-Routen: Redirect zur Startseite
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    // Alle Routen ausser statische Dateien und Next.js-Interne
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
