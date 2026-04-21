# PROJ-4: Läufe-Verwaltung (CRUD)

## Status: Deployed
**Created:** 2026-03-17
**Last Updated:** 2026-03-17

### Frontend Implementation Notes (Inline-Edit Redesign 2026-03-17)
- **Inline editing:** Distance column in runs-table.tsx is now an editable `<Input>` per row (no separate edit screen)
- **Auto-save on blur:** When the user leaves an input field, the value is validated and saved via PUT /api/runner/runs
- **Per-row feedback:** Each row shows spinner (saving), green check (success, 2s), or red error icon + message (error)
- **Toast notifications:** Sonner toast on success ("Lauf gespeichert" / "Lauf entfernt") and error
- **Validation:** Client-side: empty/0 = remove run, positive decimal with max 3 decimal places, German comma input supported
- **Error recovery:** On save failure, the original value is restored in the input
- **Keyboard support:** Enter triggers blur (save), Escape restores original value and blurs
- **Stats refresh:** After successful save, parent page silently re-fetches data to update StatsCard
- **Removed separate edit page:** `/runs/[index]/edit` now redirects to `/runs`; `/runs/new` was already a redirect
- **run-form.tsx:** No longer used by any page (kept for reference but could be deleted)
- **Files changed:** `src/components/runs-table.tsx`, `src/app/runs/page.tsx`, `src/app/runs/[index]/edit/page.tsx`

## Dependencies
- Requires: PROJ-1 (API-Konfiguration & Superuser-Authentifizierung)
- Requires: PROJ-2 (Läufer-Auswahl)
- Requires: PROJ-3 (Läufe-Übersicht)

## Debug-Logging (PROJ-12)
Bei aktiviertem `LOG_LEVEL=debug` werden folgende Ausgaben erzeugt:
- PUT-Anfrage an TYPO3 gestartet (Runner-UID, Anzahl Läufe)
- HTTP-Status der TYPO3-Antwort
- TYPO3-Antwort-Body (vollständig)

## User Stories
- Als Läufer möchte ich die Distanz direkt in der Tabellenzeile eingeben können, ohne einen separaten Screen aufrufen zu müssen.
- Als Läufer möchte ich, dass meine Eingabe automatisch gespeichert wird wenn ich das Feld verlasse, damit ich nicht aktiv auf "Speichern" klicken muss.
- Als Läufer möchte ich sofort visuelles Feedback sehen ob das Speichern erfolgreich war oder fehlgeschlagen ist.
- Als Läufer möchte ich einen Lauf löschen können, indem ich 0 oder leer einträgt — kein separater Löschvorgang nötig.

## Acceptance Criteria
- [ ] Jede Zeile der Eventliste enthält ein direkt editierbares Distanzfeld (kein separater Edit-Screen)
- [ ] Das Distanzfeld ist vorausgefüllt mit der aktuellen Distanz (leer wenn kein Lauf eingetragen)
- [ ] Beim Verlassen des Feldes (onBlur) wird automatisch gespeichert — kein "Speichern"-Button nötig
- [ ] Während des Speicherns zeigt die Zeile einen Ladezustand (z.B. Spinner oder gedimmte Zeile)
- [ ] Bei erfolgreichem Speichern: kurze Erfolgsanzeige (z.B. grüner Haken, Toast)
- [ ] Bei Fehler (z.B. TYPO3 lehnt ab): Fehlermeldung direkt in/unter der Zeile, Wert wird zurückgesetzt
- [ ] Validierung: Distanz muss leer, 0 oder eine positive Dezimalzahl sein
- [ ] Leer oder 0 eintragen entfernt den Lauf effektiv (kein separater "Löschen"-Button)
- [ ] Kein separater Edit-Screen mehr — `/runs/[index]/edit` entfällt
- [ ] **Datenisolation (Sicherheit):** Die `typo3_uid` des Läufers wird ausschließlich serverseitig aus dem Supabase-Profil des eingeloggten Nutzers gelesen — niemals vom Client übernommen
- [ ] **Nur eigene Läufe:** Das an TYPO3 übertragene Runs-Array enthält ausschließlich die Läufe des aktuell eingeloggten Läufers — niemals Daten anderer Läufer

