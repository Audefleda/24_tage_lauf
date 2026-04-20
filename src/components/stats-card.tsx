'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity, Route, Users } from 'lucide-react'

interface StatsCardProps {
  totalDistance: number
  runDays: number
  /** PROJ-26: Capped team total km (null = not yet loaded) */
  teamTotalKm?: number | null
  /** PROJ-26: Whether team stats are currently loading */
  teamStatsLoading?: boolean
  /** PROJ-26: Whether team stats failed to load */
  teamStatsError?: boolean
}

export function StatsCard({
  totalDistance,
  runDays,
  teamTotalKm,
  teamStatsLoading,
  teamStatsError,
}: StatsCardProps) {
  const formattedDistance = totalDistance.toFixed(2).replace('.', ',')

  // Format team total km in German locale
  const formattedTeamKm =
    teamTotalKm != null
      ? teamTotalKm.toFixed(2).replace('.', ',')
      : null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <Card>
        <CardContent className="flex items-center gap-3 pt-6">
          <div className="rounded-none bg-primary/10 p-2">
            <Route className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Gesamtdistanz</p>
            <p className="text-2xl font-bold">{formattedDistance} km</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center gap-3 pt-6">
          <div className="rounded-none bg-primary/10 p-2">
            <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Lauftage</p>
            <p className="text-2xl font-bold">{runDays}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center gap-3 pt-6">
          <div className="rounded-none bg-primary/10 p-2">
            <Users className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              Team-Gesamt BettercallPaul
            </p>
            {teamStatsLoading ? (
              <Skeleton className="h-8 w-24 mt-1" />
            ) : teamStatsError || formattedTeamKm == null ? (
              <p className="text-2xl font-bold">--</p>
            ) : (
              <p className="text-2xl font-bold">{formattedTeamKm} km</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
