'use client'

import { useState } from 'react'
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
  email: z.string().email('Bitte eine gueltige E-Mail-Adresse eingeben'),
  password: z.string().min(1, 'Passwort ist erforderlich'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/runs'
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showResetInfo, setShowResetInfo] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

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

    // Profil pruefen: Ist der User einem TYPO3-Laeufer zugeordnet?
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setIsLoading(false)
      setError('E-Mail oder Passwort falsch')
      return
    }

    const { data: profile } = await supabase
      .from('runner_profiles')
      .select('typo3_uid')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      // User hat keinen Laeufer zugeordnet - Admin-User duerfen trotzdem weiter
      const role = user.app_metadata?.role
      if (role !== 'admin') {
        setIsLoading(false)
        setError(
          'Dein Account ist noch nicht konfiguriert. Bitte Admin kontaktieren.'
        )
        // Session beenden, da der Nutzer sich nicht richtig einloggen kann
        await supabase.auth.signOut()
        return
      }
    }

    router.push(redirectTo)
    router.refresh()
  }

  async function handlePasswordReset() {
    if (!resetEmail) return

    setResetLoading(true)
    const supabase = createClient()

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      resetEmail,
      {
        redirectTo: `${window.location.origin}/login`,
      }
    )

    setResetLoading(false)

    if (resetError) {
      setError(
        'Fehler beim Senden der Passwort-Zuruecksetzung. Bitte erneut versuchen.'
      )
      return
    }

    setResetSent(true)
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Anmelden</CardTitle>
          <CardDescription>
            Melde dich mit deinem Account an, um deine Laeufe zu verwalten.
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
                    E-Mail zum Zuruecksetzen des Passworts gesendet. Bitte
                    pruefe deinen Posteingang.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Gib deine E-Mail-Adresse ein und wir senden dir einen Link
                    zum Zuruecksetzen deines Passworts.
                  </p>
                  <div className="space-y-2">
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      disabled={resetLoading}
                      aria-label="E-Mail fuer Passwort-Zuruecksetzung"
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
                    disabled={resetLoading || !resetEmail}
                  >
                    {resetLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sende...
                      </>
                    ) : (
                      'Passwort zuruecksetzen'
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
                  Zurueck zum Login
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
