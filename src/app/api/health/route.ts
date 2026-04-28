import { NextResponse } from 'next/server'

// TEMPORARY: Absichtlich kaputt für Rollback-Test
export async function GET() {
  return NextResponse.json({ ok: false, error: 'Rollback-Test' }, { status: 500 })
}
