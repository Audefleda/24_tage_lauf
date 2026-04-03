'use client'

import { useEffect, useState, useCallback } from 'react'
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
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, RefreshCw, Copy, Check, Webhook, Eye, EyeOff } from 'lucide-react'

interface TokenStatus {
  active: boolean
  created_at?: string
}

type SectionState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; data: TokenStatus }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getWebhookUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/webhook/external`
  }
  return '/api/webhook/external'
}

export function ExternalWebhookSection() {
  const [state, setState] = useState<SectionState>({ status: 'loading' })
  const [generating, setGenerating] = useState(false)
  // Dialog for showing the newly generated token (one-time display)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [showTokenDialog, setShowTokenDialog] = useState(false)
  // Confirmation dialog before regenerating
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)
  // Copy feedback states
  const [copiedToken, setCopiedToken] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  // Reveal/hide token in dialog
  const [tokenRevealed, setTokenRevealed] = useState(false)

  const fetchStatus = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const resp = await fetch('/api/runner/webhook-token')
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data: TokenStatus = await resp.json()
      setState({ status: 'loaded', data })
    } catch {
      setState({ status: 'error', message: 'Webhook-Token-Status konnte nicht geladen werden.' })
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  async function generateToken() {
    setGenerating(true)
    try {
      const resp = await fetch('/api/runner/webhook-token', { method: 'POST' })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${resp.status}`)
      }
      const data = await resp.json()
      setNewToken(data.token)
      setTokenRevealed(true)
      setShowTokenDialog(true)
      setCopiedToken(false)
      // Refresh status
      fetchStatus()
      toast.success('Token wurde generiert.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Token konnte nicht generiert werden.')
    } finally {
      setGenerating(false)
      setShowRegenerateDialog(false)
    }
  }

  async function copyToClipboard(text: string, type: 'token' | 'url') {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'token') {
        setCopiedToken(true)
        setTimeout(() => setCopiedToken(false), 2000)
      } else {
        setCopiedUrl(true)
        setTimeout(() => setCopiedUrl(false), 2000)
      }
      toast.success('In die Zwischenablage kopiert.')
    } catch {
      toast.error('Kopieren fehlgeschlagen.')
    }
  }

  function handleTokenDialogClose() {
    setShowTokenDialog(false)
    setNewToken(null)
    setTokenRevealed(false)
  }

  const isActive = state.status === 'loaded' && state.data.active
  const webhookUrl = getWebhookUrl()

  const exampleBody = `{
  "date": "${new Date().toISOString().split('T')[0]}",
  "distance_km": 10.5
}`

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary" aria-hidden="true" />
            Externer Webhook
          </CardTitle>
          <CardDescription>
            Laufe automatisch via Make.com, Zapier oder andere Tools eintragen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Loading state */}
          {state.status === 'loading' && (
            <div className="flex items-center gap-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-9 w-40 ml-auto" />
            </div>
          )}

          {/* Error state */}
          {state.status === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                {state.message}
                <Button variant="ghost" size="sm" onClick={fetchStatus}>
                  <RefreshCw className="h-4 w-4 mr-1" aria-hidden="true" />
                  Erneut versuchen
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Loaded state */}
          {state.status === 'loaded' && (
            <>
              {/* Token status + action buttons */}
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="flex items-center gap-3">
                  {state.data.active ? (
                    <>
                      <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                        Aktiv
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        seit {formatDate(state.data.created_at!)}
                      </span>
                    </>
                  ) : (
                    <>
                      <Badge variant="secondary">Kein Token</Badge>
                      <span className="text-sm text-muted-foreground">
                        Erstelle einen Token, um den Webhook zu nutzen.
                      </span>
                    </>
                  )}
                </div>

                {state.data.active ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-start sm:ml-auto"
                    disabled={generating}
                    onClick={() => setShowRegenerateDialog(true)}
                  >
                    {generating ? 'Wird generiert\u2026' : 'Token neu generieren'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="self-start sm:ml-auto"
                    disabled={generating}
                    onClick={generateToken}
                  >
                    {generating ? 'Wird generiert\u2026' : 'Token generieren'}
                  </Button>
                )}
              </div>

              {/* Instructions (visible when token is active) */}
              {isActive && (
                <div className="mt-4 space-y-3 rounded-md border bg-muted/50 p-4">
                  <h4 className="text-sm font-medium">Anleitung</h4>
                  <p className="text-sm text-muted-foreground">
                    Konfiguriere dein Make.com-Szenario oder Zapier-Zap mit folgenden Daten:
                  </p>

                  {/* Webhook URL */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Webhook-URL (POST)
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded bg-background px-3 py-2 text-xs font-mono break-all border">
                        {webhookUrl}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(webhookUrl, 'url')}
                        aria-label="Webhook-URL kopieren"
                      >
                        {copiedUrl ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Header */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Header
                    </label>
                    <code className="block rounded bg-background px-3 py-2 text-xs font-mono break-all border">
                      Authorization: Bearer &lt;dein-token&gt;
                    </code>
                  </div>

                  {/* Example Body */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Body (JSON)
                    </label>
                    <pre className="rounded bg-background px-3 py-2 text-xs font-mono whitespace-pre-wrap border">
                      {exampleBody}
                    </pre>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Beide Felder (<code className="text-xs">date</code> und <code className="text-xs">distance_km</code>) sind Pflichtfelder.
                    Die Distanz wird als Zahl erwartet (kein String).
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Confirm regeneration */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Token neu generieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Der alte Token wird <strong>sofort ungueltig</strong>. Laufende Make.com-Szenarien
              oder Zapier-Zaps schlagen fehl, bis du dort den neuen Token eintraegst.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={generating}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={generateToken} disabled={generating}>
              {generating ? 'Wird generiert\u2026' : 'Token neu generieren'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Show newly generated token (one-time) */}
      <AlertDialog open={showTokenDialog} onOpenChange={(open) => { if (!open) handleTokenDialogClose() }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dein neuer Webhook-Token</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Dieser Token wird <strong>nur einmal</strong> angezeigt. Kopiere ihn jetzt
                    und speichere ihn sicher.
                  </AlertDescription>
                </Alert>

                {newToken && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all border">
                        {tokenRevealed ? newToken : '\u2022'.repeat(32)}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTokenRevealed(!tokenRevealed)}
                        aria-label={tokenRevealed ? 'Token verbergen' : 'Token anzeigen'}
                      >
                        {tokenRevealed ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(newToken, 'token')}
                        aria-label="Token kopieren"
                      >
                        {copiedToken ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleTokenDialogClose}>
              Verstanden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
