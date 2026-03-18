# PROJ-3: Läufe-Übersicht

## Status: In Review
**Created:** 2026-03-17
**Last Updated:** 2026-03-17

## Frontend Implementation Notes (Redesign 2026-03-17)
- **Redesign:** Switched from showing only logged runs to showing ALL 25 event days (20.04.2026--14.05.2026) as a calendar list
- `src/lib/event-config.ts` -- Shared event constants (EVENT_START, EVENT_END, 25 days) and helper functions (buildEventDays, date formatting, index<->date mapping)
- `src/app/runs/page.tsx` -- Client page with loading/error/success states; builds 25-day event calendar from TYPO3 runs array using buildEventDays()
- `src/components/page-header.tsx` -- Runner name display only (removed "Neuen Lauf eintragen" button)
- `src/components/stats-card.tsx` -- Two cards: total distance + Lauftage (days with distance > 0)
- `src/components/runs-table.tsx` -- shadcn/ui Table showing all 25 event days; days without runs are visually dimmed (text-muted-foreground); each row has Edit button linking to /runs/[index]/edit
- `src/components/delete-run-dialog.tsx` -- REMOVED (no longer needed; 0 km = delete)
- `src/app/api/runner/route.ts` -- GET endpoint unchanged
- `src/app/api/runner/runs/route.ts` -- PUT endpoint unchanged
- No "empty state" card needed -- all 25 days always visible even with 0 runs

## Dependencies
- Requires: PROJ-1 (API-Konfiguration & Superuser-Authentifizierung)
- Requires: PROJ-2 (Anmeldung — Supabase Auth, liefert TYPO3-UID des eingeloggten Läufers)

## User Stories
- Als Läufer möchte ich alle Tage des Events (20.04.2026–14.05.2026) als Liste sehen, damit ich auf einen Blick erkenne, an welchen Tagen ich gelaufen bin.
- Als Läufer möchte ich bei jedem Tag den Wochentag sehen, damit ich die Liste leichter lesen kann.
- Als Läufer möchte ich bei jedem Tag die eingetragene Distanz sehen (oder eine leere Zelle wenn kein Lauf eingetragen wurde).
- Als Läufer möchte ich eine Gesamtstatistik sehen (Gesamtdistanz, Anzahl Lauftage), damit ich meinen Fortschritt erkenne.
- Als Läufer möchte ich direkt aus der Übersicht heraus jeden Tag bearbeiten können.

## Acceptance Criteria
- [ ] Die Übersicht zeigt **alle 25 Tage** des Events (20.04.2026–14.05.2026) als Liste, aufsteigend nach Datum
- [ ] Jede Zeile zeigt: Wochentag (z.B. "Mo"), Datum (z.B. "20.04.2026"), Distanz (z.B. "5,50 km") — oder leer wenn kein Lauf eingetragen
- [ ] Zeilen ohne Laufeintrag (0 km oder nicht vorhanden) werden visuell unterschieden (z.B. gedimmt)
- [ ] Eine Gesamtstatistik wird angezeigt: Summe der Distanzen, Anzahl Lauftage (Tage mit Distanz > 0)
- [ ] Jede Zeile hat einen Edit-Button (führt zu PROJ-4 Bearbeitungsformular)
- [ ] Kein "Neuen Lauf hinzufügen"-Button — alle Tage sind immer sichtbar und bearbeitbar
- [ ] Ladezustand wird während des API-Calls angezeigt
- [ ] Fehlerfall (API nicht erreichbar) zeigt Fehlermeldung mit Retry-Button
- [ ] Der Name des eingeloggten Läufers ist sichtbar

## Edge Cases
- Was passiert wenn der Läufer noch keine Läufe eingetragen hat? → Alle 25 Tage werden trotzdem gezeigt, Distanzspalte leer
- Was passiert wenn die API-Abfrage fehlschlägt? → Fehlermeldung mit Retry-Button
- Was passiert mit Läufen außerhalb des Event-Zeitraums (z.B. aus früheren Events)? → Werden nicht angezeigt, aber auch nicht gelöscht

