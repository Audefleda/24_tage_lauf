import { NextResponse } from 'next/server'
import { checkConnection } from '@/lib/typo3-client'

export async function GET() {
  const result = await checkConnection()
  return NextResponse.json(result, { status: result.ok ? 200 : 503 })
}
