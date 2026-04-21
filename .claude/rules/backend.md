---
paths:
  - "src/app/api/**"
  - "src/lib/supabase*"
  - "supabase/**"
---

# Backend Development Rules

## Database (Supabase)
- ALWAYS enable Row Level Security on every table
- Create RLS policies for SELECT, INSERT, UPDATE, DELETE
- Add indexes on columns used in WHERE, ORDER BY, and JOIN clauses
- Use foreign keys with ON DELETE CASCADE where appropriate
- Never skip RLS - security first

## API Routes
- Validate all inputs using Zod schemas before processing
- Always check authentication: verify user session exists
- Return meaningful error messages with appropriate HTTP status codes
- Use `.limit()` on all list queries

## Query Patterns
- Use Supabase joins instead of N+1 query loops
- Use `unstable_cache` from Next.js for rarely-changing data
- Always handle errors from Supabase responses

## TYPO3-API-Integration
- ALWAYS use `withUserLock()` from `src/lib/typo3-mutex.ts` for ALL write operations to TYPO3
- ALWAYS use Read-Modify-Write pattern: fetch current data with `fetchRunnerRuns()`, apply change, write back with `updateRunnerRuns()`
- NEVER let the client send the complete runs array — the server must be authoritative
- Distances sent to TYPO3 MUST use **Komma as decimal separator** (`"8,67"` not `"8.67"`) — see `docs/TYPO3-API-REFERENZ.md`
- Distances read from TYPO3 also use Komma — convert to Punkt for internal processing
- TYPO3 returns HTTP 200 even on failure — do not assume 200 means success
- Refer to `docs/TYPO3-API-REFERENZ.md` for complete endpoint documentation and payload examples

## Security
- Never hardcode secrets in source code
- Use environment variables for all credentials
- Validate and sanitize all user input
- Use parameterized queries (Supabase handles this)
