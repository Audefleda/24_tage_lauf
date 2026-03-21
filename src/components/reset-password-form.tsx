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

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Passwort muss mindestens 8 Zeichen lang sein'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwoerter stimmen nicht ueberein',
    path: ['confirmPassword'],
  })

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isWelcome = searchParams.get('welcome') === 'true'
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)

  // BUG-3 fix: Check for active session on mount.
  // If no session exists, redirect to login instead of showing the form.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace(
          '/login?error=Bitte fordere einen neuen Link zum Zuruecksetzen deines Passworts an.'
        )
      } else {
        setSessionChecked(true)
      }
    })
  }, [router])

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  async function onSubmit(values: ResetPasswordFormValues) {
    setIsLoading(true)
    setError(null)

    // BUG-5 fix: Use server-side API route with Zod validation
    const response = await fetch('/api/auth/update-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: values.password }),
    })

    if (!response.ok) {
      setIsLoading(false)
      const data = await response.json()
      setError(
        data.error ??
          'Fehler beim Setzen des neuen Passworts. Bitte versuche es erneut oder fordere einen neuen Link an.'
      )
      return
    }

    // Passwort erfolgreich geaendert — zur Laeufe-Uebersicht weiterleiten
    router.push('/runs')
    router.refresh()
  }

  if (!sessionChecked) {
    return null
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">
            {isWelcome ? 'Willkommen!' : 'Neues Passwort setzen'}
          </CardTitle>
          <CardDescription>
            {isWelcome
              ? 'Bitte setze dein Passwort, um die App zu nutzen. Mindestens 8 Zeichen.'
              : 'Gib dein neues Passwort ein. Mindestens 8 Zeichen.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Neues Passwort</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Neues Passwort"
                        autoComplete="new-password"
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
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Passwort bestaetigen</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Passwort bestaetigen"
                        autoComplete="new-password"
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
                aria-label="Passwort speichern"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Speichere...
                  </>
                ) : (
                  'Passwort speichern'
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-4 text-center">
            <a
              href="/login"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Zurueck zum Login
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
