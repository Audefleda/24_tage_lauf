'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react'

interface WebhookStatus {
  registered: boolean
  subscription_id: string | null
  strava_confirmed: boolean
  strava_callback_url: string | null
}

type SectionState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; data: WebhookStatus }

export function StravaWebhookSetup() {
  const [state, setState] = useState<SectionState>({ status: 'loading' })
  const [registering, setRegistering] = useState(false)
  const [deregistering, setDeregistering] = useState(false)

  const fetchStatus = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const resp = await fetch('/api/admin/strava/register-webhook')
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data: WebhookStatus = await resp.json()
      setState({ status: 'loaded', data })
    } catch {
      setState({ status: 'error', message: 'Webhook-Status konnte nicht geladen werden.' })
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  async function handleRegister() {
    setRegistering(true)
    try {
      const resp = await fetch('/api/admin/strava/register-webhook', { method: 'POST' })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(body.error ?? `HTTP ${resp.status}`)
      toast.success(`Webhook registriert (ID: ${body.subscription_id})`)
      fetchStatus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen.')
    } finally {
      setRegistering(false)
    }
  }

  async function handleDeregister() {
    setDeregistering(true)
    try {
      const resp = await fetch('/api/admin/strava/register-webhook', { method: 'DELETE' })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(body.error ?? `HTTP ${resp.status}`)
      toast.success('Webhook erfolgreich deregistriert')
      fetchStatus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Deregistrierung fehlgeschlagen.')
    } finally {
      setDeregistering(false)
    }
  }

  return (
    <div className="space-y-4">
      {state.status === 'loading' && (
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
      )}

      {state.status === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            {state.message}
            <Button variant="ghost" size="sm" onClick={fetchStatus}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Erneut versuchen
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {state.status === 'loaded' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {state.data.strava_confirmed ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                  Webhook aktiv
                </Badge>
                <span className="text-sm text-muted-foreground">
                  ID: {state.data.subscription_id}
                </span>
              </>
            ) : state.data.registered ? (
              <>
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <Badge variant="secondary">Lokal registriert, Strava nicht bestätigt</Badge>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
                <Badge variant="outline">Nicht registriert</Badge>
              </>
            )}
          </div>

          {state.data.strava_callback_url && (
            <p className="text-xs text-muted-foreground font-mono">
              {state.data.strava_callback_url}
            </p>
          )}

          {!state.data.registered && (
            <Button onClick={handleRegister} disabled={registering} size="sm">
              {registering ? 'Wird registriert…' : 'Webhook bei Strava registrieren'}
            </Button>
          )}

          {state.data.registered && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={deregistering}>
                  {deregistering ? 'Wird deregistriert…' : 'Webhook deregistrieren'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Webhook deregistrieren?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Neue Strava-Events werden nicht mehr verarbeitet. Bestehende
                    Strava-Verbindungen der Nutzer*innen bleiben erhalten.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeregister}
                    disabled={deregistering}
                    className={buttonVariants({ variant: 'destructive' })}
                  >
                    Deregistrieren
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}
    </div>
  )
}
