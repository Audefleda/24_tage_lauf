'use client'

import { useState, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Loader2, Check, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  type EventDay,
  formatDistanceDE,
  toTypo3DateStr,
} from '@/lib/event-config'

interface Run {
  runDate: string
  runDistance: string
}

interface RunsTableProps {
  days: EventDay[]
  /** The raw runs array from the API (needed for replace-all updates) */
  allRuns: Run[]
  /** Called after a successful save so the parent can refresh data */
  onRunsUpdated: () => Promise<void>
}

type RowStatus = 'idle' | 'saving' | 'success' | 'error'

interface RowState {
  status: RowStatus
  errorMessage?: string
}

/**
 * Validate a distance input string.
 * Returns the parsed number on success, or an error message string on failure.
 */
function validateDistance(value: string): number | string {
  const trimmed = value.trim()

  // Empty = remove run (distance 0)
  if (trimmed === '') return 0

  // Normalize comma to dot for German input
  const normalized = trimmed.replace(',', '.')

  const num = parseFloat(normalized)
  if (isNaN(num)) return 'Bitte eine gültige Zahl eingeben'
  if (num < 0) return 'Distanz muss 0 oder positiv sein'

  // Check max 3 decimal places
  const parts = normalized.split('.')
  if (parts[1] && parts[1].length > 3) return 'Maximal 3 Nachkommastellen'

  return num
}

