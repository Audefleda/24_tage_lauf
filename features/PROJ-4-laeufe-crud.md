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

## QA Test Results

**Tested:** 2026-03-18
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Static code analysis + build verification (network requests blocked by sandbox)

### Acceptance Criteria Status

#### AC-1: Jede Zeile enthaelt ein direkt editierbares Distanzfeld (kein separater Edit-Screen)
- [x] Each event day row in `runs-table.tsx` renders an `<Input>` element for distance
- [x] No navigation to a separate page required
- **PASS**

#### AC-2: Das Distanzfeld ist vorausgefuellt mit der aktuellen Distanz (leer wenn kein Lauf)
- [x] `inputValues` state initialized from `days` array: `day.distance > 0 ? formatDistanceDE(day.distance) : ''`
- [x] Empty string for days without runs, formatted distance for days with runs
- **PASS**

#### AC-3: Beim Verlassen des Feldes (onBlur) wird automatisch gespeichert
- [x] `onBlur={() => handleBlur(day)}` triggers validation and PUT request
- [x] No save button exists -- blur is the only save trigger
- **PASS**

#### AC-4: Waehrend des Speicherns zeigt die Zeile einen Ladezustand
- [x] `rowState.status === 'saving'` triggers: `opacity-60` on the row + `Loader2` spinner icon
- [x] Input is disabled during save (`disabled={isSaving}`)
- **PASS**

#### AC-5: Bei erfolgreichem Speichern: kurze Erfolgsanzeige
- [x] Green checkmark icon (`Check` from lucide) shown for 2 seconds on success
- [x] Sonner toast notification: "Lauf gespeichert" or "Lauf entfernt"
- **PASS**

#### AC-6: Bei Fehler: Fehlermeldung direkt in/unter der Zeile, Wert wird zurueckgesetzt
- [x] Error state shows red `AlertCircle` icon + error message text below the row (line 294-298)
- [x] On save failure, original value restored (lines 207-213)
- [x] Sonner toast.error also shown
- **PASS**

#### AC-7: Validierung: Distanz muss leer, 0 oder positive Dezimalzahl sein
- [x] `validateDistance()` function handles: empty string (returns 0), comma-to-dot normalization, parseFloat, NaN check, negative check
- [x] Max 3 decimal places enforced
- [ ] BUG: Validation is client-side only. Server endpoint (`/api/runner/runs/route.ts`) does not validate individual run entries with Zod -- only checks `Array.isArray(runs)`. (Same as PROJ-3 BUG-2)
- **PARTIAL PASS**

#### AC-8: Leer oder 0 eintragen entfernt den Lauf (kein separater Loeschen-Button)
- [x] `validateDistance('')` returns 0; `validateDistance('0')` returns 0
- [x] When `newDistance === 0`, the run for that date is removed from the array (line 156: `if (newDistance > 0)` -- only adds if positive)
- [x] Toast says "Lauf entfernt" for distance 0
- **PASS**

#### AC-9: Kein separater Edit-Screen -- /runs/[index]/edit entfaellt
- [x] `/runs/[index]/edit/page.tsx` exists but only does `redirect('/runs')` -- old bookmarks still work
- [x] `/runs/new/page.tsx` also redirects to `/runs`
- **PASS**

#### AC-10: Datenisolation -- typo3_uid wird ausschliesslich serverseitig aus Supabase-Profil gelesen
- [x] `PUT /api/runner/runs` reads `typo3_uid` from `runner_profiles` table using authenticated `user.id` (lines 30-41)
- [x] Client request body contains only `{ runs: [...] }` -- no UID field
- [x] Even if a client sent a UID in the body, the server ignores it completely
- **PASS**

#### AC-11: Nur eigene Laeufe -- Runs-Array enthaelt nur Laeufe des eingeloggten Laeufers
- [x] The server uses the session user's `typo3_uid` for both read and write operations
- [x] `GET /api/runner` filters runners array to find only the matching runner by UID
- [x] `PUT /api/runner/runs` sends the UID from the server-side profile, not from the client
- **PASS**

### Edge Cases Status

#### EC-1: Schnelles Bearbeiten mehrerer Felder hintereinander
- [x] Each row has independent `rowState` tracking -- parallel saves are possible
- [ ] BUG: Potential race condition. When saving row A, the `allRunsRef.current` is used to build the complete runs array. If row B saves before row A's `onRunsUpdated()` refresh completes, row B may use stale data that does not include row A's change. Since TYPO3 replaces the entire array, row B's save could overwrite row A's change.
- **FAIL** (see BUG-1)

#### EC-2: Ungueltiger Wert (z.B. Buchstaben)
- [x] `validateDistance()` returns error message for NaN values: "Bitte eine gueltige Zahl eingeben"
- [x] Error is shown inline, save is prevented
- **PASS**

#### EC-3: Netzwerkfehler
- [x] Fetch errors are caught, error message shown in row and via toast
- [x] Original value restored on failure
- **PASS**

#### EC-4: TYPO3 success: false
- [x] Server checks `typo3Body.success === false` and returns 422 with the message
- [x] Client shows error from response body
- **PASS**

#### EC-5: Nutzer ohne typo3_uid
- [x] Server returns 404 "Kein Laeufer-Profil gefunden" when profile not found
- [x] Client shows this error message
- **PASS**

