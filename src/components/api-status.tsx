'use client'

import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

type Status = 'loading' | 'ok' | 'error'

export function ApiStatus() {
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('')

  async function check() {
    setStatus('loading')
    try {
      const resp = await fetch('/api/health')
      const data: { ok: boolean; message: string } = await resp.json()
      setStatus(data.ok ? 'ok' : 'error')
      setMessage(data.message)
    } catch {
      setStatus('error')
      setMessage('Health-Check konnte nicht durchgeführt werden.')
    }
  }

  useEffect(() => {
    check()
  }, [])

  if (status === 'loading') {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <Alert variant="destructive">
        <AlertTitle>Verbindungsfehler</AlertTitle>
        <AlertDescription className="mt-1 space-y-2">
          <p>{message}</p>
          <Button size="sm" variant="outline" onClick={check}>
            Erneut versuchen
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert className="border-green-200 bg-green-50 text-green-800">
      <AlertTitle>Verbunden</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