## Edge Cases
- Was passiert wenn der Nutzer schnell mehrere Felder hintereinander verlässt? → Speicherungen laufen sequenziell oder das letzte gewinnt (kein Race Condition-Problem, da TYPO3 immer das komplette Array ersetzt)
- Was passiert bei ungültigem Wert (z.B. Buchstaben)? → Validierung verhindert Speichern, Fehlermeldung in der Zeile
- Was passiert bei Netzwerkfehler? → Fehlermeldung in der Zeile, alter Wert wird wiederhergestellt
- Was passiert wenn TYPO3 `success: false` zurückgibt? → Fehlermeldung aus `message`-Feld wird angezeigt, alter Wert wiederhergestellt
- Was passiert wenn ein Nutzer keine `typo3_uid` im Profil hat? → Schreiboperation wird blockiert, Fehlermeldung "Kein Läufer zugeordnet"

## Edge Cases
- Was passiert bei Netzwerkfehler während des Speicherns? → Fehlermeldung, Daten bleiben im Formular
- Was passiert, wenn die API einen Validierungsfehler zurückgibt? → API-Fehlermeldung wird angezeigt
- Was passiert bei 0 km? → Eintrag wird aus dem TYPO3-Array entfernt (oder als 0 gespeichert, je nach API-Verhalten)
- Was passiert, wenn ein Nutzer keine `typo3_uid` im Profil hat? → Schreiboperation wird blockiert, Fehlermeldung "Kein Läufer zugeordnet"
- Was passiert, wenn der Client eine fremde UID mitschickt? → Server ignoriert sie, verwendet immer die UID aus dem Supabase-Session-Profil
- Was passiert, wenn jemand per URL einen Index außerhalb des Event-Zeitraums aufruft? → 404 oder Redirect zur Übersicht

## Technical Requirements
- Formularvalidierung mit react-hook-form + Zod
- API-Aufrufe über Next.js Server Actions (POST, PUT/PATCH, DELETE)
- Felder richten sich nach dem tatsächlichen API-Schema (wird bei Implementierung exploriert)
- shadcn/ui Form, Input, DatePicker für das Formular

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

**Wichtig: Kein klassisches REST CRUD — "Replace-All"-Mechanismus**

Die TYPO3-API hat nur einen einzigen Schreibendpunkt (`updateruns`), der **immer das komplette Runs-Array** für einen Läufer ersetzt. Es gibt kein "füge einen Lauf hinzu" oder "lösche Lauf #3".

**API-Endpoint für alle Schreiboperationen:**
- `POST https://www.stuttgarter-kinderstiftung.de/startseite/userset.json`
- Payload (form-encoded):
  ```
  type=191
  request[extensionName]=SwitRunners
  request[pluginName]=User
  request[controller]=User
  request[action]=setdata
  request[arguments][perform]=updateruns
  request[arguments][userUid]=<uid>
  request[arguments][runs]=[{"runDate":"2026-03-17 06:00:00","runDistance":"5.5"}, ...]
  ```

**Sicherheitsprinzip: Datenisolation**

Die `typo3_uid` darf **niemals** vom Client kommen. Das serverseitige Muster ist immer:
1. Supabase-Session des eingeloggten Nutzers prüfen (via `createClient()` auf dem Server)
2. `typo3_uid` aus `runner_profiles` für diese Session-User-ID lesen
3. TYPO3-API mit dieser serverseitig ermittelten UID aufrufen
4. Client kann keine UID mitschicken — der Request-Body enthält nur die Lauf-Daten

**Das universelle Muster für alle Operationen:**
1. Aktuelle Läufe via `runnerget.json` für die **serverseitig ermittelte** `typo3_uid` abrufen
2. Runs-Array lokal modifizieren (hinzufügen / ändern / entfernen)
3. Komplettes modifiziertes Array mit der **serverseitigen** UID an `updateruns` schicken
4. Bei Erfolg: Seite neu laden (erneuter `runnerget.json`-Call)

**Inline-Editing direkt in der Tabelle (kein separater Screen):**
Die Distanzspalte in der Eventtabelle (PROJ-3) enthält direkt editierbare Eingabefelder. Es gibt keine separate Edit-Seite mehr. `/runs/[index]/edit` entfällt.

**Datenfluss Inline-Edit:**
1. Nutzer klickt in das Distanzfeld einer Tabellenzeile
2. Nutzer gibt Distanz ein (oder leert das Feld für "kein Lauf")
3. Beim Verlassen des Feldes (onBlur): Validierung → PUT `/api/runner/runs`
4. Während Speichern: Zeile zeigt Ladezustand
5. Erfolg: kurze Erfolgsanzeige (Toast oder grüner Haken), Statistiken aktualisieren sich
6. Fehler: Fehlermeldung in/unter der Zeile, ursprünglicher Wert wird wiederhergestellt

