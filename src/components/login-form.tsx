'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Bitte eine gültige E-Mail-Adresse eingeben'),
  password: z.string().min(1, 'Passwort ist erforderlich'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/runs'
  const callbackError = searchParams.get('error')
  const [error, setError] = useState<string | null>(callbackError)
  const [isLoading, setIsLoading] = useState(false)

  // PROJ-10: Handle implicit flow — Supabase invite emails set redirect_to to the
  // root URL, so tokens arrive as hash fragments (#access_token=...&type=invite).
  // The server never sees the hash; we must process it client-side.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash.substring(1)
    if (!hash.includes('access_token')) return

    const params = new URLSearchParams(hash)
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    const type = params.get('type')

    if (!access_token || !refresh_token) return

    const supabase = createClient()
    supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      if (error) {
        setError('Einladungslink ungültig oder abgelaufen.')
        return
      }
      const isFirstTimeUser = type === 'invite' || type === 'signup'
      router.replace(isFirstTimeUser ? '/reset-password?welcome=true' : '/reset-password')
    })
  }, [router])
  const [showResetInfo, setShowResetInfo] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetCooldown, setResetCooldown] = useState(0)

  // BUG-6 fix: Cooldown timer for rate limiting password reset requests
  const cooldownActive = resetCooldown > 0
  useEffect(() => {
    if (!cooldownActive) return
    const timer = setInterval(() => {
      setResetCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldownActive])

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(values: LoginFormValues) {
    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })

    if (signInError) {
      setIsLoading(false)
      setError('E-Mail oder Passwort falsch')
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  async function handlePasswordReset() {
    if (!resetEmail) return
    // BUG-6 fix: Enforce 60-second cooldown between reset requests
    if (resetCooldown > 0) return

    setResetLoading(true)
    const supabase = createClient()

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      resetEmail,
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      }
    )

    setResetLoading(false)

    if (resetError) {
      setError(
        'Fehler beim Senden der Passwort-Zurücksetzung. Bitte erneut versuchen.'
      )
      return
    }

    setResetSent(true)
    setResetCooldown(60)
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Anmelden</CardTitle>
          <CardDescription>
            Melde dich mit deinem Account an, um deine Läufe zu verwalten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showResetInfo ? (
            <>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-Mail</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="name@example.com"
                            autoComplete="email"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Passwort</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Passwort"
                            autoComplete="current-password"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                    aria-label="Anmelden"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Anmelden...
                      </>
                    ) : (
                      'Anmelden'
                    )}
                  </Button>
                </form>
              </Form>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetInfo(true)
                    setError(null)
                    setResetEmail(form.getValues('email'))
                  }}
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  Passwort vergessen?
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {resetSent ? (
                <Alert>
                  <AlertDescription>
                    Falls ein Account mit dieser E-Mail existiert, wurde eine
                    E-Mail zum Zurücksetzen des Passworts gesendet. Bitte
                    prüfe deinen Posteingang.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Gib deine E-Mail-Adresse ein und wir senden dir einen Link
                    zum Zurücksetzen deines Passworts.
                  </p>
                  <div className="space-y-2">
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      disabled={resetLoading}
                      aria-label="E-Mail für Passwort-Zurücksetzung"
                    />
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    onClick={handlePasswordReset}
                    className="w-full"
                    disabled={resetLoading || !resetEmail || resetCooldown > 0}
                  >
                    {resetLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sende...
                      </>
                    ) : resetCooldown > 0 ? (
                      `Erneut senden in ${resetCooldown}s`
                    ) : (
                      'Passwort zurücksetzen'
                    )}
                  </Button>
                </>
              )}

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetInfo(false)
                    setResetSent(false)
                    setError(null)
                  }}
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  Zurück zum Login
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
