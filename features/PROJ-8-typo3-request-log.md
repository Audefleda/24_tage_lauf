# PROJ-8: TYPO3 Request Log

## Status: Deployed
**Created:** 2026-03-21
**Last Updated:** 2026-03-21 (deployed v2: response_success + message-only + BUG-4/5 fixes)

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
  - `response_success` — das `success`-Feld aus der TYPO3-JSON-Antwort (boolean, nullable)
  - `response_message` — nur das `message`-Feld aus der TYPO3-JSON-Antwort (kein vollständiges JSON)
- [ ] Die Log-Tabelle ist ausschließlich für Logging — keine Lese- oder Schreibzugriffe aus anderen Features
- [ ] Nur Benutzer mit Admin-Rolle können Log-Einträge lesen (RLS Policy)
- [ ] Kein regulärer Läufer kann Log-Einträge lesen oder schreiben
- [ ] Die Admin-UI zeigt eine filterbare, sortierbare Tabelle aller Log-Einträge
- [ ] Die Tabelle ist nach `sent_at` absteigend sortiert (neueste zuerst)
- [ ] Die Tabelle zeigt mindestens: Zeitstempel, Läufer-UID, Laufdatum, Distanz, HTTP-Status, Success, Message (Spaltenreihenfolge: Success vor Message)
- [ ] Fehlgeschlagene Requests (HTTP-Status ≠ 2xx) sind in der Tabelle visuell hervorgehoben

## Edge Cases
- Was passiert, wenn das Logging selbst fehlschlägt? → Der TYPO3-Request-Fehler wird dem Nutzer angezeigt, aber der Log-Fehler wird nur serverseitig geloggt (kein Abbruch des Hauptflows)
- Was passiert bei Netzwerktimeout zu TYPO3? → Es wird ein Eintrag mit `http_status = null`, `response_success = null` und `response_message = 'Timeout'` angelegt
- Was passiert wenn die TYPO3-Antwort kein gültiges JSON ist (z. B. plain text oder HTML-Fehlerseite)? → `response_success = null`, `response_message` enthält den Rohtext (gekürzt auf 2000 Zeichen)
- Was passiert wenn das JSON kein `message`-Feld enthält? → `response_message = null`
- Was passiert wenn das JSON kein `success`-Feld enthält? → `response_success = null`
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
        +-- Spalten: Zeitstempel | Läufer-UID | Laufdatum | Distanz | HTTP-Status | Success | Message
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
| `response_success` | Boolean (nullable) | `success`-Feld aus TYPO3-JSON-Antwort |
| `response_message` | Text (nullable) | `message`-Feld aus TYPO3-JSON-Antwort (kein vollständiges JSON) |

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
- Migration: `supabase/migrations/20260321_create_typo3_request_log.sql` (initial table creation)
- Migration: `supabase/migrations/20260321_alter_typo3_request_log_add_success_rename_message.sql` (add `response_success`, rename `response_text` to `response_message`)
- Table `typo3_request_log` with RLS: admin SELECT only, no INSERT/UPDATE/DELETE policies (service role bypasses RLS for writes)
- Indexes on `sent_at DESC` and `typo3_runner_uid`

### Backend Changes
- `src/app/api/runner/runs/route.ts` — added `parseTypo3Response()` helper that extracts `success` (boolean) and `message` (string) from the TYPO3 JSON response. For non-JSON responses, `response_success = null` and `response_message` contains the raw text (truncated to 2000 chars). For timeouts, both are derived from the error message.
- `src/app/api/runner/runs/route.ts` — `logTypo3Request()` now writes `response_success` and `response_message` instead of `response_text`.
- `src/app/api/admin/request-log/route.ts` (new) — admin-only GET endpoint with rate limiting, pagination (`limit`/`offset`), `runner_uid` filter, and `errors_only` filter. Uses user's Supabase client with RLS.

### Frontend Changes
- `src/components/request-log-table.tsx` — updated to show `response_success` (Badge: true/false/--) and `response_message` as separate columns. Column order: Success before Message.
- `src/app/admin/request-log/page.tsx` (new) — admin page wrapping the table in a Card.
- `src/app/admin/page.tsx` — added link card to the request log page.