**"Löschen" = leer oder 0 eintragen:**
Kein separater Delete-Button. Leeres Feld oder 0 km = Lauf wird aus dem Array entfernt.

**Seiten & Komponenten:**
- `src/app/runs/page.tsx` — enthält jetzt die Tabelle mit Inline-Inputs (PROJ-3 + PROJ-4 verschmelzen in einer Seite)
- `src/components/runs-table.tsx` — Distanzspalte als editierbares `<input>` statt reiner Text
- `src/app/runs/[index]/edit/page.tsx` — **entfällt**
- `src/components/run-form.tsx` — **entfällt**

**Datumsformat:**
- Angezeigt: Wochentag + Datum (z.B. "Mo, 20.04.2026")
- Gespeichert an API: `"YYYY-MM-DD 06:00:00"` (Uhrzeit immer 06:00:00)

**Event-Zeitraum (Konstante):**
- Start: 20.04.2026
- Ende: 14.05.2026
- 25 Tage

**Validierung (Zod-Schema):**
- `runDistance`: Dezimalzahl ≥ 0, max. 3 Nachkommastellen (0 erlaubt = Lauf löschen)

## QA Test Results (Initial)

**Tested:** 2026-03-18
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Static code analysis + build verification (network requests blocked by sandbox)

_See QA Re-Test below for current status after the server-side RMW refactoring._

## QA Re-Test Results (Server-side Read-Modify-Write Refactoring)

**Tested:** 2026-04-21
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Code review + automated E2E tests (Chromium + Mobile Safari)

### Change Summary

The runs save mechanism was refactored from a client-side "send all runs" approach to a server-side read-modify-write pattern:
- **API contract change:** `PUT /api/runner/runs` now accepts `{ runDate, runDistance }` (single run) instead of `{ runs: [...], notifyRun: {...} }` (full array)
- **Server-side RMW:** The server fetches the current runs from TYPO3, applies the single change, and writes back the full array
- **Shared mutex:** `src/lib/typo3-mutex.ts` extracted from Strava webhook and now used by all three write paths (runner/runs, strava/webhook, webhook/external)
- **Client simplification:** `runs-table.tsx` no longer manages the full runs array, `allRuns` prop removed, `localRunsRef`/`allRunsRef` removed

### Files Changed
- `src/app/api/runner/runs/route.ts` -- New single-run API contract + server-side RMW
- `src/components/runs-table.tsx` -- Simplified client sends only changed run
- `src/app/runs/page.tsx` -- Removed `allRuns` prop from RunsTable
- `src/app/api/strava/webhook/route.ts` -- Uses shared `withUserLock` from typo3-mutex.ts
- `src/app/api/webhook/external/route.ts` -- Uses shared `withUserLock` from typo3-mutex.ts
- `src/lib/typo3-mutex.ts` -- NEW: Shared per-user mutex module
- `src/lib/typo3-runs.ts` -- Added debug logging for run data payload

### Previous Bugs Status (from QA 2026-03-18)

#### BUG-1 (Race condition on rapid sequential saves): FIXED
- [x] Server-side RMW with `withUserLock(user.id, ...)` serializes concurrent writes per user
- [x] Client save queue (`saveQueueRef`) still serializes client-side blur events sequentially
- [x] E2E test "Rapid sequential saves produce independent PUT requests" confirms both saves arrive
- **RESOLVED**

#### BUG-2 (Out-of-range runs deleted on save): FIXED
- [x] The server now reads all runs from TYPO3 (via `fetchRunnerRuns`), which returns ALL runs including out-of-range dates
- [x] The server only modifies/removes the specific target date, leaving all other dates (including out-of-range) untouched
- [x] Code: `existing.filter((r) => r.runDate.split(' ')[0] !== targetDatePart)` preserves non-matching dates
- **RESOLVED**

#### BUG-3 (No server-side Zod validation): FIXED
- [x] `PutBodySchema = z.object({ runDate: z.string().min(1), runDistance: z.string().regex(/^\d+(\.\d+)?$/) })` validates the single run
- [x] Invalid payloads return 400 "Ungueltige Laufdaten"
- **RESOLVED**

#### BUG-4 (No rate limiting): FIXED
- [x] Rate limiter added: 30 requests per 60 seconds per IP (`rateLimit('runner-runs:${ip}', { limit: 30, windowSeconds: 60 })`)
- **RESOLVED**

