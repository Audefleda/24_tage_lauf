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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { AlertCircle, RefreshCw, Loader2, Check } from 'lucide-react'

// --- Types ---

interface AdminUser {
  id: string
  email: string
  created_at: string
  role: string
  typo3_uid: number | null
}

interface Runner {
  uid: number
  nr: number
  name: string
}

type SavingState = Record<string, 'saving' | 'saved' | 'error'>

// --- Component ---

export function RunnerAssignmentTable() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [runners, setRunners] = useState<Runner[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingRunners, setLoadingRunners] = useState(true)
  const [errorUsers, setErrorUsers] = useState<string | null>(null)
  const [errorRunners, setErrorRunners] = useState<string | null>(null)
  const [savingState, setSavingState] = useState<SavingState>({})

  // Set of typo3_uids that are already assigned to any user
  const assignedUids = new Set(
    users.filter((u) => u.typo3_uid !== null).map((u) => u.typo3_uid!)
  )

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true)
    setErrorUsers(null)
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data: AdminUser[] = await res.json()
      setUsers(data)
    } catch (err) {
      setErrorUsers(
        err instanceof Error ? err.message : 'Fehler beim Laden der Nutzer*innen'
      )
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  const fetchRunners = useCallback(async () => {
    setLoadingRunners(true)
    setErrorRunners(null)
    try {
      const res = await fetch('/api/admin/runners')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data: Runner[] = await res.json()
      data.sort((a, b) => a.name.localeCompare(b.name, 'de'))
      setRunners(data)
    } catch (err) {
      setErrorRunners(
        err instanceof Error ? err.message : 'Fehler beim Laden der Läufer*innen'
      )
    } finally {
      setLoadingRunners(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
    fetchRunners()
  }, [fetchUsers, fetchRunners])

  async function handleAssign(userId: string, runnerUidStr: string) {
    const isClear = runnerUidStr === '__none__'
    const runnerUid = isClear ? null : parseInt(runnerUidStr, 10)
    const runner = isClear ? null : runners.find((r) => r.uid === runnerUid)
    if (!isClear && !runner) return

    setSavingState((prev) => ({ ...prev, [userId]: 'saving' }))

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typo3_uid: runner ? runner.uid : null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, typo3_uid: runner ? runner.uid : null }
            : u
        )
      )

      setSavingState((prev) => ({ ...prev, [userId]: 'saved' }))
      toast.success(runner ? `${runner.name} zugeordnet` : 'Zuordnung entfernt')

      // Clear "saved" indicator after 2s
      setTimeout(() => {
        setSavingState((prev) => {
          const next = { ...prev }
          if (next[userId] === 'saved') delete next[userId]
          return next
        })
      }, 2000)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Zuordnung fehlgeschlagen'
      setSavingState((prev) => ({ ...prev, [userId]: 'error' }))
      toast.error(message)

      // Clear error indicator after 3s
      setTimeout(() => {
        setSavingState((prev) => {
          const next = { ...prev }
          if (next[userId] === 'error') delete next[userId]
          return next
        })
      }, 3000)
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  // --- Loading State ---
  if (loadingUsers || loadingRunners) {
    return (
      <div className="space-y-3" role="status" aria-label="Daten werden geladen">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    )
  }

  // --- Error State ---
  if (errorUsers) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{errorUsers}</span>
          <Button variant="outline" size="sm" onClick={fetchUsers}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Erneut versuchen
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  // --- Error loading runners (users loaded ok) ---
  const runnersError = errorRunners ? (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>Läufer*innenliste: {errorRunners}</span>
        <Button variant="outline" size="sm" onClick={fetchRunners}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Erneut laden
        </Button>
      </AlertDescription>
    </Alert>
  ) : null

  // --- Empty State ---
  if (users.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-4 text-center">
        Keine Nutzer*innen vorhanden. Nutzer*innen werden im Supabase Dashboard angelegt.
      </p>
    )
  }

  // --- Table ---
  return (
    <div>
      {runnersError}
      <div className="overflow-x-auto -mx-6 sm:mx-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-Mail</TableHead>
              <TableHead>Läufer*innen-Zuordnung</TableHead>
              <TableHead className="hidden sm:table-cell">Erstellt</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const saving = savingState[user.id]

              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium text-sm max-w-[180px] truncate">
                    {user.email}
                    {user.role === 'admin' && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        Admin
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {runners.length > 0 ? (
                      <Select
                        value={
                          user.typo3_uid !== null
                            ? String(user.typo3_uid)
                            : '__none__'
                        }
                        onValueChange={(value) => handleAssign(user.id, value)}
                        disabled={saving === 'saving'}
                      >
                        <SelectTrigger
                          className="w-full max-w-[260px]"
                          aria-label={`Läufer*innen-Zuordnung für ${user.email}`}
                        >
                          <SelectValue
                            placeholder={
                              <Badge variant="outline" className="text-orange-600 border-orange-300">
                                Nicht zugeordnet
                              </Badge>
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground">Keine Zuordnung</span>
                          </SelectItem>
                          {runners.map((runner) => {
                            const isAssignedElsewhere =
                              assignedUids.has(runner.uid) &&
                              user.typo3_uid !== runner.uid

                            return (
                              <SelectItem
                                key={runner.uid}
                                value={String(runner.uid)}
                                disabled={isAssignedElsewhere}
                              >
                                <span className={isAssignedElsewhere ? 'text-muted-foreground' : ''}>
                                  {runner.name} (Nr. {runner.nr})
                                  {isAssignedElsewhere && ' — (vergeben)'}
                                </span>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {user.typo3_uid !== null
                          ? `UID ${user.typo3_uid}`
                          : '—'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {formatDate(user.created_at)}
                  </TableCell>
                  <TableCell>
                    {saving === 'saving' && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {saving === 'saved' && (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                    {saving === 'error' && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
        <span>
          {users.length} Nutzer*innen gesamt
        </span>
        <span>
          {users.filter((u) => u.typo3_uid === null).length} ohne Zuordnung
        </span>
      </div>
    </div>
  )
}
