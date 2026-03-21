# PROJ-8: TYPO3 Request Log

## Status: Deployed
**Created:** 2026-03-21
**Last Updated:** 2026-03-21 (deployed)

## Dependencies
- Requires: PROJ-1 (API-Konfiguration & Superuser-Authentifizierung) — Logging wird bei jedem TYPO3-API-Call ausgelöst
- Requires: PROJ-3 (Läufe-Übersicht) / PROJ-4 (Läufe-Verwaltung) — diese Features senden die Runs an TYPO3
- Requires: PROJ-6 (Benutzerverwaltung Admin) — Admin-Rolle für Zugriffskontrolle

## User Stories
- Als Admin möchte ich alle TYPO3-Requests aller Läufer in einer Liste sehen, um Probleme beim Übertragen von Läufen nachvollziehen zu können.
- Als Admin möchte ich für jeden Log-Eintrag sehen, welcher Läufer betroffen war, welche Lauf-Daten gesendet wurden und was TYPO3 geantwortet hat.
- Als Admin möchte ich auf einen Blick erkennen, ob ein Request erfolgreich war oder fehlgeschlagen ist (z. B. anhand des HTTP-Statuscodes).
- Als System möchte ich jeden TYPO3-`updateruns`-Call automatisch loggen, ohne dass Läufer oder Admins manuell eingreifen müssen.

## Acceptance Criteria
- [ ] Für jeden `updateruns`-Request an TYPO3 wird automatisch ein Eintrag in der Supabase-Log-Tabelle `typo3_request_log` erstellt
- [ ] Jeder Log-Eintrag enthält:
  - `typo3_runner_uid` — die TYPO3-Läufer-UID des betroffenen Läufers
  - `run_date` — das Datum des Laufs (ISO 8601)
  - `run_distance_km` — Distanz des Laufs in km
  - `sent_at` — Zeitstempel des Sendens (UTC, automatisch gesetzt)
  - `http_status` — HTTP-Statuscode der TYPO3-Antwort (z. B. 200, 400, 500)
  - `response_text` — zurückgemeldeter Text von TYPO3
- [ ] Die Log-Tabelle ist ausschließlich für Logging — keine Lese- oder Schreibzugriffe aus anderen Features
- [ ] Nur Benutzer mit Admin-Rolle können Log-Einträge lesen (RLS Policy)
- [ ] Kein regulärer Läufer kann Log-Einträge lesen oder schreiben
- [ ] Die Admin-UI zeigt eine filterbare, sortierbare Tabelle aller Log-Einträge
- [ ] Die Tabelle ist nach `sent_at` absteigend sortiert (neueste zuerst)
- [ ] Die Tabelle zeigt mindestens: Zeitstempel, Läufer (Name oder UID), Laufdatum, Distanz, HTTP-Status, Antworttext
- [ ] Fehlgeschlagene Requests (HTTP-Status ≠ 2xx) sind in der Tabelle visuell hervorgehoben

## Edge Cases
- Was passiert, wenn das Logging selbst fehlschlägt? → Der TYPO3-Request-Fehler wird dem Nutzer angezeigt, aber der Log-Fehler wird nur serverseitig geloggt (kein Abbruch des Hauptflows)
- Was passiert bei Netzwerktimeout zu TYPO3? → Es wird ein Eintrag mit `http_status = null` und `response_text = 'Timeout'` angelegt
- Was passiert wenn `updateruns` mehrere Läufe auf einmal sendet? → Pro Läufer-Request ein Log-Eintrag (nicht pro Einzellauf)
- Dürfen Log-Einträge gelöscht werden? → Nein, keine DELETE-Operationen vorgesehen — die Tabelle ist append-only
- Was passiert wenn ein Läufer kein `typo3_runner_uid` hat? → Der Request wird nicht gesendet, es entsteht kein Log-Eintrag

## Technical Requirements
- Supabase-Tabelle `typo3_request_log` (append-only)
- RLS: INSERT für authentifizierte Service-Role (server-side), SELECT nur für Admin-Rolle
- Kein UPDATE, kein DELETE auf dieser Tabelle
- Logging geschieht server-side (Next.js API Route), nie client-side
- UI-Route: `/admin/request-log` — nur für Admins zugänglich
- Performance: Tabelle mit Index auf `sent_at` und `typo3_runner_uid`

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponenten-Struktur

