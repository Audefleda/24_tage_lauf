'use client'

import { useEffect, useState, useCallback } from 'react'
import { PageHeader } from '@/components/page-header'
import { StatsCard } from '@/components/stats-card'
import { RunsTable } from '@/components/runs-table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { buildEventDays } from '@/lib/event-config'

interface Run {
  runDate: string
  runDistance: string
}

interface RunnerData {
  uid: number
  name: string
  runs: Run[]
}

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: RunnerData }

export default function RunsPage() {
  const [state, setState] = useState<PageState>({ status: 'loading' })

  const fetchRunner = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const resp = await fetch('/api/runner')
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(
          body.error ?? `Fehler beim Laden der Daten (HTTP ${resp.status})`
        )
      }
      const data: RunnerData = await resp.json()
      setState({ status: 'success', data })
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
    } catch {
      // Silent fail on refresh -- the table already shows its own error
    }
  }, [])

  useEffect(() => {
    fetchRunner()
  }, [fetchRunner])

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
      <PageHeader runnerName={data.name} />
      <StatsCard totalDistance={totalDistance} runDays={runDays} />
      <RunsTable
        days={eventDays}
        allRuns={data.runs}
        onRunsUpdated={refreshRunner}
      />
    </div>
  )
}
