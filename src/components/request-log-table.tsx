'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react'

// --- Types ---

interface LogEntry {
  id: string
  typo3_runner_uid: number
  run_date: string
  run_distance_km: number
  sent_at: string
  http_status: number | null
  response_text: string | null
}

interface LogResponse {
  logs: LogEntry[]
  total: number
  limit: number
  offset: number
}

const PAGE_SIZE = 50

type SortColumn = 'sent_at' | 'typo3_runner_uid' | 'run_date' | 'run_distance_km' | 'http_status'
type SortDirection = 'asc' | 'desc'

// --- Helpers ---

function isErrorStatus(status: number | null): boolean {
  if (status === null) return true // timeout
  return status < 200 || status >= 300
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDate(dateStr: string): string {
  // dateStr is "YYYY-MM-DD"
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}.${y}`
}

function formatDistance(km: number): string {
  return km.toLocaleString('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 3,
  })
}

// --- Component ---

export function RequestLogTable() {
  const [data, setData] = useState<LogResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  // BUG-2: separate raw input value from debounced filter value
  const [uidInputValue, setUidInputValue] = useState('')
  const [runnerUidFilter, setRunnerUidFilter] = useState('')
  const [uidInputError, setUidInputError] = useState<string | null>(null) // BUG-3
  const [errorsOnly, setErrorsOnly] = useState(false)
  // BUG-1: sort state
  const [sortColumn, setSortColumn] = useState<SortColumn>('sent_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchLogs = useCallback(async (params: {
    offset: number
    runnerUid: string
    errorsOnly: boolean
    sortColumn: SortColumn
    sortDirection: SortDirection
  }) => {
    setLoading(true)
    setError(null)
    try {
      const searchParams = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(params.offset),
        sort_column: params.sortColumn,
        sort_direction: params.sortDirection,
      })
      if (params.runnerUid.trim()) {
        searchParams.set('runner_uid', params.runnerUid.trim())
      }
      if (params.errorsOnly) {
        searchParams.set('errors_only', 'true')
      }

      const res = await fetch(`/api/admin/request-log?${searchParams}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const json: LogResponse = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Logs')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on mount and when filters/pagination/sort change
  useEffect(() => {
    fetchLogs({ offset, runnerUid: runnerUidFilter, errorsOnly, sortColumn, sortDirection })
  }, [fetchLogs, offset, runnerUidFilter, errorsOnly, sortColumn, sortDirection])

  // BUG-2: debounce UID input, BUG-3: validate numeric
  function handleUidInputChange(value: string) {
    setUidInputValue(value)

    // BUG-3: validate — must be empty or a positive integer
    if (value.trim() !== '' && !/^\d+$/.test(value.trim())) {
      setUidInputError('Nur Zahlen erlaubt')
      return
    }
    setUidInputError(null)

    // BUG-2: debounce — wait 400ms before triggering the API call
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setRunnerUidFilter(value)
      setOffset(0)
    }, 400)
  }

  function handleErrorsOnlyChange(checked: boolean) {
    setErrorsOnly(checked)
    setOffset(0)
  }

  // BUG-1: toggle sort column/direction
  function handleSortClick(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('desc')
    }
    setOffset(0)
  }

  function SortIcon({ column }: { column: SortColumn }) {
    if (sortColumn !== column) return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-40" />
    return sortDirection === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3 inline" />
      : <ArrowDown className="ml-1 h-3 w-3 inline" />
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  // --- Error State ---
  if (error && !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLogs({ offset, runnerUid: runnerUidFilter, errorsOnly, sortColumn, sortDirection })}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Erneut versuchen
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex flex-col gap-1">
          <Input
            type="text"
            inputMode="numeric"
            placeholder="Laeufer-UID filtern..."
            value={uidInputValue}
            onChange={(e) => handleUidInputChange(e.target.value)}
            className={`w-full sm:w-48 ${uidInputError ? 'border-destructive' : ''}`}
            aria-label="Laeufer-UID Filter"
            aria-invalid={!!uidInputError}
          />
          {uidInputError && (
            <span className="text-xs text-destructive">{uidInputError}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="errors-only"
            checked={errorsOnly}
            onCheckedChange={(checked) => handleErrorsOnlyChange(checked === true)}
          />
          <label htmlFor="errors-only" className="text-sm cursor-pointer select-none">
            Nur Fehler anzeigen
          </label>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchLogs({ offset, runnerUid: runnerUidFilter, errorsOnly, sortColumn, sortDirection })}
          className="ml-auto"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Aktualisieren
        </Button>
      </div>

      {/* Loading */}
      {loading && !data && (
        <div className="space-y-3" role="status" aria-label="Logs werden geladen">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-40" />
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {data && (
        <>
          {error && (
            <Alert variant="destructive" className="mb-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {data.logs.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              Keine Log-Eintraege gefunden.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-6 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer select-none whitespace-nowrap"
                      onClick={() => handleSortClick('sent_at')}
                    >
                      Zeitstempel<SortIcon column="sent_at" />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleSortClick('typo3_runner_uid')}
                    >
                      Laeufer-UID<SortIcon column="typo3_runner_uid" />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleSortClick('run_date')}
                    >
                      Laufdatum<SortIcon column="run_date" />
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSortClick('run_distance_km')}
                    >
                      Distanz (km)<SortIcon column="run_distance_km" />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleSortClick('http_status')}
                    >
                      HTTP-Status<SortIcon column="http_status" />
                    </TableHead>
                    <TableHead>Antwort</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((entry) => {
                    const isError = isErrorStatus(entry.http_status)
                    return (
                      <TableRow
                        key={entry.id}
                        className={isError ? 'bg-destructive/5' : ''}
                      >
                        <TableCell className="text-sm whitespace-nowrap tabular-nums">
                          {formatTimestamp(entry.sent_at)}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {entry.typo3_runner_uid}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {formatDate(entry.run_date)}
                        </TableCell>
                        <TableCell className="text-sm text-right tabular-nums">
                          {formatDistance(entry.run_distance_km)}
                        </TableCell>
                        <TableCell>
                          {entry.http_status === null ? (
                            <Badge variant="destructive">Timeout</Badge>
                          ) : isError ? (
                            <Badge variant="destructive">{entry.http_status}</Badge>
                          ) : (
                            <Badge variant="secondary">{entry.http_status}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm max-w-[300px] truncate" title={entry.response_text ?? ''}>
                          {entry.response_text ?? ''}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-muted-foreground">
                {data.total} Eintraege gesamt, Seite {currentPage} von {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Zurueck
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + PAGE_SIZE >= data.total}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  Weiter
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