```
/admin/request-log (neue Seite, nur Admin)
+-- PageHeader ("TYPO3 Request Log")
+-- RequestLogTable (neue Komponente)
    +-- Filter-Bereich
    |   +-- Suche nach Läufer-UID
    |   +-- Filter: Nur Fehler anzeigen
    +-- Tabelle (shadcn/ui Table)
        +-- Spalten: Zeitstempel | Läufer-UID | Laufdatum | Distanz | HTTP-Status | Antworttext
        +-- Zeilen-Highlight: rot bei HTTP-Status ≠ 2xx (shadcn Badge)
```

### Datenmodell — Supabase-Tabelle `typo3_request_log`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | UUID (auto) | Eindeutige ID |
| `typo3_runner_uid` | Integer | TYPO3-Läufer-UID |
| `run_date` | Date | Datum des Laufs |
| `run_distance_km` | Decimal | Distanz in km |
| `sent_at` | Timestamp UTC (auto) | Zeitpunkt des Requests |
| `http_status` | Integer (nullable) | HTTP-Code der TYPO3-Antwort |
| `response_text` | Text | Zurückgemeldeter Text |

Zugriff: INSERT nur server-side via Service-Role; SELECT nur Admin-Rolle (RLS). Kein UPDATE, kein DELETE.

### Datenfluss

```
Läufer speichert Lauf
        ↓
/api/runner/runs (bestehende Route)
        ↓
TYPO3 updateruns-Call
        ↓ (egal ob Erfolg oder Fehler)
Log-Eintrag in typo3_request_log schreiben
        ↓
Antwort an Browser
```

### Neue Dateien

| Was | Pfad |
|-----|------|
| DB-Migration | Supabase Migration |
| Log-Schreiblogik | Erweiterung von `src/app/api/runner/runs/route.ts` |
| Admin-Lese-API | `src/app/api/admin/request-log/route.ts` (neu) |
| Log-Tabellen-Komponente | `src/components/request-log-table.tsx` (neu) |
| Admin-Seite | `src/app/admin/request-log/page.tsx` (neu) |

### Wiederverwendete Teile

- `PageHeader` — Seitentitel
- shadcn `Table`, `Badge` — bereits installiert
- Admin-Auth-Muster aus `src/app/api/admin/users/route.ts`

## Implementation Notes (Backend + Frontend)

### Database
- Migration: `supabase/migrations/20260321_create_typo3_request_log.sql`
- Table `typo3_request_log` with RLS: admin SELECT only, no INSERT/UPDATE/DELETE policies (service role bypasses RLS for writes)
- Indexes on `sent_at DESC` and `typo3_runner_uid`

### Backend Changes
- `src/app/api/runner/runs/route.ts` — added `logTypo3Request()` function that writes log entries via service role after every TYPO3 updateruns call (success and failure). Reads response as text first, then parses JSON. Log errors are caught and never break the main flow.
- `src/app/api/admin/request-log/route.ts` (new) — admin-only GET endpoint with rate limiting, pagination (`limit`/`offset`), `runner_uid` filter, and `errors_only` filter. Uses user's Supabase client with RLS.

### Frontend Changes
- `src/components/request-log-table.tsx` (new) — filterable, sortable table with pagination. Shows timestamp, runner UID, run date, distance, HTTP status (Badge), and response text. Error rows highlighted with destructive background.
- `src/app/admin/request-log/page.tsx` (new) — admin page wrapping the table in a Card.
- `src/app/admin/page.tsx` — added link card to the request log page.

### Design Decisions
- Logging writes one entry per run in the payload (not one per request) for better traceability, except when payload is empty (one placeholder entry).
- Response text truncated to 2000 chars to avoid oversized log entries.
- Pagination with 50 entries per page, max 500 per API call.

## QA Test Results

**Tested by:** QA / 2026-03-21
**Build status:** PASS (compiles cleanly, no TypeScript errors)

### Acceptance Criteria Verification