export function RunsTable({ days, allRuns, onRunsUpdated }: RunsTableProps) {
  // Track the current input value for each row (index -> value string)
  const [inputValues, setInputValues] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {}
    for (const day of days) {
      initial[day.index] =
        day.distance !== null && day.distance > 0
          ? formatDistanceDE(day.distance)
          : ''
    }
    return initial
  })

  // Track per-row save status
  const [rowStates, setRowStates] = useState<Record<number, RowState>>({})

  // Ref to track the latest allRuns from parent
  const allRunsRef = useRef(allRuns)
  allRunsRef.current = allRuns

  // Optimistic local copy — updated immediately after each save so rapid sequential
  // saves don't overwrite each other (race condition fix)
  const localRunsRef = useRef<Run[]>(allRuns)

  // Clear success indicator after a delay
  const clearSuccessTimeout = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const setRowState = useCallback((index: number, state: RowState) => {
    setRowStates((prev) => ({ ...prev, [index]: state }))

    if (state.status === 'success') {
      // Clear existing timeout for this row
      if (clearSuccessTimeout.current[index]) {
        clearTimeout(clearSuccessTimeout.current[index])
      }
      clearSuccessTimeout.current[index] = setTimeout(() => {
        setRowStates((prev) => {
          if (prev[index]?.status === 'success') {
            return { ...prev, [index]: { status: 'idle' } }
          }
          return prev
        })
      }, 2000)
    }
  }, [])

  const handleInputChange = useCallback((index: number, value: string) => {
    setInputValues((prev) => ({ ...prev, [index]: value }))
    // Clear any error when user starts typing again
    setRowStates((prev) => {
      if (prev[index]?.status === 'error') {
        return { ...prev, [index]: { status: 'idle' } }
      }
      return prev
    })
  }, [])

  const handleBlur = useCallback(
    async (day: EventDay) => {
      const rawValue = inputValues[day.index] ?? ''
      const validationResult = validateDistance(rawValue)

      // Validation failed
      if (typeof validationResult === 'string') {
        setRowState(day.index, {
          status: 'error',
          errorMessage: validationResult,
        })
        return
      }

      const newDistance = validationResult

      // Check if value actually changed
      const currentDistance = day.distance ?? 0
      if (newDistance === currentDistance) {
        // No change, normalize the display
        setInputValues((prev) => ({
          ...prev,
          [day.index]:
            newDistance > 0 ? formatDistanceDE(newDistance) : '',
        }))
        return
      }

      // Save
      setRowState(day.index, { status: 'saving' })

      try {
        const typo3Date = toTypo3DateStr(day.date)
        const targetDatePart = typo3Date.split(' ')[0]

        // Build updated runs array using the optimistic local copy so rapid
        // sequential saves don't overwrite each other
        const updatedRuns = localRunsRef.current
          .filter((r) => r.runDate.split(' ')[0] !== targetDatePart)
          .concat(
            newDistance > 0
              ? [{ runDate: typo3Date, runDistance: newDistance.toString() }]
              : []
          )
          .sort((a, b) =>
            (a.runDate.split(' ')[0] ?? '').localeCompare(b.runDate.split(' ')[0] ?? '')
          )

        // Optimistically update local copy so the next save builds on this result
        localRunsRef.current = updatedRuns

        // PROJ-19: Signal new/updated run to trigger Teams notification
        const requestBody: Record<string, unknown> = { runs: updatedRuns }
        if (newDistance > 0) {
          requestBody.notifyRun = { runDate: typo3Date, runDistance: newDistance.toString() }
        }

        const resp = await fetch('/api/runner/runs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })

        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}))
          throw new Error(body.error ?? 'Fehler beim Speichern')
        }

        setRowState(day.index, { status: 'success' })
        toast.success(
          newDistance > 0 ? 'Lauf gespeichert' : 'Lauf entfernt'
        )

        // Normalize the input display
        setInputValues((prev) => ({
          ...prev,
          [day.index]:
            newDistance > 0 ? formatDistanceDE(newDistance) : '',
        }))

        // Refresh parent data (updates stats and allRuns); sync local copy after
        await onRunsUpdated()
        localRunsRef.current = allRunsRef.current
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Fehler beim Speichern'
        setRowState(day.index, { status: 'error', errorMessage: message })
        toast.error(message)

        // Revert optimistic update on failure
        localRunsRef.current = allRunsRef.current

        // Restore original value
        setInputValues((prev) => ({
          ...prev,
          [day.index]:
            day.distance !== null && day.distance > 0
              ? formatDistanceDE(day.distance)
              : '',
        }))
      }
    },
    [inputValues, onRunsUpdated, setRowState]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.currentTarget.blur()
      }
      if (e.key === 'Escape') {
        // Restore original value and blur
        const index = Number(e.currentTarget.dataset.index)
        const day = days.find((d) => d.index === index)
        if (day) {
          setInputValues((prev) => ({
            ...prev,
            [day.index]:
              day.distance !== null && day.distance > 0
                ? formatDistanceDE(day.distance)
                : '',
          }))
        }
        e.currentTarget.blur()
      }
    },
    [days]
  )

  // Group days into weeks of 7 (Mon–Sun), week starts Monday
  const weeks: EventDay[][] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }

  const renderDay = (day: EventDay) => {
    const rowState = rowStates[day.index] ?? { status: 'idle' }
    const isSaving = rowState.status === 'saving'
    const hasError = rowState.status === 'error'
    const isSuccess = rowState.status === 'success'
    const hasRun = day.distance !== null && day.distance > 0

    // Show "DD.MM." without year — year is identical for all days (2026)
    const shortDate = day.formattedDate.slice(0, 6)

    return (
      <div
        key={day.index}
        className={`py-1.5 px-3 rounded text-sm ${
          isSaving ? 'opacity-60' : hasError ? 'bg-destructive/5' : ''
        } ${!hasRun && !isSaving ? 'text-muted-foreground' : ''}`}
      >
        <div className="flex items-center gap-2">
          <span className="w-5 shrink-0 font-medium">{day.weekday}</span>
          <span className="w-12 shrink-0 tabular-nums">{shortDate}</span>
          <Input
            type="text"
            inputMode="decimal"
            className="flex-1 min-w-0 text-right h-7 text-sm px-2"
            placeholder="--"
            value={inputValues[day.index] ?? ''}
            onChange={(e) => handleInputChange(day.index, e.target.value)}
            onBlur={() => handleBlur(day)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            data-index={day.index}
            aria-label={`Distanz für ${day.weekday}, ${day.formattedDate}`}
          />
          <span className="w-4 shrink-0 flex items-center justify-center">
            {isSaving && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Speichert..." />
            )}
            {isSuccess && (
              <Check className="h-3.5 w-3.5 text-green-600" aria-label="Gespeichert" />
            )}
            {hasError && (
              <AlertCircle className="h-3.5 w-3.5 text-destructive" aria-label="Fehler" />
            )}
          </span>
        </div>
        {hasError && rowState.errorMessage && (
          <p className="text-xs text-destructive mt-0.5 pl-[68px]">
            {rowState.errorMessage}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {weeks.map((week, wi) => {
        const first = week[0]
        const last = week[week.length - 1]
        const weekLabel = `${first.formattedDate} – ${last.formattedDate}`
        return (
          <div key={wi} className="rounded-none border">
            <div className="px-3 py-2 border-b bg-muted/50">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Woche {wi + 1}
              </p>
              <p className="text-xs text-muted-foreground">{weekLabel}</p>
            </div>
            <div className="p-1 divide-y">
              {week.map(renderDay)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
