'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
} from '@/components/ui/alert-dialog'
import { AlertCircle, RefreshCw } from 'lucide-react'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; enabled: boolean }

export function ExternalWebhookControl() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const fetchStatus = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const resp = await fetch('/api/admin/external-webhook/status')
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      setState({ status: 'loaded', enabled: data.enabled })
    } catch {
      setState({ status: 'error', message: 'Status konnte nicht geladen werden.' })
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  async function setEnabled(enabled: boolean) {
    setSaving(true)
    try {
      const resp = await fetch('/api/admin/external-webhook/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      setState({ status: 'loaded', enabled })
      toast.success(enabled ? 'Externer Webhook aktiviert.' : 'Externer Webhook deaktiviert.')
    } catch {
      toast.error('Status konnte nicht gespeichert werden.')
    } finally {
      setSaving(false)
      setShowConfirm(false)
    }
  }

  return (
    <>
      {state.status === 'loading' && (
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-9 w-40 ml-auto" />
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            {state.enabled ? (
              <>
                <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                  Aktiv
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Webhook-Aufrufe werden an TYPO3 weitergeleitet.
                </span>
              </>
            ) : (
              <>
                <Badge variant="destructive">Deaktiviert</Badge>
                <span className="text-sm text-muted-foreground">
                  Alle Webhook-Aufrufe werden mit 503 abgewiesen.
                </span>
              </>
            )}
          </div>

          {state.enabled ? (
            <Button
              variant="destructive"
              size="sm"
              className="self-start sm:ml-auto"
              disabled={saving}
              onClick={() => setShowConfirm(true)}
            >
              {saving ? 'Wird gespeichert…' : 'Webhook deaktivieren'}
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="self-start sm:ml-auto"
              disabled={saving}
              onClick={() => setEnabled(true)}
            >
              {saving ? 'Wird gespeichert…' : 'Webhook aktivieren'}
            </Button>
          )}
        </div>
      )}

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Webhook deaktivieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle eingehenden Webhook-Aufrufe werden sofort mit{' '}
              <strong>503 Service Unavailable</strong> abgewiesen. Bestehende Tokens bleiben
              erhalten und können nach der Reaktivierung wieder verwendet werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => setEnabled(false)}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? 'Wird gespeichert…' : 'Webhook deaktivieren'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
