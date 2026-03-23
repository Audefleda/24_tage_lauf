'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface StravaStatus {
  connected: boolean
  athlete_id?: number
  last_synced_at?: string | null
}

type SectionState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; data: StravaStatus }

// Strava brand icon (SVG)
function StravaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
    </svg>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function StravaConnectSection() {
  const [state, setState] = useState<SectionState>({ status: 'loading' })
  const [disconnecting, setDisconnecting] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()

  const fetchStatus = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const resp = await fetch('/api/strava/status')
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data: StravaStatus = await resp.json()
      setState({ status: 'loaded', data })
    } catch {
      setState({ status: 'error', message: 'Strava-Status konnte nicht geladen werden.' })
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Handle ?strava= query param from OAuth callback
  useEffect(() => {
    const strava = searchParams.get('strava')
    if (!strava) return

    if (strava === 'connected') {
      toast.success('Strava erfolgreich verbunden!')
    } else if (strava === 'denied') {
      toast.warning('Strava-Verbindung abgebrochen.')
    } else if (strava === 'already_connected') {
      toast.error('Dieser Strava-Account ist bereits mit einem anderen Konto verbunden.')
    } else if (strava === 'error') {
      toast.error('Fehler beim Verbinden mit Strava.')
    }

    // Remove the query param without re-render loop
    const params = new URLSearchParams(searchParams.toString())
    params.delete('strava')
    const newUrl = params.size > 0 ? `?${params.toString()}` : window.location.pathname
    router.replace(newUrl)
  }, [searchParams, router])

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      const resp = await fetch('/api/strava/connect', { method: 'DELETE' })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${resp.status}`)
      }
      toast.success('Strava-Verbindung getrennt.')
      fetchStatus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Trennen fehlgeschlagen.')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StravaIcon className="h-5 w-5 text-[#FC4C02]" />
          Strava
        </CardTitle>
        <CardDescription>
          Läufe automatisch aus Strava übernehmen
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state.status === 'loading' && (
          <div className="flex items-center gap-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-9 w-32 ml-auto" />
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
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {state.data.connected ? (
              <>
                <div className="flex items-center gap-3">
                  <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                    Verbunden
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {state.data.last_synced_at
                      ? `Zuletzt synchronisiert: ${formatDate(state.data.last_synced_at)}`
                      : 'Noch nicht synchronisiert'}
                  </span>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="self-start sm:ml-auto" disabled={disconnecting}>
                      {disconnecting ? 'Wird getrennt…' : 'Strava trennen'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Strava trennen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Zukünftige Läufe werden nicht mehr automatisch übertragen. Bereits eingetragene Läufe bleiben erhalten.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDisconnect}>
                        Trennen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">Nicht verbunden</Badge>
                  <span className="text-sm text-muted-foreground">
                    Verbinde deinen Strava-Account, um Läufe automatisch zu übertragen.
                  </span>
                </div>
                <Button
                  size="sm"
                  className="self-start sm:ml-auto bg-[#FC4C02] hover:bg-[#e04300] text-white"
                  onClick={() => { window.location.href = '/api/strava/connect' }}
                >
                  <StravaIcon className="h-4 w-4 mr-2" />
                  Strava verbinden
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