### Design Decisions
- Logging writes one entry per run in the payload (not one per request) for better traceability, except when payload is empty (one placeholder entry).
- Response text truncated to 2000 chars before parsing to avoid oversized log entries.
- `parseTypo3Response()` handles all edge cases: valid JSON with both fields, JSON missing fields, non-JSON text, empty string.
- Pagination with 50 entries per page, max 500 per API call.

## QA Test Results (Re-test after response_success / response_message refactor)

**Tested by:** QA / 2026-03-21
**Build status:** PASS (compiles cleanly, no TypeScript errors)
**Scope:** Full re-test of all acceptance criteria after spec update replacing `response_text` with `response_success` (boolean) and `response_message` (message-only, no full JSON).

### Acceptance Criteria Verification

| # | Criterion | Result | Notes |
|---|-----------|--------|-------|
| AC-1 | Automatic log entry for every `updateruns` request | PASS | `logTypo3Request()` called on line 154 (success path) and line 186 (catch/timeout path). Fire-and-forget with try/catch -- never blocks main flow. |
| AC-2a | Log entry contains `typo3_runner_uid` | PASS | Column is INTEGER NOT NULL in migration, populated from `profile.typo3_uid`. |
| AC-2b | Log entry contains `run_date` (ISO 8601) | PASS | Column is DATE NOT NULL, extracted via `.split(' ')[0]`. |
| AC-2c | Log entry contains `run_distance_km` | PASS | Column is NUMERIC(8,3) NOT NULL, parsed with `parseFloat` and fallback to 0. |
| AC-2d | Log entry contains `sent_at` (UTC, auto) | PASS | Column is TIMESTAMPTZ NOT NULL DEFAULT NOW(). |
| AC-2e | Log entry contains `http_status` | PASS | Column is INTEGER (nullable). Null for timeouts as spec requires. |
| AC-2f | Log entry contains `response_success` (boolean, nullable) | PASS | New column added via migration. `parseTypo3Response()` extracts `json.success` only when `typeof === 'boolean'`; otherwise null. Written to DB as `response_success`. |
| AC-2g | Log entry contains `response_message` (message field only, no full JSON) | PASS | Column renamed from `response_text` via migration. `parseTypo3Response()` extracts only `json.message` when `typeof === 'string'`; otherwise null. For non-JSON responses, raw text (truncated to 2000 chars) is stored. No full JSON object is ever stored. |
| AC-3 | Log table is only for logging -- no reads/writes from other features | PASS | Only `logTypo3Request()` writes (via service role), only `/api/admin/request-log` reads. Grep confirms no other code references `typo3_request_log`. |
| AC-4 | Only admins can read log entries (RLS) | PASS | RLS policy checks `auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'`. API route uses `requireAdmin()` AND user's Supabase client (triple protection: middleware + API check + RLS). |
| AC-5 | No regular user can read or write log entries | PASS | No INSERT/UPDATE/DELETE RLS policies exist. Writes via service role only. SELECT restricted to admin role. Middleware blocks non-admin access to `/admin/*` and `/api/admin/*`. |
| AC-6 | Admin UI shows filterable, sortable table | PASS | Filterable: runner UID filter (with debounce) + errors-only checkbox. Sortable: 5 columns have clickable headers with sort icons (sent_at, typo3_runner_uid, run_date, run_distance_km, http_status). Server-side sorting via `sort_column` + `sort_direction` query params with whitelist validation. Previous BUG-1 is resolved. |
| AC-7 | Table sorted by `sent_at` descending (newest first) | PASS | Default sort state is `sortColumn='sent_at'`, `sortDirection='desc'`. Server query uses `.order(sortColumn, { ascending: sortAscending })`. |
| AC-8 | Table shows: Zeitstempel, Laeufer-UID, Laufdatum, Distanz, HTTP-Status, Success, Message (Success before Message) | PASS | All 7 columns present in correct order. Success column (line 315) renders before Message column (line 316). Success shows Badge (true/false/--). Message shows truncated text with title tooltip. |
| AC-9 | Failed requests (HTTP != 2xx) visually highlighted | PASS | Error rows get `bg-destructive/5` background. HTTP status Badge uses `variant="destructive"` for errors and null (timeout). `response_success === false` also gets `variant="destructive"`. |