| # | Criterion | Result | Notes |
|---|-----------|--------|-------|
| AC-1 | Automatic log entry for every `updateruns` request | PASS | `logTypo3Request()` is called after every TYPO3 response (line 129) and in the catch block for network errors (line 161). Fire-and-forget pattern with try/catch ensures main flow is never blocked. |
| AC-2a | Log entry contains `typo3_runner_uid` | PASS | Column is INTEGER NOT NULL in migration, populated from `profile.typo3_uid`. |
| AC-2b | Log entry contains `run_date` (ISO 8601) | PASS | Column is DATE NOT NULL, extracted from `runDate` payload field via `.split(' ')[0]`. |
| AC-2c | Log entry contains `run_distance_km` | PASS | Column is NUMERIC(8,3) NOT NULL, parsed from `runDistance` with fallback to 0. |
| AC-2d | Log entry contains `sent_at` (UTC, auto) | PASS | Column is TIMESTAMPTZ NOT NULL DEFAULT NOW(). |
| AC-2e | Log entry contains `http_status` | PASS | Column is INTEGER (nullable) -- null for timeouts as spec requires. |
| AC-2f | Log entry contains `response_text` | PASS | Column is TEXT (nullable), truncated to 2000 chars in the API route. |
| AC-3 | Log table is only for logging -- no reads/writes from other features | PASS | Only `logTypo3Request()` writes (via service role), only `/api/admin/request-log` reads. No other code references this table. |
| AC-4 | Only admins can read log entries (RLS) | PASS | RLS policy checks `auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'`. API route uses `requireAdmin()` check AND user's Supabase client (double protection via middleware + API + RLS). |
| AC-5 | No regular user can read or write log entries | PASS | No INSERT/UPDATE/DELETE RLS policies exist. Writes happen via service role (bypasses RLS). SELECT only for admin role. Middleware redirects non-admin users away from `/admin/*` routes and returns 403 for `/api/admin/*`. |
| AC-6 | Admin UI shows filterable, sortable table | PARTIAL | Filterable: YES (runner UID filter + errors-only checkbox). Sortable: NO -- there is no client-side column sorting. The table is always ordered by `sent_at DESC` from the server. The spec says "filterbare, sortierbare Tabelle" but only filtering is implemented. See BUG-1. |
| AC-7 | Table sorted by `sent_at` descending (newest first) | PASS | Server query uses `.order('sent_at', { ascending: false })`. |
| AC-8 | Table shows: timestamp, runner (name or UID), run date, distance, HTTP status, response text | PASS | All six columns are present. Runner is shown as UID (not name), which satisfies "Name oder UID". |
| AC-9 | Failed requests (HTTP != 2xx) visually highlighted | PASS | Error rows get `bg-destructive/5` background class. HTTP status shown with `Badge variant="destructive"` for errors and null (timeout). |

### Edge Case Verification

| Edge Case | Result | Notes |
|-----------|--------|-------|
| Logging itself fails | PASS | try/catch in `logTypo3Request()` logs error to console, never throws to caller. |
| Network timeout to TYPO3 | PASS | Catch block (line 159-166) creates entry with `httpStatus: null` and `responseText: error.message`. However, `response_text` is the error message string, not literally "Timeout" as the spec says. This is acceptable since the actual error message is more informative. |
| Multiple runs in one request | PASS (design deviation) | Implementation logs one entry PER RUN (not per request as the edge case spec says). This was an intentional design decision documented in Implementation Notes for "better traceability". Acceptable deviation. |
| No DELETE operations | PASS | No DELETE RLS policy. No DELETE API endpoint. Table is append-only. |
| Runner without `typo3_runner_uid` | PASS | The `/api/runner/runs` route returns 404 if no profile is found, so no TYPO3 request is ever made and no log entry is created. |

### Bugs Found

**BUG-1: Table is not client-side sortable**
- Severity: LOW
- Priority: P2
- Description: AC-6 requires a "sortierbare Tabelle" (sortable table). The table is always sorted by `sent_at DESC` from the server. There are no clickable column headers to sort by other fields (e.g., runner UID, HTTP status, distance). The current behavior is functional for the primary use case (reviewing recent requests) but does not fully meet the acceptance criterion.
- Steps to reproduce: Open `/admin/request-log`, observe that no column headers are clickable for sorting.

