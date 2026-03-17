import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { RunnerAssignmentTable } from '@/components/runner-assignment-table'

export default function AdminPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Benutzerverwaltung</CardTitle>
        <CardDescription>
          Supabase-Nutzer mit TYPO3-Laeufern verknuepfen
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RunnerAssignmentTable />
      </CardContent>
    </Card>
  )
}