## Technical Requirements
- Daten werden frisch von der API geladen (kein persistentes Caching)
- Nach CRUD-Operationen (PROJ-4) wird die Liste automatisch aktualisiert
- shadcn/ui Table oder Card-Liste für die Darstellung

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

**Seite:** `/runs` — geschützt: Redirect zu `/select` wenn kein Läufer im Context

**Woher kommen die Läufe:**
Die Läufe sind bereits im `runs`-Array des Runner-Objekts enthalten, das beim Laden der Läuferliste (`runnerget.json`) mitgeliefert wird. Kein separater API-Aufruf nötig — die Daten kommen aus dem React Context.

**Lauf-Datenstruktur (von der API):**
```
runDate      — Datum + Uhrzeit als String: "2026-03-17 06:00:00"
runDistance  — Distanz als String: "5.5"  (in km)
```
*Hinweis: Keine individuelle Lauf-ID — Läufe werden per Array-Index identifiziert.*

**Datenfluss:**
1. Page liest Läufer + Runs aus dem React Context (bereits beim Login geladen)
2. Zeigt Tabelle + Stats — kein API-Call nötig für die reine Anzeige
3. Nach CRUD-Operationen (PROJ-4): Context wird mit frischen Daten aus `runnerget.json` aktualisiert

**Darstellung:**
- Datum: aus `"2026-03-17 06:00:00"` → formatiert als `"17.03.2026"`
- Distanz: aus `"5.5"` → formatiert als `"5,50 km"`
- Gesamtdistanz: Summe aller `runDistance`-Werte

**Komponenten:**
- `src/app/runs/page.tsx` — Client Page (braucht Context-Zugriff)
- `src/components/runs-table.tsx` — shadcn/ui `Table` mit Datum, Distanz, Index-basierten Aktionen
- `src/components/stats-card.tsx` — shadcn/ui `Card` mit Gesamtdistanz + Anzahl Läufe
- `src/components/delete-run-dialog.tsx` — shadcn/ui `AlertDialog` für Lösch-Bestätigung
- `src/components/page-header.tsx` — Läufername + "Läufer wechseln"-Link

## QA Test Results

**Tested:** 2026-03-18
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Static code analysis + build verification (network requests blocked by sandbox)

### Acceptance Criteria Status

#### AC-1: Die Uebersicht zeigt alle 25 Tage des Events (20.04.2026-14.05.2026) als Liste, aufsteigend nach Datum
- [x] `buildEventDays()` in `event-config.ts` generates exactly 25 days (index 0..24) starting from EVENT_START (2026-04-20)
- [x] Days are generated sequentially via `date.setDate(date.getDate() + index)`, so ascending order is guaranteed
- [x] `runs/page.tsx` calls `buildEventDays(data.runs)` and passes all days to `RunsTable`
- **PASS**

#### AC-2: Jede Zeile zeigt Wochentag, Datum, Distanz -- oder leer wenn kein Lauf
- [x] Weekday shown via `day.weekday` (e.g. "Mo", "Di") -- generated by `getWeekdayShort()`
- [x] Date shown via `day.formattedDate` sliced to "DD.MM." (year omitted for compactness)
- [ ] BUG: Acceptance criterion says format "20.04.2026" (with year), but implementation shows only "DD.MM." without year (line 257: `shortDate = day.formattedDate.slice(0, 6)`)
- [x] Distance shown via pre-filled input value using `formatDistanceDE()` which formats as "5,50"
- [ ] BUG: Distance is shown without "km" suffix in the input field. AC says "5,50 km" but actual display is just "5,50" in an editable input. This is a design choice from the PROJ-4 redesign (inline editing), but diverges from AC-2 wording.
- [x] Empty when no run -- input shows placeholder "--"
- **PARTIAL PASS** (2 minor deviations from AC text, both intentional design choices)

#### AC-3: Zeilen ohne Laufeintrag werden visuell unterschieden (gedimmt)
- [x] Lines without runs get `text-muted-foreground` CSS class (line 264 in runs-table.tsx: `!hasRun && !isSaving ? 'text-muted-foreground' : ''`)
- **PASS**

