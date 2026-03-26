# PROJ-18: Läufer-Vorauswahl anhand E-Mail-Adresse

## Status: Deployed
**Created:** 2026-03-26
**Deployed:** 2026-03-26

## Dependencies
- Requires: PROJ-9 (Läufer-Selbstzuordnung) — erweitert den `RunnerSelectDialog` um Vorauswahl-Logik

---

## User Stories
- Als Läufer*in, die sich beim ersten Login zuordnen muss, möchte ich meinen Namen in der Liste vorausgewählt sehen, damit ich mich nicht manuell durch die Liste suchen muss.
- Als Läufer*in mit E-Mail-Adresse im Format `vorname.nachname@domain.tld` möchte ich, dass die App meinen Namen automatisch aus der E-Mail-Adresse ableitet.
- Als Läufer*in, deren Name nicht eindeutig erkannt werden kann, möchte ich die vollständige unveränderte Liste sehen und manuell wählen — ohne Fehlermeldung oder Warnung.
- Als System möchte ich eine robuste, mehrstufige Suche verwenden, damit auch Teilübereinstimmungen einen sinnvollen Vorschlag liefern.

## Acceptance Criteria
- [ ] **AC-1:** Beim Öffnen des `RunnerSelectDialog` wird die E-Mail-Adresse des eingeloggten Benutzers ausgelesen (steht bereits in der Supabase-Session)
- [ ] **AC-2:** Aus der E-Mail wird der Teil vor dem `@` extrahiert und anhand von `.` in Vorname und Nachname aufgeteilt (Format: `vorname.nachname`)
- [ ] **AC-3:** Die Matching-Logik durchläuft folgende Stufen der Reihe nach — bei erstem Treffer wird abgebrochen:
  1. **Vollständiger Name:** Suche nach `Vorname Nachname` (Leerzeichen zwischen Vor- und Nachname) — case-insensitive
  2. **Abgekürzter Nachname:** Suche nach `Vorname N.` (Nachname auf ersten Buchstaben + Punkt) — case-insensitive
  3. **Nur Vorname:** Suche nach exaktem Vornamen — case-insensitive
  4. **Substring:** Suche, ob der Vorname als Teilstring in einem Läufernamen vorkommt — case-insensitive
  5. **Kein Treffer:** kein Läufer vorausgewählt
- [ ] **AC-4:** Wird ein Treffer gefunden, ist der entsprechende Läufer im Select vorausgewählt (wie als hätte der Benutzer ihn manuell gewählt) — der Bestätigen-Button ist damit sofort aktiv
- [ ] **AC-5:** Die Vorauswahl ist eine reine UI-Hilfe — der Benutzer kann jederzeit einen anderen Läufer auswählen und bestätigen
- [ ] **AC-6:** Kann kein Treffer ermittelt werden, bleibt das Select leer (kein Vorschlag, kein Fehler, kein Hinweis)
- [ ] **AC-7:** Die Matching-Logik wird nur auf die Liste der **noch nicht vergebenen** Läufer angewendet (die bereits gefilterte Liste aus `GET /api/runner/available`)
- [ ] **AC-8:** Die gesamte Logik ist rein clientseitig — kein neuer API-Endpunkt

## Edge Cases
- E-Mail enthält keinen Punkt vor dem `@` (z. B. `max@domain.tld`) → kein Nachname ableitbar; Suche nur nach dem gesamten lokalen Teil als Vorname (Stufe 3/4)
- Lokaler Teil enthält mehr als einen Punkt (z. B. `max.mustermann.jr@domain.tld`) → erster Teil = Vorname, letzter Teil = Nachname; mittlere Teile werden ignoriert
- Mehrere Läufer treffen zu (z. B. zwei Läufer mit Vorname "Max") → erster Treffer in der alphabetisch sortierten Liste wird vorausgewählt; keine Warnung
- E-Mail-Adresse fehlt in der Session → kein Absturz, kein Vorschlag, Dialog verhält sich wie bisher
- Groß-/Kleinschreibung unterschiedlich zwischen E-Mail und TYPO3-Läufername (z. B. `max.mustermann` vs. "Max Mustermann") → Matching ist case-insensitive, Treffer wird gefunden
- Sonderzeichen / Umlaute in Namen (z. B. `mueller` vs. "Müller") → kein automatisches Umlaut-Mapping; kein Treffer bei Abweichung — Benutzer wählt manuell

