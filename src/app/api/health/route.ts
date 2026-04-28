import { NextResponse } from 'next/server'

// TEMPORARY: Rollback-Test #2
export async function GET() {
  return NextResponse.json({ ok: false, error: 'Rollback-Test-2' }, { status: 500 })
}
