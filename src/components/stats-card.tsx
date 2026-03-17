'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Activity, Route } from 'lucide-react'

interface StatsCardProps {
  totalDistance: number
  runDays: number
}

export function StatsCard({ totalDistance, runDays }: StatsCardProps) {
  const formattedDistance = totalDistance.toFixed(2).replace('.', ',')

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <CardContent className="flex items-center gap-3 pt-6">
          <div className="rounded-md bg-primary/10 p-2">
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
          <div className="rounded-md bg-primary/10 p-2">
            <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Lauftage</p>
            <p className="text-2xl font-bold">{runDays}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
