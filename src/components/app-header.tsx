'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { LogOut, Loader2, Shield } from 'lucide-react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

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
        // Try to get runner profile name
        const { data: profile } = await supabase
          .from('runner_profiles')
          .select('typo3_name')
          .eq('user_id', currentUser.id)
          .single()

        if (profile?.typo3_name) {
          setDisplayName(profile.typo3_name)
        } else {
          setDisplayName(currentUser.email ?? null)
        }
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

  return (
    <header className="border-b">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <span className="font-semibold text-sm">24 Tage Lauf</span>

        {!isLoginPage && user && (
          <div className="flex items-center gap-3">
            {user.user_metadata?.role === 'admin' && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin">
                  <Shield className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              </Button>
            )}
            {displayName && (
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {displayName}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-label="Abmelden"
            >
              {isLoggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Abmelden</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