## Technical Requirements
- Matching-Logik als pure Hilfsfunktion implementierbar (kein Netzwerk, kein State)
- Eingabe: Liste der verfügbaren Läufer (`{ uid, nr, name }[]`) + E-Mail-String
- Ausgabe: `uid` des vorausgewählten Läufers oder `null`
- Funktion ist unabhängig testbar

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## Implementation Notes

### Frontend Implementation (2026-03-26)

**New file: `src/lib/find-runner-by-email.ts`**
- Pure helper function `findRunnerByEmail(runners, email)` with no side effects
- Parses email local part into first name / last name using dot separator
- Implements the 5-stage matching cascade as specified in AC-3
- Handles edge cases: no dot in email, multiple dots, empty/null email
- Returns matched runner UID or null

**Modified: `src/components/runner-select-dialog.tsx`**
- After runners are fetched successfully, gets user email via `supabase.auth.getUser()`
- Calls `findRunnerByEmail()` with the runner list and email
- If a match is found, sets `selectedUid` so the Select shows the pre-selected runner and the "Bestatigen" button is immediately active
- Pre-selection errors are silently caught (UI convenience, not critical)
- No new API endpoints — entirely client-side logic (AC-8)

## QA Test Results

**Tested:** 2026-03-26
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Code review + build verification + lint check (no runtime test due to Supabase/TYPO3 dependency)

### Build & Lint

- [x] `npm run build` passes without errors
- [x] `npm run lint` passes without new warnings (2 pre-existing warnings unrelated to PROJ-18)
- [x] No TypeScript compilation errors

### Acceptance Criteria Status

#### AC-1: E-Mail-Adresse wird aus Supabase-Session ausgelesen
- [x] PASS: `runner-select-dialog.tsx` line 62 calls `supabase.auth.getUser()` and passes `user?.email` to matching function
- [x] PASS: Uses browser Supabase client (`createClient` from `@/lib/supabase`) which reads the session cookie

#### AC-2: E-Mail wird vor dem @ gesplittet und anhand von `.` in Vorname/Nachname aufgeteilt
- [x] PASS: `parseEmailName()` splits by `@` to get local part, then splits by `.`
- [x] PASS: Single part = firstName only, no lastName
- [x] PASS: Two parts = first = firstName, last = lastName
- [x] PASS: Multiple parts = first = firstName, last part = lastName, middle ignored

#### AC-3: 5-Stufen Matching-Kaskade
- [x] PASS: Stage 1 -- Full name `"vorname nachname"` case-insensitive comparison (lines 70-76)
- [x] PASS: Stage 2 -- Abbreviated `"vorname n."` case-insensitive comparison (lines 79-84)
- [x] PASS: Stage 3 -- Exact first name case-insensitive comparison (lines 88-91)
- [x] PASS: Stage 4 -- Substring match of first name in runner name (lines 94-97)
- [x] PASS: Stage 5 -- Returns `null` if no match (line 100)
- [x] PASS: Each stage uses `runners.find()` which returns first match, and early-returns on match

#### AC-4: Vorausgewaehlter Laeufer im Select, Button sofort aktiv
- [x] PASS: `setSelectedUid(String(matchedUid))` at line 65 sets the Select value
- [x] PASS: Button disabled condition `!selectedUid || assigning` at line 207 becomes false when selectedUid is set

#### AC-5: Benutzer kann jederzeit anderen Laeufer waehlen
- [x] PASS: Select uses `onValueChange={setSelectedUid}` (line 183), allowing free override
- [x] PASS: No readonly or locked state on the Select component

#### AC-6: Kein Treffer = leeres Select, kein Fehler, kein Hinweis
- [x] PASS: `if (matchedUid !== null)` guard at line 64 prevents setting value when no match
- [x] PASS: Errors in pre-selection are silently caught (line 67 catch block)
- [x] PASS: No error UI, no warning UI, no toast on no-match

#### AC-7: Matching nur auf noch-nicht-vergebene Laeufer
- [x] PASS: `findRunnerByEmail()` receives `runners` from `/api/runner/available` response (line 63)
- [x] PASS: `/api/runner/available` endpoint filters out assigned runners via `assignedUids` Set (lines 86-93 of route.ts)

