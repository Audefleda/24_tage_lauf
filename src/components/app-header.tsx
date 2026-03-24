'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { LogOut, Loader2 } from 'lucide-react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

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

    async function getUser() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()
      setUser(currentUser)

      if (currentUser) {
        setDisplayName(currentUser.email ?? null)
      }
    }

    getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setDisplayName(null)
      }
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
            24 TAGE LAUF
          </Link>

          {!isLoginPage && user && (
            <nav className="flex items-center gap-1" aria-label="Hauptnavigation">
              <Link
                href="/runs"
                className={`px-3 py-1 text-sm font-semibold uppercase tracking-wide transition-colors ${
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
                  className={`px-3 py-1 text-sm font-semibold uppercase tracking-wide transition-colors ${
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