#### AC-4: Gesamtstatistik: Summe der Distanzen, Anzahl Lauftage
- [x] `totalDistance` computed as sum of all `day.distance` values in `runs/page.tsx`
- [x] `runDays` counts days where `distance !== null && distance > 0`
- [x] `StatsCard` displays both: "Gesamtdistanz" with formatted km, "Lauftage" as count
- **PASS**

#### AC-5: Jede Zeile hat einen Edit-Button (fuehrt zu PROJ-4 Bearbeitungsformular)
- [x] Redesigned: instead of an Edit button, each row has an inline editable input field (PROJ-4 redesign)
- [x] This is a design improvement over the original AC -- editing is now direct, not via navigation
- **PASS** (redesign supersedes original AC)

#### AC-6: Kein "Neuen Lauf hinzufuegen"-Button
- [x] No "add run" button exists in the page or header components
- [x] `page-header.tsx` shows only runner name, no action buttons
- **PASS**

#### AC-7: Ladezustand wird waehrend des API-Calls angezeigt
- [x] `runs/page.tsx` shows Skeleton placeholders during loading state (lines 73-85)
- [x] Three skeletons: header area, two stats cards, and main table area
- **PASS**

#### AC-8: Fehlerfall zeigt Fehlermeldung mit Retry-Button
- [x] Error state renders `AlertCircle` icon + `Alert` with error message (lines 89-104)
- [x] "Erneut versuchen" button calls `fetchRunner()` to retry
- **PASS**

#### AC-9: Der Name des eingeloggten Laeufers ist sichtbar
- [x] `PageHeader` receives `runnerName` from API data and displays it as "Laeufer: {name}"
- **PASS**

### Edge Cases Status

#### EC-1: Laeufer hat noch keine Laeufe eingetragen
- [x] `buildEventDays()` returns all 25 days with `distance: null` when runs array is empty
- [x] All 25 rows render with empty input fields (placeholder "--")
- **PASS**

#### EC-2: API-Abfrage schlaegt fehl
- [x] Error is caught in `fetchRunner()`, error message extracted and displayed
- [x] Retry button available
- **PASS**

#### EC-3: Laeufe ausserhalb des Event-Zeitraums
- [x] `buildEventDays()` only maps runs to days within the event range via date matching
- [x] Runs outside 20.04-14.05 simply don't match any event day key, so they are ignored in display
- [x] The raw `allRuns` array (passed to RunsTable for CRUD) still contains out-of-range runs, preserving them
- [ ] BUG: When saving via inline edit, `runs-table.tsx` line 171 filters runs: `filteredRuns.filter(r => getIndexForDateStr(r.runDate) >= 0)` -- this REMOVES runs outside the event range before sending to TYPO3. The AC says "Werden nicht angezeigt, aber auch nicht geloescht" (not displayed, but also not deleted). This filter actively deletes out-of-range runs on every save.
- **FAIL** (see BUG-1)

### Security Audit Results
- [x] Authentication: Middleware redirects unauthenticated users to /login for all /runs routes
- [x] Authentication: API endpoints (`/api/runner`, `/api/runner/runs`) verify Supabase session server-side
- [x] Authorization: `typo3_uid` is read server-side from `runner_profiles` table, never from client request
- [x] Authorization: Client can only send run data (distances), not UIDs
- [x] Input validation (XSS): No `dangerouslySetInnerHTML` or `innerHTML` usage anywhere. React escapes all rendered values.
- [x] TYPO3 credentials: Stored server-side only, no `NEXT_PUBLIC_` prefix on TYPO3 vars
- [ ] BUG: No server-side Zod validation of the `runs` array in `/api/runner/runs/route.ts`. The tech spec says "Validierung (Zod-Schema)" but the PUT endpoint only checks `Array.isArray(runs)` without validating individual run objects (runDate format, runDistance as valid number). Malformed data could be passed through to TYPO3.
- [ ] BUG: No rate limiting on `/api/runner/runs` PUT endpoint. A user could spam save requests rapidly.
- [x] Security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy configured in next.config.ts
- [ ] BUG: `X-Frame-Options` is set to `SAMEORIGIN` in next.config.ts but security rules say it should be `DENY`. Also `Strict-Transport-Security` header is missing from next.config.ts (documented in security-headers.md but not implemented).

