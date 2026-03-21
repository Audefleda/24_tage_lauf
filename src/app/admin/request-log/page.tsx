import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { RequestLogTable } from '@/components/request-log-table'

export default function RequestLogPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>TYPO3 Request Log</CardTitle>
        <CardDescription>
          Alle TYPO3-Requests mit Status und Antworten
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RequestLogTable />
      </CardContent>
    </Card>
  )
}
