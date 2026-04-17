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
  | { status: 'loaded'; visible: boolean }

export function StravaUiVisibilityToggle() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const fetchStatus = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const resp = await fetch('/api/admin/strava/ui-visibility')
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      setState({ status: 'loaded', visible: data.visible })
    } catch {
      setState({
        status: 'error',
        message: 'Status konnte nicht geladen werden.',
      })
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  async function setVisible(visible: boolean) {
    setSaving(true)
    try {
      const resp = await fetch('/api/admin/strava/ui-visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible }),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      setState({ status: 'loaded', visible })
      toast.success(
        visible
          ? 'Strava-Bereich ist jetzt sichtbar.'
          : 'Strava-Bereich ist jetzt ausgeblendet.'
      )
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
            {state.visible ? (
              <>
                <Badge
                  variant="default"
                  className="bg-green-600 hover:bg-green-600"
                >
                  Sichtbar
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Strava-Bereich wird auf der Laufseite angezeigt.
                </span>
              </>
            ) : (
              <>
                <Badge variant="secondary">Ausgeblendet</Badge>
                <span className="text-sm text-muted-foreground">
                  Strava-Bereich ist fuer Laeufer*innen nicht sichtbar.
                </span>
              </>
            )}
          </div>

          {state.visible ? (
            <Button
              variant="destructive"
              size="sm"
              className="self-start sm:ml-auto"
              disabled={saving}
              onClick={() => setShowConfirm(true)}
            >
              {saving ? 'Wird gespeichert...' : 'Ausblenden'}
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="self-start sm:ml-auto"
              disabled={saving}
              onClick={() => setVisible(true)}
            >
              {saving ? 'Wird gespeichert...' : 'Sichtbar machen'}
            </Button>
          )}
        </div>
      )}

      {/* Bestaetigungs-Dialog NUR beim Deaktivieren (AC-2) */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Strava-Bereich ausblenden?</AlertDialogTitle>
            <AlertDialogDescription>
              Bestehende Strava-Verbindungen bleiben aktiv. Der Webhook
              uebertraegt weiterhin Laeufe automatisch. Nur die
              UI-Komponente auf der Laufseite wird fuer Laeufer*innen
              ausgeblendet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => setVisible(false)}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? 'Wird gespeichert...' : 'Ausblenden'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
