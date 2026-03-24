'use client'

import { useEffect, useState, useCallback } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Loader2, AlertCircle, Info } from 'lucide-react'

import { DialogOverlay, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface Runner {
  uid: number
  nr: number
  name: string
}

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; runners: Runner[] }

interface RunnerSelectDialogProps {
  open: boolean
  onAssigned: () => void
}

export function RunnerSelectDialog({ open, onAssigned }: RunnerSelectDialogProps) {
  const [fetchState, setFetchState] = useState<FetchState>({ status: 'loading' })
  const [selectedUid, setSelectedUid] = useState<string>('')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  const fetchRunners = useCallback(async () => {
    setFetchState({ status: 'loading' })
    setSelectedUid('')
    setAssignError(null)
    try {
      const resp = await fetch('/api/runner/available')
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(
          body.error ?? `Fehler beim Laden der Läufer*innenliste (HTTP ${resp.status})`
        )
      }
      const runners: Runner[] = await resp.json()
      setFetchState({ status: 'success', runners })
    } catch (error) {
      setFetchState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unbekannter Fehler beim Laden der Läufer*innenliste',
      })
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchRunners()
    }
  }, [open, fetchRunners])

  async function handleAssign() {
    if (!selectedUid) return
    setAssigning(true)
    setAssignError(null)
    try {
      const resp = await fetch('/api/runner/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typo3_uid: parseInt(selectedUid, 10) }),
      })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(
          body.error ?? `Zuordnung fehlgeschlagen (HTTP ${resp.status})`
        )
      }
      onAssigned()
    } catch (error) {
      setAssignError(
        error instanceof Error
          ? error.message
          : 'Zuordnung fehlgeschlagen'
      )
      // Refresh runner list in case the selected runner was taken (race condition)
      setSelectedUid('')
      fetchRunners()
    } finally {
      setAssigning(false)
    }
  }

  return (
    <DialogPrimitive.Root open={open}>
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]'
          )}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          aria-describedby="runner-select-description"
        >
          <DialogHeader>
            <DialogTitle>Willkommen! Bitte wähle deine Läufer*in</DialogTitle>
            <DialogDescription id="runner-select-description">
              Wähle deinen Namen aus der Liste, um dein Konto mit deinem Läufer*innenprofil zu verknüpfen.
            </DialogDescription>
          </DialogHeader>

          {/* Error from assignment attempt */}
          {assignError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{assignError}</AlertDescription>
            </Alert>
          )}

          {/* Loading state */}
          {fetchState.status === 'loading' && (
            <div className="space-y-3 py-4" role="status" aria-label="Läufer*innenliste wird geladen">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          )}

          {/* Fetch error state */}
          {fetchState.status === 'error' && (
            <div className="space-y-4 py-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>{fetchState.message}</AlertDescription>
              </Alert>
              <Button onClick={fetchRunners} variant="outline" className="w-full">
                Erneut versuchen
              </Button>
            </div>
          )}

          {/* Success state */}
          {fetchState.status === 'success' && (
            <>
              {fetchState.runners.length === 0 ? (
                /* Empty state — all runners assigned */
                <Alert className="py-4">
                  <Info className="h-4 w-4" aria-hidden="true" />
                  <AlertDescription>
                    Alle Läufer*innen sind bereits vergeben. Bitte wende dich an die Administrator*in.
                  </AlertDescription>
                </Alert>
              ) : (
                /* Runner list */
                <div className="space-y-4 py-2">
                  <Select
                    value={selectedUid}
                    onValueChange={setSelectedUid}
                    disabled={assigning}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label="Läufer*in auswählen"
                    >
                      <SelectValue placeholder="Läufer*in auswählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fetchState.runners.map((runner) => (
                        <SelectItem
                          key={runner.uid}
                          value={String(runner.uid)}
                        >
                          {runner.name} (Nr. {runner.nr})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <DialogFooter>
                    <Button
                      onClick={handleAssign}
                      disabled={!selectedUid || assigning}
                      className="w-full sm:w-auto"
                    >
                      {assigning && (
                        <Loader2
                          className="mr-2 h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                      )}
                      {assigning ? 'Wird zugeordnet...' : 'Bestätigen'}
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
