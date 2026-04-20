'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, RefreshCw, Trophy, Users, TrendingUp } from 'lucide-react'

interface RankingEntry {
  rank: number
  uid: number
  nr: number
  name: string
  totalKm: number
  runCount: number
}

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: RankingEntry[] }

function formatKm(km: number): string {
  return km.toFixed(2).replace('.', ',')
}

export default function RanglistePage() {
  const [state, setState] = useState<PageState>({ status: 'loading' })

  const fetchRanking = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const resp = await fetch('/api/admin/rangliste')
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(
          body.error ?? `Fehler beim Laden der Rangliste (HTTP ${resp.status})`
        )
      }
      const data: RankingEntry[] = await resp.json()
      setState({ status: 'success', data })
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Rangliste konnte nicht geladen werden. Bitte versuche es später erneut.',
      })
    }
  }, [])

  useEffect(() => {
    fetchRanking()
  }, [fetchRanking])

  // Loading state
  if (state.status === 'loading') {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-8" />
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-12" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (state.status === 'error') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rangliste</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Alle Läufer*innen sortiert nach Gesamtkilometern
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <AlertCircle
            className="h-12 w-12 text-destructive"
            aria-hidden="true"
          />
          <Alert variant="destructive" className="max-w-md">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
          <Button onClick={fetchRanking} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
            Erneut versuchen
          </Button>
        </div>
      </div>
    )
  }

  // Success state
  const { data } = state
  const totalRunners = data.length
  const activeRunners = data.filter((r) => r.totalKm > 0).length
  const overallTotalKm = data.reduce((sum, r) => sum + r.totalKm, 0)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rangliste</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Alle Läufer*innen sortiert nach Gesamtkilometern
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-none bg-primary/10 p-2">
              <Users className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Läufer*innen gesamt
              </p>
              <p className="text-2xl font-bold">{totalRunners}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-none bg-primary/10 p-2">
              <TrendingUp
                className="h-5 w-5 text-primary"
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Aktive (mit Läufen)</p>
              <p className="text-2xl font-bold">{activeRunners}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-none bg-primary/10 p-2">
              <Trophy className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Gesamt-km aller Läufer*innen</p>
              <p className="text-2xl font-bold">{formatKm(overallTotalKm)} km</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Empty state */}
      {data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users
              className="h-10 w-10 mx-auto text-muted-foreground mb-3"
              aria-hidden="true"
            />
            <p className="text-muted-foreground">
              Noch keine Läufer*innen vorhanden.
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Ranking table */
        <Card>
          <CardHeader>
            <CardTitle>Rangliste</CardTitle>
            <CardDescription>
              Sortiert nach Gesamtkilometern im Event-Zeitraum (20.04. -
              14.05.2026)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-6 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-center">Rang</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Gesamt-km</TableHead>
                    <TableHead className="text-right">Läufe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((entry) => (
                    <TableRow
                      key={entry.uid}
                      className={
                        entry.totalKm === 0
                          ? 'text-muted-foreground'
                          : undefined
                      }
                    >
                      <TableCell className="text-center">
                        {entry.rank <= 3 && entry.totalKm > 0 ? (
                          <RankBadge rank={entry.rank} />
                        ) : (
                          <span className="text-sm font-medium">
                            {entry.rank}.
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{entry.name}</span>
                          <span className="text-xs text-muted-foreground">
                            Nr. {entry.nr}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatKm(entry.totalKm)} km
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {entry.runCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/** Colored badge for top 3 ranks */
function RankBadge({ rank }: { rank: number }) {
  const variants: Record<number, string> = {
    1: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30 dark:text-yellow-400 dark:border-yellow-400/30',
    2: 'bg-gray-400/15 text-gray-600 border-gray-400/30 dark:text-gray-300 dark:border-gray-300/30',
    3: 'bg-amber-700/15 text-amber-800 border-amber-700/30 dark:text-amber-500 dark:border-amber-500/30',
  }

  return (
    <Badge
      variant="outline"
      className={`text-xs font-bold ${variants[rank] ?? ''}`}
      aria-label={`Rang ${rank}`}
    >
      {rank}.
    </Badge>
  )
}
