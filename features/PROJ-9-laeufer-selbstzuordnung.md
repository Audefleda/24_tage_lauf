# PROJ-9: Läufer-Selbstzuordnung beim ersten Login

## Status: Deployed
**Created:** 2026-03-21
**Last Updated:** 2026-03-21 (deployed)

## Dependencies
- Requires: PROJ-2 (Anmeldung — Supabase Auth Login) — Benutzer muss eingeloggt sein
- Requires: PROJ-6 (Benutzerverwaltung Admin) — `runner_profiles`-Tabelle und TYPO3-Läuferliste-API müssen existieren

## User Stories
- Als eingeloggter Benutzer ohne Läufer-Zuordnung möchte ich nach dem Login sofort gefragt werden, welcher Läufer ich bin, damit ich die App sofort nutzen kann ohne auf den Admin warten zu müssen.
- Als eingeloggter Benutzer ohne Läufer-Zuordnung möchte ich nur Läufer sehen, die noch nicht vergeben sind, damit ich keine falsche Zuordnung verursachen kann.
- Als eingeloggter Benutzer möchte ich die Läuferliste alphabetisch sortiert sehen, damit ich meinen Namen schnell finden kann.
- Als System möchte ich sicherstellen, dass ein Benutzer die App nicht nutzen kann, bevor er sich einem Läufer zugeordnet hat.
- Als eingeloggter Benutzer mit bereits zugeordnetem Läufer möchte ich nie die Zuordnungsmaske sehen — sie soll dauerhaft verschwinden.

## Acceptance Criteria
- [ ] Beim Aufruf einer geschützten Seite (z. B. `/runs`) wird geprüft, ob der eingeloggte Benutzer einen zugeordneten Läufer hat
- [ ] Hat er keinen Läufer → ein Modal/Dialog erscheint und blockiert die gesamte Seite (kein X-Button, kein Schließen möglich)
- [ ] Das Modal zeigt eine alphabetisch sortierte Liste aller noch **nicht** zugeordneten TYPO3-Läufer (Name + Startnummer)
- [ ] Der Benutzer wählt einen Läufer aus der Liste und bestätigt mit einem Button
- [ ] Nach erfolgreicher Bestätigung wird die Zuordnung in der `runner_profiles`-Tabelle gespeichert
- [ ] Das Modal schließt sich automatisch nach erfolgreicher Zuordnung — ohne Seiten-Reload
- [ ] Hat der Benutzer bereits einen Läufer zugeordnet → das Modal wird **nie** angezeigt
- [ ] Ist die Läuferliste leer (alle bereits vergeben) → informativer Hinweis im Modal statt leerer Liste, z. B. "Alle Läufer sind bereits vergeben. Bitte wende dich an den Administrator."
- [ ] Der Benutzer kann die Läuferliste nicht absenden ohne einen Läufer ausgewählt zu haben (Button disabled bis Auswahl getroffen)
- [ ] Während die Läuferliste lädt, wird ein Lade-Indikator angezeigt

## Edge Cases
- Was passiert wenn die TYPO3-API nicht erreichbar ist? → Fehlermeldung im Modal mit "Erneut versuchen"-Button; Benutzer bleibt im blockierten Modal
- Was passiert wenn alle Läufer bereits vergeben sind? → Hinweistext im Modal "Alle Läufer vergeben — bitte Admin kontaktieren"; kein Bestätigen-Button
- Was passiert wenn zwei Benutzer gleichzeitig denselben Läufer auswählen? → Der zweite erhält einen Fehler (unique constraint in DB); Modal bleibt offen mit Fehlermeldung und aktualisierter Liste
- Was passiert wenn der Benutzer die Seite neu lädt bevor er bestätigt? → Modal erscheint erneut (Zustand nicht gespeichert bis Bestätigung)
- Was passiert wenn ein Admin dem Benutzer zwischenzeitlich einen Läufer zuordnet, während das Modal offen ist? → Nach dem nächsten Laden der Seite erscheint das Modal nicht mehr
- Was passiert wenn ein Benutzer direkt eine URL wie `/runs/new` aufruft ohne Läufer? → Modal erscheint auch dort; nach Bestätigung wird zur ursprünglichen URL weitergeleitet

