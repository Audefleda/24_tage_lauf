import { NextResponse } from 'next/server'

// TEMPORARY: Rollback-Test #3 — endgültiger Test
export async function GET() {
  return NextResponse.json({ ok: false, error: 'Rollback-Test-3' }, { status: 500 })
}
