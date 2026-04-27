'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity, Route, Users, Trophy, ExternalLink } from 'lucide-react'

interface TeamRanking {
  rank: number
  totalTeams: number
}

interface StatsCardProps {
  totalDistance: number
  runDays: number
  /** PROJ-26: Capped team total km (null = not yet loaded) */
  teamTotalKm?: number | null
  /** PROJ-26: Whether team stats are currently loading */
  teamStatsLoading?: boolean
  /** PROJ-26: Whether team stats failed to load */
  teamStatsError?: boolean
  /** PROJ-28: Team ranking data (null = not yet loaded) */
  teamRanking?: TeamRanking | null
  /** PROJ-28: Whether team ranking is currently loading */
  teamRankingLoading?: boolean
  /** PROJ-28: Whether team ranking failed to load */
  teamRankingError?: boolean
}

export function StatsCard({
  totalDistance,
  runDays,
  teamTotalKm,
  teamStatsLoading,
  teamStatsError,
  teamRanking,
  teamRankingLoading,
  teamRankingError,
}: StatsCardProps) {
  const formattedDistance = totalDistance.toFixed(2).replace('.', ',')

  // Format team total km in German locale
  const formattedTeamKm =
    teamTotalKm != null
      ? teamTotalKm.toFixed(2).replace('.', ',')
      : null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
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
      <Card>
        <CardContent className="flex items-center gap-3 pt-6">
          <div className="rounded-none bg-primary/10 p-2">
            <Trophy className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Team-Position</p>
            {teamRankingLoading ? (
              <Skeleton className="h-8 w-32 mt-1" />
            ) : teamRankingError || teamRanking == null ? (
              <p className="text-sm text-muted-foreground mt-1">Position nicht verfügbar</p>
            ) : (
              <p className="text-2xl font-bold">
                Platz {teamRanking.rank}{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  von {teamRanking.totalTeams} Teams
                </span>
              </p>
            )}
            <a
              href="https://www.stuttgarter-kinderstiftung.de/unsere-arbeit/24-tage-lauf-fuer-kinderrechte/alle-teams"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
            >
              Zur Rangliste
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