#### BUG-5 (inputValues state not re-initialized): STILL PRESENT
- [ ] `inputValues` useState initializer still only runs once on mount
- [ ] After `onRunsUpdated()` refreshes parent data and `days` prop changes, stale values from Strava syncs or other sources may not be reflected
- [ ] Mitigated: the just-saved row's input IS updated after save
- **STILL OPEN** (low severity -- only visible when external sources change data between saves)

### Acceptance Criteria Re-Test

#### AC-1 to AC-6: Unchanged -- all still PASS
- [x] Inline editing, auto-save, loading states, success/error feedback all work identically
- [x] E2E tests: "Successful save shows success toast and green checkmark" PASS
- [x] E2E tests: "Error response from API restores the original value" PASS

#### AC-7: Validierung (server-side) -- NOW PASS
- [x] `PutBodySchema` validates `runDate` (non-empty string) and `runDistance` (regex `^\d+(\.\d+)?$`)
- [x] Invalid payloads correctly rejected with 400
- **PASS** (previously PARTIAL PASS)

#### AC-8: Leer oder 0 eintragen entfernt den Lauf -- PASS
- [x] Client sends `runDistance: "0"` for empty/0 input
- [x] Server detects `parseFloat(change.runDistance) === 0` and removes the run from the array
- [x] E2E test: "Deleting a run sends runDistance 0" PASS
- [x] E2E test: "Deleting a run shows Lauf entfernt toast" PASS
- **PASS**

#### AC-10: Datenisolation -- PASS (strengthened)
- [x] Client now sends ONLY `{ runDate, runDistance }` -- no runs array, no UIDs
- [x] Server reads ALL data from TYPO3 server-side
- [x] E2E test: "PUT payload contains single run -- not full array" verifies no `runs` or `notifyRun` field in request body
- **PASS**

#### AC-11: Nur eigene Laeufe -- PASS
- [x] `fetchRunnerRuns(profile.typo3_uid)` on the server fetches only the logged-in user's runs
- [x] `updateRunnerRuns(profile.typo3_uid, updatedRuns)` writes only to the logged-in user's record
- **PASS**

### Security Audit (Red Team)

#### Authentication
- [x] PUT endpoint verifies Supabase session via `getUser()` -- returns 401 if unauthenticated
- [x] Strava webhook validates `subscription_id` against stored value
- [x] External webhook validates Bearer token hash against database
- **PASS**

#### Authorization / Data Isolation
- [x] `typo3_uid` never comes from the client -- always resolved from `runner_profiles` using `user.id`
- [x] The client cannot influence WHICH runner's data is modified
- [x] The new single-run payload (`{ runDate, runDistance }`) provides a smaller attack surface than the previous full-array payload
- **PASS** (improved)

#### Input Validation
- [x] `PutBodySchema` validates `runDate` as non-empty string
- [x] `PutBodySchema` validates `runDistance` as decimal regex `^\d+(\.\d+)?$`
- [ ] FINDING: `runDate` is only validated as `z.string().min(1)` -- no format validation. An attacker could send `runDate: "not-a-date 06:00:00"` and it would be passed to TYPO3. However, the server splits on space and uses only the date part for comparison, and TYPO3 would receive the malformed date string. Impact: low -- TYPO3 likely rejects invalid dates, and the data only affects the authenticated user's own record.
- **PARTIAL PASS**

#### Rate Limiting
- [x] Runner/runs: 30 req/60s per IP
- [x] External webhook: 60 req/60s per IP
- **PASS**

#### Mutex Safety
- [x] `withUserLock` correctly chains promises -- concurrent requests for same user are serialized
- [x] Lock cleanup: `if (userLocks.get(userId) === myLock) userLocks.delete(userId)` prevents memory leaks
- [x] Error in `fn()` does not deadlock -- `finally` block always resolves the lock
- [x] Return value is correctly propagated through the mutex (`Promise<T>`)
- [ ] LIMITATION: In-memory mutex is per-serverless-instance. If Vercel cold-starts two instances simultaneously for the same user, the mutex provides no protection. For 5-30 users this is acceptable -- the window for collision is very small.
- **PASS** (known limitation documented in code comments)

#### Exposed Secrets
- [x] TYPO3 credentials remain server-only
- [x] `typo3-mutex.ts` has `import 'server-only'` guard
- [x] New debug log at `typo3-runs.ts:136` logs full run data payload -- this is intentional (run data is not secret) and only outputs when `LOG_LEVEL=debug`
- **PASS**