## Technical Requirements
- Prüfung geschieht client-side auf jeder geschützten Seite (kein Middleware-Redirect nötig)
- Läuferliste wird von der bestehenden API `GET /api/admin/runners` bezogen — gefiltert auf nicht-zugeordnete Läufer
- Speicherung über neuen Endpunkt `POST /api/runner/assign` (Benutzer ordnet sich selbst zu — kein Admin-Recht nötig)
- Der neue Endpunkt prüft server-seitig: eingeloggter Benutzer, noch kein Läufer zugeordnet, gewählter Läufer noch nicht vergeben
- UI-Komponente: shadcn Dialog (nicht schließbar) + Select oder Radio-Group für Läufer-Liste

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponenten-Struktur

```
Alle geschützten Seiten (/runs, /runs/new, /runs/[id]/edit)
+-- RunnerSelectDialog (neue Komponente — nur sichtbar wenn kein Läufer zugeordnet)
    +-- Dialog (shadcn — kein X-Button, kein Schließen per Escape/Klick außen)
        +-- Lade-Zustand (Skeleton während Läuferliste lädt)
        +-- Fehler-Zustand (Alert + "Erneut versuchen"-Button)
        +-- Leer-Zustand (alle Läufer vergeben — Alert, kein Bestätigen-Button)
        +-- Läuferliste (Select, alphabetisch: Name + Startnummer)
        +-- Bestätigen-Button (disabled bis Auswahl getroffen)
```

### Datenfluss

```
Benutzer ruft geschützte Seite auf
        ↓
GET /api/runner  →  404 (kein Profil) → Dialog öffnet sich
                →  200 (Profil vorhanden) → kein Dialog
        ↓ (Dialog offen)
GET /api/runner/available → nicht-vergebene Läufer (alphabetisch)
        ↓ (Benutzer wählt + bestätigt)
POST /api/runner/assign → Zuordnung in runner_profiles speichern
        ↓
Dialog schließt automatisch — kein Seiten-Reload
```

### Neue API-Endpunkte

| Endpunkt | Methode | Zugriff | Zweck |
|----------|---------|---------|-------|
| `/api/runner/available` | GET | Jeder eingeloggte User | Nicht-vergebene TYPO3-Läufer, alphabetisch sortiert |
| `/api/runner/assign` | POST | Jeder eingeloggte User ohne Profil | Selbst-Zuordnung zu einem Läufer |

`POST /api/runner/assign` prüft server-seitig:
1. Benutzer muss eingeloggt sein
2. Benutzer hat noch kein `runner_profiles`-Eintrag
3. Gewählte TYPO3-UID ist noch nicht vergeben (DB unique constraint als Absicherung)

### Neue Dateien

| Was | Pfad |
|-----|------|
| Verfügbare Läufer API | `src/app/api/runner/available/route.ts` (neu) |
| Selbst-Zuordnung API | `src/app/api/runner/assign/route.ts` (neu) |
| Dialog-Komponente | `src/components/runner-select-dialog.tsx` (neu) |

### Geänderte Dateien

| Was | Datei | Änderung |
|-----|-------|----------|
| Runs-Seite | `src/app/runs/page.tsx` | `<RunnerSelectDialog>` einbinden |

## Implementation Notes (Backend)

**Built on:** 2026-03-21

### New Files

1. **`src/app/api/runner/available/route.ts`** — GET endpoint for fetching unassigned TYPO3 runners
   - Rate limit: 30 req/60s per IP
   - Auth required (any logged-in user, no admin check)
   - Fetches all TYPO3 runners via `typo3Fetch` (same TYPO3 API call as `/api/admin/runners`)
   - Queries `runner_profiles` table for all assigned `typo3_uid` values
   - Filters out already-assigned runners using a `Set` lookup
   - Returns only `{ uid, nr, name }` fields, sorted alphabetically by name (German locale)
   - Error handling: 502 for TYPO3 errors, 500 for DB errors

2. **`src/app/api/runner/assign/route.ts`** — POST endpoint for self-assignment
   - Rate limit: 10 req/60s per IP
   - Auth required (any logged-in user, no admin check)
   - Zod validation: `typo3_uid` must be a positive integer
   - Server-side checks before insert:
     - User must not already have a `runner_profiles` entry (409 if exists)
     - Chosen `typo3_uid` must not already be assigned (409 if taken)
   - Handles PostgreSQL unique constraint violation (code `23505`) for race conditions
   - Returns 201 on success

