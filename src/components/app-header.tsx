'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { LogOut, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

function formatDeployTime(isoString: string | undefined): string | null {
  if (!isoString) return null
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) return null
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${day}.${month}. ${hours}:${minutes}`
  } catch {
    return null
  }
}

function truncateBranch(branch: string | undefined, maxLength = 20): string | null {
  if (!branch) return null
  if (branch.length > maxLength) return branch.slice(0, maxLength) + '\u2026'
  return branch
}

function EnvironmentBadge() {
  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV
  const deployTime = process.env.NEXT_PUBLIC_DEPLOY_TIME
  const branchRef = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF

  const formattedTime = formatDeployTime(deployTime)

  // Production
  if (vercelEnv === 'production') {
    return (
      <Badge
        variant="outline"
        className="border-[#9d9d9c]/40 text-[#9d9d9c] text-[10px] font-normal whitespace-nowrap hidden sm:inline-flex"
        aria-label="Deployment-Zeitpunkt"
      >
        {formattedTime ? `Deploy: ${formattedTime}` : 'Deploy'}
      </Badge>
    )
  }

  // Preview
  if (vercelEnv === 'preview') {
    const branch = truncateBranch(branchRef)
    const parts = ['Preview', branch, formattedTime].filter(Boolean)
    return (
      <Badge
        className="bg-amber-600/80 text-white border-amber-600 text-[10px] font-normal whitespace-nowrap hidden sm:inline-flex"
        aria-label="Preview-Umgebung"
      >
        {parts.join(' \u00b7 ')}
      </Badge>
    )
  }

  // Local development (no Vercel env or NODE_ENV === 'development')
  if (!vercelEnv || process.env.NODE_ENV === 'development') {
    return (
      <Badge
        className="bg-emerald-700/80 text-white border-emerald-700 text-[10px] font-normal whitespace-nowrap hidden sm:inline-flex"
        aria-label="Lokale Entwicklungsumgebung"
      >
        Lokale Entwicklung
      </Badge>
    )
  }

  return null
}

function UserAvatar({ email }: { email: string }) {
  const initial = email.charAt(0).toUpperCase()
  return (
    <div
      className="flex h-8 w-8 items-center justify-center bg-[#4a4a49] text-white text-sm font-semibold rounded-full"
      aria-label={`Avatar fuer ${email}`}
    >
      {initial}
    </div>
  )
}

export function AppHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const isLoginPage = pathname === '/login'

  useEffect(() => {
    if (isLoginPage) return

    const supabase = createClient()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setDisplayName(session?.user?.email ?? null)
    })

    return () => subscription.unsubscribe()
  }, [isLoginPage])

  async function handleLogout() {
    setIsLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <header className="bg-black" role="banner">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-white font-bold text-base tracking-tight hover:text-[#ea0029] transition-colors"
          >
            BCxP läuft 24 Tage für Kinderrechte
          </Link>

          <EnvironmentBadge />

          {!isLoginPage && user && (
            <nav className="flex items-center gap-1" aria-label="Hauptnavigation">
              <Link
                href="/runs"
                className={`px-3 py-1 text-sm font-bold uppercase tracking-wide transition-colors ${
                  isActive('/runs')
                    ? 'text-[#ea0029]'
                    : 'text-white hover:text-[#ea0029]'
                }`}
              >
                LÄUFE
              </Link>
              {user.app_metadata?.role === 'admin' && (
                <Link
                  href="/admin"
                  className={`px-3 py-1 text-sm font-bold uppercase tracking-wide transition-colors ${
                    isActive('/admin')
                      ? 'text-[#ea0029]'
                      : 'text-white hover:text-[#ea0029]'
                  }`}
                >
                  Admin
                </Link>
              )}
            </nav>
          )}
        </div>

        {!isLoginPage && user && (
          <div className="flex items-center gap-3">
            {displayName && (
              <>
                <span className="text-sm text-[#9d9d9c] hidden sm:inline">
                  {displayName}
                </span>
                <UserAvatar email={displayName} />
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-label="Abmelden"
              className="text-white hover:text-[#ea0029] hover:bg-transparent"
            >
              {isLoggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">ABMELDEN</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
