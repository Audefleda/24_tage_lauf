// GET /api/admin/request-log — Read TYPO3 request log (admin only)
// PROJ-8: TYPO3 Request Log

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  // Rate limiting: 30 requests per 60 seconds per IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`admin-request-log:${ip}`, { limit: 30, windowSeconds: 60 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Anfragen. Bitte warten.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetIn) } }
    )
  }

  // Admin check
  const check = await requireAdmin()
  if (!check.authorized) {
    return NextResponse.json({ error: check.message }, { status: check.status })
  }

  // Parse query parameters for filtering
  const { searchParams } = new URL(request.url)
  const runnerUid = searchParams.get('runner_uid')
  const errorsOnly = searchParams.get('errors_only') === 'true'
  const limitParam = parseInt(searchParams.get('limit') ?? '100', 10)
  const limit = Math.min(Math.max(limitParam, 1), 500)
  const offsetParam = parseInt(searchParams.get('offset') ?? '0', 10)
  const offset = Math.max(offsetParam, 0)

  // Sorting — whitelist allowed columns
  const SORTABLE_COLUMNS = ['sent_at', 'typo3_runner_uid', 'run_date', 'run_distance_km', 'http_status', 'response_success', 'response_message'] as const
  type SortColumn = typeof SORTABLE_COLUMNS[number]
  const sortColumnParam = searchParams.get('sort_column') ?? 'sent_at'
  const sortColumn: SortColumn = (SORTABLE_COLUMNS as readonly string[]).includes(sortColumnParam)
    ? sortColumnParam as SortColumn
    : 'sent_at'
  const sortAscending = searchParams.get('sort_direction') === 'asc'

  // Use the user's Supabase client (RLS ensures admin-only access)
  const supabase = await createClient()

  let query = supabase
    .from('typo3_request_log')
    .select('*', { count: 'exact' })
    .order(sortColumn, { ascending: sortAscending })
    .range(offset, offset + limit - 1)

  if (runnerUid) {
    const uid = parseInt(runnerUid, 10)
    if (!isNaN(uid)) {
      query = query.eq('typo3_runner_uid', uid)
    }
  }

  if (errorsOnly) {
    // Show entries where http_status is null (timeout), not 2xx, or response_success is false
    query = query.or('http_status.is.null,http_status.lt.200,http_status.gte.300,response_success.eq.false')
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json(
      { error: `Fehler beim Laden der Logs: ${error.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    logs: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  })
}