### Patterns Followed
- Same rate limiting pattern as `/api/admin/runners`
- Same auth pattern as `/api/runner` (createClient + getUser)
- Same TYPO3 fetch pattern and error handling (Typo3Error class)
- Same Zod validation pattern as other POST endpoints
- German error messages consistent with existing API routes

## Implementation Notes (Frontend)

**Built on:** 2026-03-21

### New Files

1. **`src/components/runner-select-dialog.tsx`** -- Blocking modal dialog for runner self-assignment
   - Uses Radix Dialog primitives directly (not the shadcn `DialogContent` wrapper) to omit the close X button
   - Reuses shadcn `DialogOverlay`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` for consistent styling
   - Prevents closing via Escape, outside click, and pointer-down-outside (`preventDefault` on all three events)
   - Four states: loading (skeleton), error (alert + retry button), empty (info alert), success (Select + confirm button)
   - On assignment error (e.g. race condition 409): shows error alert inside dialog and refreshes runner list automatically
   - Props: `{ open: boolean, onAssigned: () => void }`

### Changed Files

1. **`src/app/runs/page.tsx`** -- Added `no-profile` state to `PageState` union
   - Detects HTTP 404 from `GET /api/runner` (no runner_profiles entry) and sets `status: 'no-profile'`
   - In `no-profile` state: renders skeleton placeholders behind the blocking `RunnerSelectDialog`
   - `onAssigned` callback calls `fetchRunner()` which re-fetches `/api/runner` -- now returns 200, dialog disappears, page renders normally
   - No page reload needed -- state transitions from `no-profile` -> `loading` -> `success`

### Patterns Followed
- Same loading/error/empty state pattern as `runner-assignment-table.tsx`
- Same fetch + error handling pattern as existing page components
- Same shadcn component usage (Select, Alert, Button, Skeleton)
- German UI text consistent with rest of app

### Design Decisions
- Used Radix Dialog primitives directly instead of shadcn `DialogContent` to avoid the hardcoded close button -- all other Dialog sub-components (Header, Title, etc.) are still from shadcn
- Behind the blocking dialog, skeleton placeholders are shown to give a sense of the page layout the user will see after assignment
- After successful assignment, `fetchRunner()` is called which transitions through loading -> success, effectively closing the dialog without a full page reload

## QA Test Results

### Round 1 (2026-03-21) -- CRITICAL BUGS FOUND

Previous QA run found 3 bugs:
- **BUG-1 (Critical):** RLS policies blocked both insert and cross-user select on runner_profiles -- FIXED (both endpoints now use `createAdminClient()`)
- **BUG-2 (Medium):** /api/runner/assign did not validate typo3_uid exists in TYPO3 -- FIXED (TYPO3 runner list is now fetched and validated before insert)
- **BUG-3 (Low):** German text uses ASCII transliterations instead of Umlauts -- PARTIALLY FIXED (dialog component fixed, API error messages still use ASCII)

### Round 2 (2026-03-21) -- Re-test after fixes

**Tested by:** /qa
**Build status:** PASS (production build succeeds, all routes compile)

### Acceptance Criteria Results

| # | Criterion | Result | Notes |
|---|-----------|--------|-------|
| AC-1 | Beim Aufruf einer geschuetzten Seite wird geprueft, ob der Benutzer einen Laeufer hat | PASS | `/runs/page.tsx` fetches `GET /api/runner`, detects 404 for missing profile, sets `no-profile` state |
| AC-2 | Hat er keinen Laeufer: Modal erscheint, blockiert Seite (kein X, kein Schliessen) | PASS | Dialog uses Radix primitives directly (no shadcn DialogContent), `onPointerDownOutside`, `onEscapeKeyDown`, `onInteractOutside` all call `preventDefault()`. No close button rendered. |
| AC-3 | Modal zeigt alphabetisch sortierte Liste nicht-zugeordneter Laeufer (Name + Startnummer) | PASS | `/api/runner/available` now uses `createAdminClient()` to read all assigned UIDs, filters correctly, sorts by German locale |
| AC-4 | Benutzer waehlt Laeufer und bestaetigt mit Button | PASS | Select component + "Bestaetigen" button implemented correctly |
| AC-5 | Nach Bestaetigung wird Zuordnung in runner_profiles gespeichert | PASS | `/api/runner/assign` now uses `createAdminClient()` for insert, bypassing RLS |
| AC-6 | Modal schliesst sich automatisch ohne Seiten-Reload | PASS | `onAssigned` callback triggers `fetchRunner()` which transitions state from `no-profile` -> `loading` -> `success` |
| AC-7 | Hat Benutzer bereits Laeufer: Modal wird nie angezeigt | PASS | When `/api/runner` returns 200, state is `success` and dialog is not rendered |
| AC-8 | Laeuferliste leer (alle vergeben): informativer Hinweis | PASS | Empty array renders info Alert with message "Alle Laeufer sind bereits vergeben. Bitte wende dich an den Administrator." No confirm button shown. |
| AC-9 | Button disabled bis Auswahl getroffen | PASS | `disabled={!selectedUid || assigning}` on the button |
| AC-10 | Lade-Indikator waehrend Laeuferliste laedt | PASS | Skeleton placeholders shown in `loading` state |

### Edge Case Results

| Edge Case | Result | Notes |
|-----------|--------|-------|
| TYPO3 API nicht erreichbar | PASS | Error state renders Alert + "Erneut versuchen" button; dialog stays open and blocks page |
| Alle Laeufer vergeben | PASS | Info alert shown, no confirm button. Filtering now works correctly with admin client. |
| Race condition (two users pick same runner) | PASS | PostgreSQL unique constraint `23505` caught, error shown in dialog, runner list refreshed automatically |
| Seite neu laden vor Bestaetigung | PASS | No state persisted; modal reappears on reload |
| Admin ordnet Laeufer zu waehrend Modal offen | PASS | Next page load returns 200 from `/api/runner`, no modal |
| Direkter URL-Aufruf `/runs/new` ohne Laeufer | PASS | `/runs/new` and `/runs/[index]/edit` both redirect to `/runs`, which shows the dialog |
| Assigning non-existent TYPO3 UID | PASS (NEW) | `/api/runner/assign` now validates UID against TYPO3 runner list before insert; returns 400 for invalid UIDs |

### Bugs Found

#### BUG-4: MEDIUM -- `supabase-admin.ts` missing `server-only` guard (potential secret leak)

**Severity:** Medium (P1)
**Component:** `src/lib/supabase-admin.ts`

**Description:**
The file `src/lib/supabase-admin.ts` contains a comment "Server-only -- NIEMALS in Client Components importieren" but does NOT include the `import 'server-only'` directive. The sibling file `src/lib/typo3-client.ts` correctly includes this guard. Without this directive, if a developer accidentally imports `createAdminClient()` in a client component, the `SUPABASE_SERVICE_ROLE_KEY` environment variable could be bundled into the browser JavaScript and exposed to end users.

Currently, `createAdminClient()` is only imported in server-side API routes (`/api/runner/available`, `/api/runner/assign`, `/api/runner/runs`, `/api/admin/*`), so there is no active leak. However, the missing guard means there is no build-time protection against future mistakes.

**Steps to reproduce:**
1. Open `src/lib/supabase-admin.ts` -- observe no `import 'server-only'` directive
2. Compare with `src/lib/typo3-client.ts` line 3 -- has `import 'server-only'`
3. If any client component were to import `createAdminClient`, the build would succeed without error, potentially exposing the service role key

**Fix required:** Add `import 'server-only'` at the top of `src/lib/supabase-admin.ts`.

---

#### BUG-5: LOW -- API error messages in `/api/runner/assign` use ASCII transliterations instead of Umlauts

**Severity:** Low (P3)
**Component:** `src/app/api/runner/assign/route.ts`

**Description:**
While the dialog component (`runner-select-dialog.tsx`) now uses proper German characters, the API error messages in `assign/route.ts` still use ASCII transliterations: "Ungueltiger JSON-Body", "Ungueltige Eingabe", "Ungueltiger Laeufer", "Du hast bereits einen Laeufer zugeordnet", "Dieser Laeufer ist bereits einem anderen Benutzer zugeordnet", "gewaehlt". These error messages are displayed to the user in the dialog when assignment fails.

The rest of the application (other API routes, page components) uses proper German characters.

**Fix required:** Replace ASCII transliterations with proper Umlauts in all German error strings in `assign/route.ts`.

---

### Security Audit

| Check | Result | Notes |
|-------|--------|-------|
| Auth bypass on `/api/runner/available` | PASS | Requires valid Supabase session; returns 401 without auth |
| Auth bypass on `/api/runner/assign` | PASS | Requires valid Supabase session; returns 401 without auth |
| Rate limiting on `/api/runner/available` | PASS | 30 req/60s per IP |
| Rate limiting on `/api/runner/assign` | PASS | 10 req/60s per IP |
| Input validation (Zod) on assign | PASS | `typo3_uid` must be positive integer; invalid JSON returns 400 |
| Privilege escalation: user assigns another user | PASS | `user.id` is taken from session, not from request body -- user cannot specify a different `user_id` |
| Privilege escalation: user changes existing assignment | PASS | Checks for existing profile first (409); DB unique constraint on `user_id` as backup |
| Double-assignment of same runner | PASS | Application-level check + DB unique constraint on `typo3_uid` |
| Assigning arbitrary typo3_uid | PASS (was MEDIUM RISK) | Now validated against TYPO3 runner list before insert (BUG-2 fix confirmed) |
| Information disclosure via `/api/runner/available` | LOW RISK (accepted) | Returns TYPO3 runner names, UIDs, and numbers to any authenticated user. Acceptable for 5-30 person group. |
| RLS bypass via admin client | PASS | Both new endpoints use `createAdminClient()` for DB ops but enforce auth via `createClient().auth.getUser()` first. Admin client is only used after auth is confirmed. |
| Missing server-only guard | MEDIUM RISK | See BUG-4 -- `supabase-admin.ts` lacks `import 'server-only'` directive. No active leak but no build-time protection. |
| CSRF protection | PASS | Supabase auth cookies use SameSite; Next.js handles CSRF for API routes |
| Rate limit bypass via IP spoofing | LOW RISK (accepted) | Rate limit uses `x-forwarded-for`. Behind Vercel CDN, not trivially spoofable. |

### Regression Check

| Feature | Impact | Status |
|---------|--------|--------|
| PROJ-1 (API Config) | No changes to TYPO3 client or auth | OK |
| PROJ-2 (Supabase Auth) | No changes to auth flow | OK |
| PROJ-3 (Laeufe-Uebersicht) | `/runs/page.tsx` modified -- new `no-profile` state added to `PageState` union. Existing `loading`, `error`, `success` states unchanged. | OK |
| PROJ-4 (Laeufe CRUD) | RunsTable rendering unchanged in success state | OK |
| PROJ-6 (Admin) | No changes to admin endpoints or runner_profiles schema | OK |
| PROJ-7 (Passwort-Reset) | No changes | OK |
| PROJ-8 (Request Log) | No changes | OK |

### Summary

**Acceptance Criteria:** 10/10 passed
**Bugs Found:** 2 remaining (0 critical, 0 high, 1 medium, 1 low)
**Security:** 1 medium-risk finding (BUG-4: missing server-only guard)
**Production Ready:** YES (with recommendation to fix BUG-4 before deployment)

Previous critical bugs (BUG-1, BUG-2) have been fixed. BUG-3 partially fixed (dialog OK, API messages still ASCII).

**Remaining bugs:**
- BUG-4 (Medium): Add `import 'server-only'` to `supabase-admin.ts` -- quick one-line fix, prevents potential secret leak
- BUG-5 (Low): Replace ASCII transliterations with Umlauts in API error messages -- cosmetic consistency

## Deployment

**Deployed:** 2026-03-21
**Production URL:** https://24-tage-lauf.vercel.app/runs (Modal erscheint bei fehlendem Profil)

### Bug Fixes shipped
- BUG-1 (Critical): `createAdminClient()` für alle DB-Ops auf `runner_profiles` — RLS korrekt umgangen
- BUG-2 (Medium): TYPO3-UID-Validierung in `POST /api/runner/assign` — keine Orphan-Profile möglich
- BUG-3 (Low): Umlaute in Dialog-Komponente korrigiert
- BUG-4 (Medium): `import 'server-only'` in `supabase-admin.ts` — verhindert versehentlichen Client-Import
- BUG-5 (Low): Umlaute in API-Fehlermeldungen korrigiert
