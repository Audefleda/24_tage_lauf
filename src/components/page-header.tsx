'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, Check, X, Loader2, Info } from 'lucide-react'
import { toast } from 'sonner'

interface PageHeaderProps {
  runnerName: string
  runnerAge: number | null
  onProfileUpdated: (name: string, age: number | null) => void
}

export function PageHeader({
  runnerName,
  runnerAge,
  onProfileUpdated,
}: PageHeaderProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(runnerName)
  const [age, setAge] = useState(runnerAge !== null ? String(runnerAge) : '')
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [ageError, setAgeError] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Sync state when props change (e.g. after refresh)
  useEffect(() => {
    if (!editing) {
      setName(runnerName)
      setAge(runnerAge !== null ? String(runnerAge) : '')
    }
  }, [runnerName, runnerAge, editing])

  // Focus name input when entering edit mode
  useEffect(() => {
    if (editing && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [editing])

  function startEditing() {
    setName(runnerName)
    setAge(runnerAge !== null && runnerAge > 0 ? String(runnerAge) : '')
    setNameError(null)
    setAgeError(null)
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
    setNameError(null)
    setAgeError(null)
  }

  function validate(): boolean {
    let valid = true

    // Name validation
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError('Name darf nicht leer sein')
      valid = false
    } else if (trimmedName.length > 100) {
      setNameError('Name zu lang (max. 100 Zeichen)')
      valid = false
    } else {
      setNameError(null)
    }

    // Age validation (optional)
    const trimmedAge = age.trim()
    if (trimmedAge === '') {
      setAgeError(null)
    } else {
      const ageNum = Number(trimmedAge)
      if (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120) {
        setAgeError('Alter muss eine Zahl zwischen 1 und 120 sein')
        valid = false
      } else {
        setAgeError(null)
      }
    }

    return valid
  }

  async function handleSave() {
    if (!validate()) return

    setSaving(true)
    const trimmedName = name.trim()
    const parsedAge = age.trim() === '' ? null : Number(age.trim())

    try {
      const resp = await fetch('/api/runner/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, age: parsedAge }),
      })

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(
          body.error ?? `Fehler beim Speichern (HTTP ${resp.status})`
        )
      }

      toast.success('Profil erfolgreich aktualisiert')
      onProfileUpdated(trimmedName, parsedAge)
      setEditing(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Fehler beim Speichern'
      )
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      cancelEditing()
    }
  }

  if (editing) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">Meine Läufe</h1>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1 space-y-1">
            <label
              htmlFor="profile-name"
              className="text-sm text-muted-foreground"
            >
              Name
            </label>
            <Input
              ref={nameInputRef}
              id="profile-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (nameError) setNameError(null)
              }}
              onKeyDown={handleKeyDown}
              disabled={saving}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? 'name-error' : undefined}
              className={nameError ? 'border-destructive' : ''}
              maxLength={100}
            />
            {nameError && (
              <p
                id="name-error"
                className="text-xs text-destructive"
                role="alert"
              >
                {nameError}
              </p>
            )}
          </div>
          <div className="w-full sm:w-24 space-y-1">
            <label
              htmlFor="profile-age"
              className="text-sm text-muted-foreground"
            >
              Alter
            </label>
            <Input
              id="profile-age"
              type="number"
              value={age}
              onChange={(e) => {
                setAge(e.target.value)
                if (ageError) setAgeError(null)
              }}
              onKeyDown={handleKeyDown}
              disabled={saving}
              aria-invalid={!!ageError}
              aria-describedby={ageError ? 'age-error' : undefined}
              className={ageError ? 'border-destructive' : ''}
              min={1}
              max={120}
              placeholder="--"
            />
            {ageError && (
              <p
                id="age-error"
                className="text-xs text-destructive"
                role="alert"
              >
                {ageError}
              </p>
            )}
          </div>
          <div className="flex gap-2 sm:mt-6">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              aria-label="Profil speichern"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="ml-1.5">Speichern</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={cancelEditing}
              disabled={saving}
              aria-label="Bearbeitung abbrechen"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              <span className="ml-1.5">Abbrechen</span>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Meine Läufe</h1>
      <div className="flex items-center gap-2 mt-1">
        <p className="text-sm text-muted-foreground">
          Läufer*in:{' '}
          <span className="font-medium text-foreground">{runnerName}</span>
          {runnerAge !== null && runnerAge > 0 && (
            <span className="text-muted-foreground">
              {' '}
              ({runnerAge} Jahre)
            </span>
          )}
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={startEditing}
          aria-label="Profil bearbeiten"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
      {(!runnerAge || runnerAge === 0) && (
        <p className="flex items-center gap-1 mt-1 text-xs text-muted-foreground/70">
          <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
          Alter noch nicht gesetzt – optional über das Stift-Icon ergänzen
        </p>
      )}
    </div>
  )
}
