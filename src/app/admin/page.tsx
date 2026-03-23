import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RunnerAssignmentTable } from '@/components/runner-assignment-table'
import { StravaWebhookSetup } from '@/components/strava-webhook-setup'
import { FileText } from 'lucide-react'

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nutzer*innenverwaltung</CardTitle>
          <CardDescription>
            Supabase-Nutzer*innen mit TYPO3-Läufer*innen verknüpfen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RunnerAssignmentTable />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Strava Webhook</CardTitle>
          <CardDescription>
            Globale Webhook-Subscription bei Strava registrieren
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StravaWebhookSetup />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>TYPO3 Request Log</CardTitle>
          <CardDescription>
            Alle TYPO3-API-Requests einsehen und Fehler nachverfolgen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/admin/request-log">
              <FileText className="h-4 w-4 mr-2" />
              Request Log öffnen
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
