'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'

const runFormSchema = z.object({
  runDistance: z
    .string()
    .min(1, 'Bitte eine Distanz eingeben')
    .refine(
      (val) => {
        const num = parseFloat(val.replace(',', '.'))
        return !isNaN(num) && num >= 0
      },
      { message: 'Distanz muss 0 oder eine positive Zahl sein' }
    )
    .refine(
      (val) => {
        const normalized = val.replace(',', '.')
        const parts = normalized.split('.')
        return !parts[1] || parts[1].length <= 3
      },
      { message: 'Maximal 3 Nachkommastellen' }
    ),
})

type RunFormValues = z.infer<typeof runFormSchema>

interface RunFormProps {
  /** The date label to display (not editable), e.g. "Mo, 20.04.2026" */
  dateLabel: string
  /** Pre-filled distance value (as string, e.g. "5.5" or "0") */
  defaultDistance: string
  /** Called on form submit with the distance as a number string (dot-separated) */
  onSubmit: (distance: string) => Promise<void>
  /** Called when user clicks cancel */
  onCancel: () => void
}

export function RunForm({
  dateLabel,
  defaultDistance,
  onSubmit,
  onCancel,
}: RunFormProps) {
  const [apiError, setApiError] = useState<string | null>(null)

  // Convert default distance for display (dot -> comma for German locale)
  const displayDefault =
    defaultDistance && parseFloat(defaultDistance) > 0
      ? defaultDistance.replace('.', ',')
      : ''

  const form = useForm<RunFormValues>({
    resolver: zodResolver(runFormSchema),
    defaultValues: {
      runDistance: displayDefault,
    },
  })

  const isSubmitting = form.formState.isSubmitting

  async function handleSubmit(values: RunFormValues) {
    setApiError(null)
    try {
      const distance = parseFloat(values.runDistance.replace(',', '.'))
      await onSubmit(distance.toString())
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : 'Fehler beim Speichern'
      )
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-6"
        noValidate
      >
        {apiError && (
          <Alert variant="destructive">
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">Datum</p>
          <p className="text-base font-semibold">{dateLabel}</p>
        </div>

        <FormField
          control={form.control}
          name="runDistance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Distanz (km)</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="z.B. 5,5 (0 = kein Lauf)"
                  {...field}
                  aria-label="Distanz in Kilometern"
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                0 eingeben um den Lauf für diesen Tag zu entfernen.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3 pt-2">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 sm:flex-none"
          >
            {isSubmitting && (
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            )}
            {isSubmitting ? 'Speichern...' : 'Speichern'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Abbrechen
          </Button>
        </div>
      </form>
    </Form>
  )
}
