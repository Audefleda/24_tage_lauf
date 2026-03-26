'use client'

import { useEffect, useState, useCallback } from 'react'
import { PageHeader } from '@/components/page-header'
import { StatsCard } from '@/components/stats-card'
import { RunsTable } from '@/components/runs-table'
import { RunnerSelectDialog } from '@/components/runner-select-dialog'
import { StravaConnectSection } from '@/components/strava-connect-section'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { buildEventDays } from '@/lib/event-config'

interface Run {
  runDate: string
  runDistance: string
}

interface RunnerData {
  uid: number
  name: string
  age: number | null
  runs: Run[]
  teamsNotificationsEnabled: boolean
}

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'no-profile' }
  | { status: 'success'; data: RunnerData }

export default function RunsPage() {
  const [state, setState] = useState<PageState>({ status: 'loading' })
  const [teamsNotificationsEnabled, setTeamsNotificationsEnabled] = useState(true)
  const [togglingNotifications, setTogglingNotifications] = useState(false)

  const fetchRunner = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const resp = await fetch('/api/runner')
      if (resp.status === 404) {
        // No runner profile assigned yet — show assignment dialog
        setState({ status: 'no-profile' })
        return
      }
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(
          body.error ?? `Fehler beim Laden der Daten (HTTP ${resp.status})`
        )
      }
      const data: RunnerData = await resp.json()
      setState({ status: 'success', data })
      setTeamsNotificationsEnabled(data.teamsNotificationsEnabled ?? true)
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unbekannter Fehler beim Laden der Daten',
      })
    }
  }, [])

  // Silent refresh: update data without showing loading skeleton
  const refreshRunner = useCallback(async () => {
    try {
      const resp = await fetch('/api/runner')
      if (!resp.ok) return
      const data: RunnerData = await resp.json()
      setState({ status: 'success', data })
      setTeamsNotificationsEnabled(data.teamsNotificationsEnabled ?? true)
    } catch {
      // Silent fail on refresh -- the table already shows its own error
    }
  }, [])

  const handleToggleNotifications = useCallback(async () => {
    const previous = teamsNotificationsEnabled
    const next = !previous
    setTeamsNotificationsEnabled(next)
    setTogglingNotifications(true)

    try {
      const resp = await fetch('/api/runner/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${resp.status}`)
      }

      toast.success(
        next
          ? 'Teams-Benachrichtigungen aktiviert'
          : 'Teams-Benachrichtigungen deaktiviert'
      )
    } catch (error) {
      setTeamsNotificationsEnabled(previous)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Fehler beim Speichern der Einstellung'
      )
    } finally {
      setTogglingNotifications(false)
    }
  }, [teamsNotificationsEnabled])

  useEffect(() => {
    fetchRunner()
  }, [fetchRunner])

  // No profile state — show assignment dialog
  if (state.status === 'no-profile') {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-[600px]" />
        <RunnerSelectDialog
          open={true}
          onAssigned={() => {
            // After successful assignment, re-fetch runner data
            fetchRunner()
          }}
        />
      </div>
    )
  }

  // Loading state
  if (state.status === 'loading') {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-[600px]" />
      </div>
    )
  }

  // Error state
  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <AlertCircle
          className="h-12 w-12 text-destructive"
          aria-hidden="true"
        />
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
        <Button onClick={fetchRunner} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
          Erneut versuchen
        </Button>
      </div>
    )
  }

  // Success state
  const { data } = state
  const eventDays = buildEventDays(data.runs)

  const totalDistance = eventDays.reduce(
    (sum, day) => sum + (day.distance ?? 0),
    0
  )
  const runDays = eventDays.filter(
    (day) => day.distance !== null && day.distance > 0
  ).length

  return (
    <div className="space-y-6">
      <PageHeader
        runnerName={data.name}
        runnerAge={data.age}
        onProfileUpdated={(newName, newAge) => {
          setState({
            status: 'success',
            data: { ...data, name: newName, age: newAge },
          })
        }}
      />
      <StatsCard totalDistance={totalDistance} runDays={runDays} />
      <RunsTable
        days={eventDays}
        allRuns={data.runs}
        onRunsUpdated={refreshRunner}
      />
      <StravaConnectSection />

      {/* Teams notification opt-out */}
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="flex items-center gap-3">
          <Switch
            id="teams-opt-out"
            checked={teamsNotificationsEnabled}
            onCheckedChange={handleToggleNotifications}
            disabled={togglingNotifications}
            aria-label="Teams-Benachrichtigungen"
          />
          <Label
            htmlFor="teams-opt-out"
            className="text-sm font-medium leading-none cursor-pointer"
          >
            Teams-Benachrichtigungen
          </Label>
        </div>
        <p className="text-sm text-muted-foreground pl-14">
          Wenn aktiv, werden für deine Läufe Nachrichten an Teams gesendet.
        </p>
      </div>
    </div>
  )
}
