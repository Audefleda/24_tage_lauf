import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Placeholder page — will be replaced by PROJ-3 (Laeufe-Uebersicht)
export default function RunsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Meine Laeufe</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Du bist erfolgreich angemeldet. Die Laeufe-Uebersicht wird in einem
          naechsten Schritt implementiert.
        </p>
      </CardContent>
    </Card>
  )
}