### Cross-Browser / Responsive Notes
- Static analysis only (no browser testing possible in sandbox). Layout uses Tailwind responsive classes:
  - `grid-cols-1 md:grid-cols-2 xl:grid-cols-4` for week cards -- should adapt well to mobile/tablet/desktop
  - `grid-cols-2` for stats cards -- on very narrow screens (375px) the two stats cards may be cramped
  - Input fields use `flex-1 min-w-0` which should collapse gracefully

### Bugs Found

#### BUG-1: Out-of-range runs are deleted on save (Data Loss)
- **Severity:** High
- **Steps to Reproduce:**
  1. A runner has runs from a previous event (dates outside 20.04-14.05.2026) in their TYPO3 data
  2. The runner edits any single day's distance in the inline editor
  3. On save, `runs-table.tsx` line 171 filters: `filteredRuns.filter(r => getIndexForDateStr(r.runDate) >= 0)`
  4. Expected: Only the edited day changes; out-of-range runs are preserved
  5. Actual: All runs outside the event range are silently removed from the array sent to TYPO3
- **Priority:** Fix before deployment

#### BUG-2: No server-side Zod validation on runs array
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Send PUT /api/runner/runs with body `{"runs": [{"runDate": "not-a-date", "runDistance": "abc"}]}`
  2. Expected: Server rejects with 400 and validation error
  3. Actual: Server passes malformed data directly to TYPO3 API (only checks `Array.isArray(runs)`)
- **Priority:** Fix before deployment

#### BUG-3: Missing Strict-Transport-Security header
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Check response headers from next.config.ts
  2. Expected: `Strict-Transport-Security: max-age=31536000; includeSubDomains` present
  3. Actual: Header is not configured in next.config.ts (only documented in security-headers.md)
- **Priority:** Fix before deployment

#### BUG-4: X-Frame-Options is SAMEORIGIN instead of DENY
- **Severity:** Low
- **Steps to Reproduce:**
  1. Check next.config.ts line 10
  2. Expected: `X-Frame-Options: DENY` (per security rules)
  3. Actual: `X-Frame-Options: SAMEORIGIN`
- **Priority:** Fix in next sprint

#### BUG-5: No rate limiting on PUT /api/runner/runs
- **Severity:** Low
- **Steps to Reproduce:**
  1. Rapidly blur/save inline inputs in succession
  2. Expected: Rate limiting prevents excessive TYPO3 API calls
  3. Actual: Every blur triggers an immediate PUT request with no throttle/debounce
- **Priority:** Fix in next sprint (consider client-side debounce at minimum)

#### BUG-6: Date format deviates from AC (no year shown)
- **Severity:** Low
- **Steps to Reproduce:**
  1. View the runs table
  2. Expected per AC: Date shown as "20.04.2026"
  3. Actual: Date shown as "20.04." (year truncated at line 257 of runs-table.tsx)
- **Priority:** Nice to have (design choice -- year is redundant since all days are in 2026)

#### BUG-7: StatsCard layout may be cramped on 375px mobile
- **Severity:** Low
- **Steps to Reproduce:**
  1. View /runs on a 375px-wide viewport
  2. The `grid-cols-2 gap-4` layout for stats cards may not have enough horizontal space
  3. Expected: Cards stack vertically on very small screens
  4. Actual: Cards forced side-by-side (no `sm:` breakpoint, always 2 columns)
- **Priority:** Nice to have

### Summary
- **Acceptance Criteria:** 8/9 passed (1 partial pass on AC-2 due to design deviation)
- **Bugs Found:** 7 total (0 critical, 1 high, 2 medium, 4 low)
- **Security:** 2 issues found (missing Zod validation, missing HSTS header)
- **Production Ready:** NO
- **Recommendation:** Fix BUG-1 (data loss on save) and BUG-2 (server-side validation) before deployment. BUG-3 (HSTS) should also be addressed for production.

## Deployment
_To be added by /deploy_