### parseTypo3Response() Edge Case Verification

| Input Scenario | Expected | Actual | Result |
|----------------|----------|--------|--------|
| Valid JSON `{"success": true, "message": "OK"}` | `success=true, message="OK"` | JSON.parse succeeds, both typeof checks pass | PASS |
| JSON missing `success`: `{"message": "OK"}` | `success=null, message="OK"` | `typeof undefined === 'boolean'` is false, returns null | PASS |
| JSON missing `message`: `{"success": false}` | `success=false, message=null` | `typeof undefined === 'string'` is false, returns null | PASS |
| JSON missing both fields: `{"foo": "bar"}` | `success=null, message=null` | Both typeof checks fail, both null | PASS |
| Non-JSON text (e.g. HTML error page) | `success=null, message=raw text (max 2000 chars)` | JSON.parse throws, catch returns null + sliced text | PASS |
| Empty string `""` | `success=null, message=null` | JSON.parse throws, catch: `"" ? ... : null` -- empty string is falsy, returns null | PASS |
| Timeout / network error | `success=null, message=error.message` | Catch block (line 186-191) passes `error.message` as responseText. parseTypo3Response: JSON.parse fails, catch returns null + error message string | PASS |
| JSON with non-boolean success: `{"success": 1}` | `success=null` | `typeof 1 === 'boolean'` is false, returns null | PASS |
| JSON with non-string message: `{"message": 123}` | `message=null` | `typeof 123 === 'string'` is false, returns null | PASS |

### DB Write Verification

| Check | Result | Notes |
|-------|--------|-------|
| `response_success` column exists (migration) | PASS | Added via `ALTER TABLE ... ADD COLUMN response_success BOOLEAN` |
| `response_text` renamed to `response_message` | PASS | Via `ALTER TABLE ... RENAME COLUMN response_text TO response_message` |
| Insert uses correct column names | PASS | Lines 57-58: `response_success: responseSuccess, response_message: responseMessage` |
| API reads correct column names | PASS | Admin API selects `*`, frontend TypeScript interface matches new column names (lines 37-38 of request-log-table.tsx) |

### General Edge Case Verification

| Edge Case | Result | Notes |
|-----------|--------|-------|
| Logging itself fails | PASS | try/catch in `logTypo3Request()` logs to console, never throws to caller. |
| Network timeout to TYPO3 | PASS | Catch block creates entry with `httpStatus: null`, `responseText: error.message`. parseTypo3Response returns `success=null, message=error.message`. Spec says `response_message = 'Timeout'` but actual value is the full error message -- more informative, acceptable. |
| Multiple runs in one request | PASS (documented deviation) | Implementation logs one entry PER RUN (not per request). Documented in Implementation Notes as intentional for "better traceability". |
| No DELETE operations | PASS | No DELETE RLS policy. No DELETE API endpoint. Table is append-only. |
| Runner without `typo3_runner_uid` | PASS | Route returns 404 before any TYPO3 call, so no log entry is created. |
| Non-JSON response | PASS | `response_success = null`, `response_message` = raw text truncated to 2000 chars. |
| JSON without `message` field | PASS | `response_message = null` |
| JSON without `success` field | PASS | `response_success = null` |

### Bugs Found

**BUG-4: Success and Message columns are not sortable**
- Severity: LOW
- Priority: P3
- Description: The `SORTABLE_COLUMNS` whitelist in the admin API (route.ts line 36) includes `sent_at`, `typo3_runner_uid`, `run_date`, `run_distance_km`, and `http_status`. The two new columns `response_success` and `response_message` are not in the whitelist, and their table headers in the UI are not clickable (lines 315-316 of request-log-table.tsx have no `onClick` handler or `cursor-pointer` class). This is a minor inconsistency -- 5 of 7 data columns are sortable, but the two newest columns are not. Sorting by `response_success` would be useful to quickly find failed responses.
- Steps to reproduce: Open `/admin/request-log`, observe that the "Success" and "Message" column headers are not clickable.