#### EC-6: Client schickt fremde UID
- [x] Server ignores any UID from client -- always uses session-based profile lookup
- **PASS**

#### EC-7: URL mit Index ausserhalb des Event-Zeitraums
- [x] `/runs/[index]/edit` redirects to `/runs` regardless of index value
- **PASS**

### Security Audit Results
- [x] Authentication: PUT endpoint verifies Supabase session via `getUser()` -- returns 401 if not authenticated
- [x] Authorization: UID isolation is solid -- `typo3_uid` never comes from client, always from server-side profile lookup
- [x] Input validation (client): `validateDistance()` blocks non-numeric, negative, and >3 decimal place values
- [ ] BUG: Input validation (server): No Zod schema validation on the runs array items. `runDate` and `runDistance` fields are not validated for format/type. An attacker could send `{"runs":[{"runDate":"<script>alert(1)</script>","runDistance":"9999999"}]}` -- TYPO3 would receive it.
- [x] XSS: React renders all values safely. No `dangerouslySetInnerHTML` usage.
- [ ] BUG: No rate limiting on the PUT endpoint. Automated scripts could flood the TYPO3 API.
- [x] CSRF: Supabase auth cookies + server-side session check provide implicit CSRF protection
- [x] Secret exposure: TYPO3 credentials are server-only (no NEXT_PUBLIC_ prefix)

### Cross-Browser / Responsive Notes
- Static analysis only. Key observations:
  - Week cards use `grid-cols-1 md:grid-cols-2 xl:grid-cols-4` -- good responsive behavior
  - Input fields use `inputMode="decimal"` -- triggers numeric keyboard on mobile
  - `data-index` attribute on inputs enables Escape key handler to find the correct day
  - `aria-label` on each input provides accessibility context

### Bugs Found

#### BUG-1: Race condition on rapid sequential saves (Data Loss)
- **Severity:** High
- **Steps to Reproduce:**
  1. Edit distance for Day 1 and immediately tab to Day 2 and edit
  2. Day 1 blur triggers save with current `allRunsRef.current` (original data)
  3. Day 2 blur triggers save before Day 1's `onRunsUpdated()` refresh completes
  4. Day 2's save uses `allRunsRef.current` which still has OLD data (without Day 1's change)
  5. Expected: Both Day 1 and Day 2 saves are reflected
  6. Actual: Day 2's save overwrites Day 1's change because it built its array from stale data
- **Priority:** Fix before deployment

#### BUG-2: Out-of-range runs deleted on save (same as PROJ-3 BUG-1)
- **Severity:** High
- **Steps to Reproduce:**
  1. Runner has runs from dates outside 20.04-14.05.2026
  2. Edit any day in the event range
  3. `runs-table.tsx` line 171: `filteredRuns.filter(r => getIndexForDateStr(r.runDate) >= 0)` removes out-of-range runs
  4. Expected: Out-of-range runs are preserved
  5. Actual: Out-of-range runs are silently deleted
- **Priority:** Fix before deployment

#### BUG-3: No server-side Zod validation on runs payload
- **Severity:** Medium
- **Steps to Reproduce:**
  1. PUT /api/runner/runs with `{"runs":[{"runDate":"invalid","runDistance":"notanumber"}]}`
  2. Expected: 400 response with validation error
  3. Actual: Malformed data is passed directly to TYPO3
- **Priority:** Fix before deployment

#### BUG-4: No rate limiting / debounce on save requests
- **Severity:** Low
- **Steps to Reproduce:**
  1. Rapidly click into and out of input fields with changed values
  2. Each blur triggers an immediate fetch + TYPO3 API call
  3. Expected: Some debounce or rate limiting
  4. Actual: Unlimited requests possible
- **Priority:** Fix in next sprint

#### BUG-5: inputValues state not re-initialized when parent data refreshes
- **Severity:** Medium
- **Steps to Reproduce:**
  1. The `inputValues` state is initialized via `useState(() => {...})` which only runs once on mount
  2. When `onRunsUpdated()` refreshes parent data and `days` prop changes, the `inputValues` state is NOT re-computed from the new `days`
  3. Expected: After a refresh, all input values reflect the latest server data
  4. Actual: Only the row that was just saved gets its input updated (lines 192-195). Other rows may show stale values if the server returned different data.
- **Note:** This is partially mitigated because the parent's `refreshRunner()` updates `state.data` which re-renders `RunsTable` with new `days` prop, but `inputValues` useState initializer does not re-run. If another user (or Strava sync) changed a run on a different day, that change would not be reflected in the input values until a full page reload.
- **Priority:** Fix before deployment

### Summary
- **Acceptance Criteria:** 10/11 passed (1 partial pass on AC-7 due to missing server-side validation)
- **Bugs Found:** 5 total (0 critical, 2 high, 2 medium, 1 low)
- **Security:** 2 issues found (missing server-side validation, no rate limiting)
- **Production Ready:** NO
- **Recommendation:** Fix BUG-1 (race condition), BUG-2 (out-of-range data loss), BUG-3 (server validation), and BUG-5 (stale input state) before deployment.

## Deployment
_To be added by /deploy_