### New Bugs Found

#### BUG-6: runDate format validation is too permissive on server
- **Severity:** Low
- **Steps to Reproduce:**
  1. Send `PUT /api/runner/runs` with `{ "runDate": "invalid-date 06:00:00", "runDistance": "5.0" }`
  2. Expected: 400 error -- runDate should match YYYY-MM-DD format
  3. Actual: Request passes validation (string is non-empty) and is sent to TYPO3
- **Impact:** Low -- data only affects the authenticated user's own record, TYPO3 likely rejects malformed dates
- **Priority:** Fix in next sprint

#### BUG-5 (carryover): inputValues state not re-initialized when parent data refreshes
- **Severity:** Low (downgraded from Medium -- the main race condition concern is now resolved)
- **Steps to Reproduce:**
  1. User saves a run, Strava simultaneously syncs a different day
  2. After save completes and `onRunsUpdated()` re-fetches, the Strava-synced day's new distance is in the `days` prop
  3. But `inputValues` still shows the old value for that day (useState initializer ran only once)
  4. Expected: All days reflect the latest server data after refresh
  5. Actual: Only the just-saved day is updated
- **Priority:** Fix in next sprint -- workaround: page reload shows correct values

### E2E Tests Added

New test file: `tests/runs-save-rmw.spec.ts` -- 6 tests x 2 browsers = 12 test runs

| Test | Chromium | Mobile Safari |
|------|----------|---------------|
| PUT payload contains single run -- not full array | PASS | PASS |
| Deleting a run sends runDistance "0" | PASS | PASS |
| Rapid sequential saves produce independent PUT requests | PASS | PASS |
| Error response from API restores the original value | PASS | PASS |
| Successful save shows success toast and green checkmark | PASS | PASS |
| Deleting a run shows "Lauf entfernt" toast | PASS | PASS |

### Regression Tests

| Test Suite | Result |
|------------|--------|
| Unit tests (184 tests, incl. 7 new mutex tests) | ALL PASS |
| Existing E2E: runs.spec.ts (18 tests) | ALL PASS |
| Existing E2E: external-webhook.spec.ts (32 tests) | ALL PASS |
| New E2E: runs-save-rmw.spec.ts (12 tests) | ALL PASS |
| Build (`npm run build`) | SUCCESS |
| Lint (`npm run lint`) | 0 errors (3 pre-existing warnings) |

### Unit Tests Added (QA Re-Verification 2026-04-21)

New test file: `src/lib/typo3-mutex.test.ts` -- 7 tests verifying mutex correctness:

| Test | Result |
|------|--------|
| Executes function and returns result | PASS |
| Serializes concurrent calls for the same user | PASS |
| Allows concurrent calls for different users | PASS |
| Does not deadlock when function throws | PASS |
| Propagates errors from the function | PASS |
| Serializes three concurrent calls in order | PASS |
| Releases lock even when previous call in chain threw | PASS |

### Pre-existing Issues in Related Code (Not Introduced by This Change)

1. **External webhook date comparison is broken:** `webhook/external/route.ts:145` compares `r.runDate !== date` where `r.runDate` is `"YYYY-MM-DD 06:00:00"` and `date` is `"YYYY-MM-DD"`. The deduplication filter never matches, so duplicate runs for the same date can accumulate. This is a pre-existing PROJ-23 bug, not introduced by this refactoring.

2. **Strava webhook does not deduplicate:** `strava/webhook/route.ts:151` appends runs without checking for existing runs on the same date (`[...existingRuns, newRun]`). If a manual and Strava run land on the same date, both are stored. This is a pre-existing PROJ-5 design choice / bug.

### Summary
- **Acceptance Criteria:** 11/11 passed (AC-7 now fully passes with server-side Zod validation)
- **Previous Bugs Resolved:** 4 of 5 (BUG-1 race condition, BUG-2 out-of-range data loss, BUG-3 server validation, BUG-4 rate limiting)
- **Remaining Bugs:** 2 total (0 critical, 0 high, 0 medium, 2 low)
- **Security:** No critical or high findings. One low-severity input validation gap (BUG-6).
- **Regression:** No regressions -- all existing tests pass
- **Production Ready:** YES
- **Recommendation:** Deploy. Fix BUG-5 (stale input state) and BUG-6 (runDate format validation) in next sprint.

## Deployment
_To be added by /deploy_