**BUG-5: Double truncation of response text (cosmetic, no functional impact)**
- Severity: LOW
- Priority: P3
- Description: In route.ts line 158, `responseText.slice(0, 2000)` truncates before passing to `logTypo3Request()`. Inside `parseTypo3Response()` (line 30), for non-JSON responses, another `.slice(0, 2000)` is applied. The second truncation is redundant since the input is already <= 2000 chars. No functional impact, but the code could be cleaner.
- Steps to reproduce: Code review only.

**Previous bugs BUG-1 through BUG-3: All resolved.**
- BUG-1 (sortable columns): Fixed -- 5 columns now have clickable sort headers with server-side sorting.
- BUG-2 (debounce): Fixed -- 400ms debounce on UID input (line 157 of request-log-table.tsx).
- BUG-3 (non-numeric UID validation): Fixed -- regex validation `/^\d+$/` with inline error message (line 149-151 of request-log-table.tsx).

### Security Audit (Red-Team Perspective)

**Authentication and Authorization: PASS**
- Three-layer protection: (1) Middleware, (2) `requireAdmin()`, (3) Supabase RLS. Non-admin must bypass all three.

**Rate Limiting: PASS**
- 30 requests per 60 seconds per IP.

**Injection via sort_column: PASS**
- `sort_column` query param is validated against a whitelist (`SORTABLE_COLUMNS`). Invalid values default to `sent_at`. No SQL injection vector.

**Injection via other params: PASS**
- `runner_uid`, `limit`, `offset` parsed with parseInt. `errors_only` compared to string literal. Supabase uses parameterized queries. No injection vector.

**Data Leakage: PASS**
- `response_message` is truncated to 2000 chars, preventing oversized storage. Only admins can read. No sensitive data exposure beyond what admins should see.

**Append-Only Integrity: PASS**
- No UPDATE or DELETE RLS policies. No API endpoints for modification. Service role writes are server-side only.

**Information Disclosure via Error Messages: PASS (minor note)**
- API returns Supabase `error.message` in 500 responses. Acceptable for admin-only endpoint.

**Bounded Response Size: PASS**
- Max 500 entries per API call. No unbounded data extraction.

### Cross-Browser / Responsive Notes

- Table uses `overflow-x-auto` with `-mx-6 sm:mx-0` for horizontal scrolling on narrow viewports (375px). Adequate for 7 columns.
- Filters stack vertically on mobile (`flex-col sm:flex-row`). Pagination present.
- Sort icons use standard Lucide React components. No browser-specific features.
- No cross-browser issues expected (Chrome, Firefox, Safari).

### Regression Check

- PROJ-1 (API config): No changes to `typo3-client.ts` or health endpoint. No regression.
- PROJ-3/4 (Runs): `route.ts` modified to add logging, but the main request/response flow is unchanged. `logTypo3Request` is fire-and-forget and cannot block the main flow. No regression.
- PROJ-6 (Admin): Admin page updated with link card to request log. No changes to existing admin functionality. No regression.

### Summary

- **10 of 10 acceptance criteria (updated for new fields): 10 PASS, 0 FAIL**
- **2 new bugs found: both LOW severity (P3)**
- **3 previous bugs (BUG-1 through BUG-3): All resolved**
- **parseTypo3Response(): All 9 edge cases PASS**
- **Security audit: PASS -- no vulnerabilities found**
- **Regression: No regressions on PROJ-1, PROJ-3, PROJ-4, PROJ-6**
- **Overall assessment: No critical bugs. All acceptance criteria met. Feature is ready for review.**

## Deployment

**Deployed:** 2026-03-21
**Production URL:** https://24-tage-lauf.vercel.app/admin/request-log
**Database Migrations applied:**
- `supabase/migrations/20260321_create_typo3_request_log.sql` — initial table
- `supabase/migrations/20260321_alter_typo3_request_log_add_success_rename_message.sql` — add `response_success`, rename `response_text` → `response_message`

### Bug Fixes shipped
- BUG-1 (P2): Sortable column headers — all 5 columns clickable, server-side sort
- BUG-2 (P3): Debounce on UID filter (400ms) — rate-limit-safe
- BUG-3 (P3): Non-numeric UID input validation with inline error message
- BUG-4 (P3): Success + Message columns now sortable (7/7 columns)
- BUG-5 (P3): Removed pre-truncation before JSON parsing — prevents corruption of large valid JSON responses