#### AC-8: Rein clientseitig, kein neuer API-Endpunkt
- [x] PASS: `findRunnerByEmail` is a pure function in `src/lib/find-runner-by-email.ts`
- [x] PASS: No new files in `src/app/api/`
- [x] PASS: `supabase.auth.getUser()` is a client-side call using the browser session

### Edge Cases Status

#### EC-1: E-Mail ohne Punkt vor dem @ (z.B. `max@domain.tld`)
- [x] PASS: `parseEmailName` returns `{firstName: 'max', lastName: null}`. Stages 1+2 skipped (null check on `lastNameLower`). Stages 3+4 search for 'max'.

#### EC-2: Mehrere Punkte im lokalen Teil (z.B. `max.mustermann.jr@domain.tld`)
- [x] PASS: `parts[0]` = 'max', `parts[parts.length - 1]` = 'jr'. Middle parts ignored per spec.

#### EC-3: Mehrere Laeufer mit gleichem Vornamen
- [x] PASS: `runners.find()` returns first match. Runners come alphabetically sorted from API. First in alphabetical order is selected.

#### EC-4: E-Mail-Adresse fehlt in der Session
- [x] PASS: `findRunnerByEmail(runners, null)` returns `null` at line 56 (`!email` check). No crash.
- [x] PASS: `findRunnerByEmail(runners, undefined)` also returns `null` at same check.

#### EC-5: Case-insensitive Matching
- [x] PASS: All comparisons use `.toLowerCase()` on both sides.

#### EC-6: Umlaute (z.B. `mueller` vs `Mueller`)
- [x] PASS: No umlaut mapping implemented. `'mueller' !== 'muller'` and `'mueller'` is not a substring of `'muller'`. No false match. Matches spec requirement.

#### EC-7 (Additional): Empty string email
- [x] PASS: `email.split('@')[0]` returns `''`, which is falsy. `parseEmailName` returns `{firstName: '', lastName: null}`. `findRunnerByEmail` returns null at `!firstName` check.

#### EC-8 (Additional): Email with `+` tag (e.g. `max+test@domain.tld`)
- [x] NOTE: firstName = 'max+test', no lastName. Stages 3+4 search for 'max+test' which is unlikely to match any runner name. Acceptable behavior -- not in spec, but graceful degradation (no crash, no match, user selects manually).

### Security Audit Results

- [x] **No new attack surface:** Feature is entirely client-side matching logic. No new API endpoints introduced.
- [x] **No data leakage:** The email is read from the authenticated user's own session. Runner list was already exposed via `/api/runner/available` (authenticated endpoint with rate limiting).
- [x] **No injection risk:** `findRunnerByEmail` performs string comparison only (`.toLowerCase()`, `.includes()`). No DOM manipulation, no SQL, no HTML rendering of email parts.
- [x] **Authentication preserved:** `/api/runner/available` still requires authentication (line 38 of route.ts). The `getUser()` call in the dialog also requires an active session.
- [x] **Rate limiting preserved:** `/api/runner/available` has rate limiting (30 req/60s per IP).
- [x] **No secrets exposed:** No new environment variables. No tokens or keys in client code.
- [x] **Error handling:** Pre-selection errors are silently caught; they do not expose stack traces or internal state to the user.

### Cross-Browser & Responsive Notes

The PROJ-18 change is purely logical (no new UI elements, no new styles). The pre-selection sets a value on an existing `<Select>` component from shadcn/ui. No cross-browser or responsive issues expected, as:
- No new CSS or layout changes
- No new DOM elements
- shadcn/ui Select component is already cross-browser tested via Radix UI primitives

### Bugs Found

No bugs found. The implementation correctly matches all 8 acceptance criteria and all 6 documented edge cases.

### Summary

- **Acceptance Criteria:** 8/8 passed
- **Edge Cases:** 6/6 documented + 2 additional identified, all handled correctly
- **Bugs Found:** 0
- **Security:** Pass -- no new attack surface, no data leakage, no injection risk
- **Build:** Pass (no errors, no new warnings)
- **Production Ready:** YES
- **Recommendation:** Deploy. The implementation is clean, well-documented, and handles all edge cases gracefully. The pure function design makes it independently testable. Consider adding unit tests for `findRunnerByEmail` in a future sprint.

## Deployment
_To be added by /deploy_
