import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase-server'

/**
 * Server-side password update with Zod validation.
 * BUG-5 fix: Validates password requirements on the server side
 * before forwarding to Supabase.
 */

const updatePasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Passwort muss mindestens 8 Zeichen lang sein'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Server-side Zod validation
    const result = updatePasswordSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message ?? 'Ungültige Eingabe' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify the user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      )
    }

    // Update the password
    const { error: updateError } = await supabase.auth.updateUser({
      password: result.data.password,
    })

    if (updateError) {
      if (updateError.message.includes('same password')) {
        return NextResponse.json(
          {
            error:
              'Das neue Passwort darf nicht mit dem alten Passwort übereinstimmen.',
          },
          { status: 422 }
        )
      }
      return NextResponse.json(
        {
          error:
            'Fehler beim Setzen des neuen Passworts. Bitte versuche es erneut oder fordere einen neuen Link an.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Ungültige Anfrage' },
      { status: 400 }
    )
  }
}