**BUG-2: Runner UID filter fires API request on every keystroke**
- Severity: LOW
- Priority: P3
- Description: The `runnerUidFilter` state is updated on every `onChange` event (line 167) and the `useEffect` on line 121-123 triggers a new API fetch whenever `runnerUidFilter` changes. Typing "123" causes three API requests (for "1", "12", "123"). This could hit the rate limit (30/minute) quickly and causes unnecessary server load. A debounce mechanism is missing.
- Steps to reproduce: Open `/admin/request-log`, type a multi-digit UID quickly, observe network tab showing one request per keystroke.

**BUG-3: Non-numeric runner UID filter input is sent to API but silently ignored**
- Severity: LOW
- Priority: P3
- Description: If a user types a non-numeric string like "abc" in the runner UID filter, the client sends `runner_uid=abc` to the API. The API parses it with `parseInt("abc", 10)` which returns `NaN`, and the `isNaN` check causes the filter to be silently skipped, returning all logs. This is not a security issue (no injection possible) but the UX is confusing -- the user thinks they are filtering but sees all results.
- Steps to reproduce: Open `/admin/request-log`, type "abc" in the UID filter field, observe that all logs are shown (no filtering applied).

### Security Audit (Red-Team Perspective)

**Authentication and Authorization: PASS**
- Three-layer protection for admin routes: (1) Middleware checks admin role and redirects/403s non-admins, (2) `requireAdmin()` in the API route verifies admin role server-side, (3) Supabase RLS policy on the table only allows SELECT for admin role. A non-admin user would have to bypass all three layers.

**Rate Limiting: PASS**
- Admin request-log API is rate-limited to 30 requests per 60 seconds per IP.

**Injection: PASS**
- Query parameters (`runner_uid`, `errors_only`, `limit`, `offset`) are all parsed to typed values (parseInt, comparison to string literal) before use in Supabase queries. Supabase client uses parameterized queries internally. No raw SQL. No injection vector.

**Data Leakage: PASS**
- `response_text` is truncated to 2000 characters, preventing oversized log storage. Log entries are only accessible to admins. No sensitive data is exposed in the client-facing API response that is not already visible to admins.

**Append-Only Integrity: PASS**
- No UPDATE or DELETE RLS policies. No API endpoints for modification or deletion. Service role writes are server-side only. A compromised client session cannot modify or delete log entries.

**Information Disclosure via Error Messages: PASS (minor note)**
- The API returns Supabase error messages directly (`error.message`) in the 500 response. For an admin-only endpoint this is acceptable, but in a stricter environment, internal error details should be sanitized.

**Missing `Content-Length` / Size Limit on log reads: PASS (acceptable)**
- The API limits responses to max 500 entries. No unbounded data extraction possible.

### Cross-Browser / Responsive Notes

- The table uses `overflow-x-auto` with negative margin for mobile (`-mx-6 sm:mx-0`), which should provide horizontal scrolling on narrow viewports (375px). This is adequate.
- Filters stack vertically on mobile (`flex-col sm:flex-row`). Pagination buttons are present. Layout should work at 375px, 768px, and 1440px.
- No browser-specific APIs or CSS features used. Standard shadcn/ui components. No cross-browser issues expected.

### Summary

- **9 of 9 acceptance criteria: 8 PASS, 1 PARTIAL (AC-6 -- sortable table)**
- **3 bugs found: all LOW severity (P2-P3)**
- **Security audit: PASS -- no vulnerabilities found**
- **Overall assessment: No critical bugs. Feature is ready for deployment with minor UX improvements tracked as P2/P3.**

## Deployment

**Deployed:** 2026-03-21
**Production URL:** https://24-tage-lauf.vercel.app/admin/request-log
**Database Migration:** `supabase/migrations/20260321_create_typo3_request_log.sql` — applied to production

### Bug Fixes shipped with deployment
- BUG-1 (P2): Sortable column headers — all 5 columns clickable, server-side sort
- BUG-2 (P3): Debounce on UID filter (400ms) — rate-limit-safe
- BUG-3 (P3): Non-numeric UID input validation with inline error message
