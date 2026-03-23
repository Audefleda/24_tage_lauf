'use client'

interface PageHeaderProps {
  runnerName: string
}

export function PageHeader({ runnerName }: PageHeaderProps) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Meine Läufe</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Läufer*in:{' '}
        <span className="font-medium text-foreground">{runnerName}</span>
      </p>
    </div>
  )
}
