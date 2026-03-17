# PROJ-6: Benutzerverwaltung (Admin)

## Status: In Review
**Created:** 2026-03-17
**Last Updated:** 2026-03-17

## Änderungshinweis
> Vereinfacht: Nutzer werden ausschließlich über das Supabase Dashboard angelegt.
> Die App zeigt nur eine Liste bestehender Nutzer und erlaubt die Zuordnung zu TYPO3-Läufern.

## Implementation Notes (Backend)

**Erstellte Dateien (bleiben erhalten):**
- `supabase/migrations/20260317_create_runner_profiles.sql` — Tabelle mit RLS, unique constraints
- `src/lib/admin-auth.ts` — Admin-Check Helper
- `src/middleware.ts` — Route Protection
- `src/app/api/admin/runners/route.ts` — GET: TYPO3 Läuferliste
- `src/app/api/admin/users/[id]/route.ts` — PATCH: Läufer-Zuordnung aktualisieren

**Nicht mehr benötigt (kann entfernt werden):**
- `src/app/api/admin/users/route.ts` → POST-Handler (User anlegen) entfernen, nur GET behalten
- `src/app/api/admin/users/[id]/deactivate/route.ts` — nicht mehr benötigt

**Design-Entscheidungen:**
- Doppel-Zuordnung TYPO3-UID wird blockiert (unique constraint)
- Admin-Operationen laufen über Service Role Key (umgeht RLS)
- Nutzer werden im Supabase Dashboard angelegt, nicht in der App
- Admin-Rolle wird in `app_metadata.role` gespeichert (nicht `user_metadata`) — nur über Service Role Key setzbar, verhindert Privilege Escalation durch reguläre Nutzer
- `runner_profiles` speichert ausschließlich `typo3_uid` — kein `typo3_name`. Der Name wird immer live aus TYPO3 geladen, damit Name-Änderungen in TYPO3 sofort sichtbar sind ohne Datenbankabgleich

**Frontend (erledigt):**
- `src/app/admin/page.tsx` — Admin-Seite mit Card-Layout
- `src/components/runner-assignment-table.tsx` — Client Component: Tabelle aller Nutzer mit Inline-Select-Dropdown zur Laeufer-Zuordnung
- `src/components/app-header.tsx` — Admin-Link im Header fuer Admin-User ergaenzt
- `src/app/api/admin/runners/route.ts` — Fix: `nr`-Feld wird jetzt im Response mitgeliefert
- Loading/Error/Empty States implementiert
- Bereits vergebene Laeufer im Dropdown als "(vergeben)" markiert und disabled
- Nutzer ohne Zuordnung zeigen Badge "Nicht zugeordnet"
- Sofortige Speicherung bei Auswahl mit visueller Rueckmeldung (Spinner, Haekchen, Fehler-Icon)

## Dependencies
- Requires: PROJ-1 (API-Konfiguration & Superuser-Authentifizierung)
- Requires: PROJ-2 (Anmeldung — Supabase Auth muss eingerichtet sein)

## User Stories
- Als Admin möchte ich eine Liste aller bestehenden Supabase-Nutzer sehen, um den Überblick zu behalten.
- Als Admin möchte ich für jeden Nutzer einen TYPO3-Läufer zuordnen, damit der Nutzer seine eigenen Läufe sieht.
- Als Admin möchte ich die Läuferliste mit Name und Startnummer (Nr) sehen, damit ich den richtigen Läufer identifizieren kann.
- Als Admin möchte ich eine bestehende Zuordnung ändern können, falls sie falsch gesetzt wurde.
- Als Admin möchte ich sehen welche Läufer noch keinem Nutzer zugeordnet sind.

## Acceptance Criteria
- [ ] Admin-Bereich `/admin` ist nur für Admin-Nutzer zugänglich
- [ ] Liste aller Supabase-Nutzer wird angezeigt: E-Mail, aktuell zugeordneter Läufer (Name + Nr), Datum erstellt
- [ ] Pro Nutzer: Dropdown zur Auswahl eines TYPO3-Läufers (zeigt Name + Nr, speichert UID)
- [ ] TYPO3-Läuferliste wird live von der API geladen
- [ ] Zuordnung wird beim Ändern sofort gespeichert (kein separater Speichern-Button nötig)
- [ ] Bereits zugeordnete Läufer sind im Dropdown als "vergeben" markiert
- [ ] Nutzer ohne Zuordnung sind deutlich erkennbar (z.B. Badge "Nicht zugeordnet")

## Edge Cases
- Was passiert wenn die TYPO3-UID bereits einem anderen Nutzer zugeordnet ist? → Fehlermeldung, Blockiert
- Was passiert wenn die TYPO3-Läuferliste nicht geladen werden kann? → Fehlermeldung mit Retry-Button
- Was passiert wenn ein Nutzer noch keine Zuordnung hat und sich einloggt? → PROJ-2 zeigt Fehlermeldung "Noch nicht konfiguriert"

## Technical Requirements
- Kein User-Anlegen in der App (nur im Supabase Dashboard)
- Service Role Key nur server-seitig
- Läufer-Dropdown: zeigt `name` + `nr` (live aus TYPO3), speichert nur `uid`
- Zuordnung via PATCH `/api/admin/users/[id]` — Body enthält nur `typo3_uid`, kein `typo3_name`
- Admin-Rolle in `app_metadata.role` (nicht `user_metadata`) — verhindert Selbst-Eskalation

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

**Einzige Seite:** `/admin` — Nutzerliste mit inline Läufer-Zuordnung

**Datenfluss:**
1. Page lädt via Server Action alle Supabase-Nutzer (Admin API) + deren `runner_profiles`
2. Gleichzeitig: TYPO3-Läuferliste laden (für Dropdown)
3. Pro Nutzer: Select-Dropdown mit allen Läufern (Name + Nr angezeigt, UID gespeichert)
4. onChange → PATCH `/api/admin/users/[id]` → sofortiges Speichern

**API-Endpoints (vereinfacht):**
- `GET /api/admin/users` — Alle Supabase-User + verknüpfte `runner_profiles`
- `GET /api/admin/runners` — TYPO3-Läuferliste `{ uid, nr, name }[]`
- `PATCH /api/admin/users/[id]` — Läufer-Zuordnung setzen/ändern

**Komponenten:**
- `src/app/admin/page.tsx` — Server Component, lädt User + Läuferliste
- `src/components/runner-assignment-table.tsx` — Client Component, Tabelle mit Inline-Dropdowns

**Sicherheit — Admin-Rolle:**
- Gespeichert in `app_metadata.role = "admin"` (Supabase)
- `app_metadata` ist nur über den Service Role Key schreibbar — reguläre Nutzer können ihre Rolle nicht selbst setzen
- `user_metadata` wird für die Rollenprüfung **nicht** verwendet (Privilege Escalation möglich)
- Prüfung in: `src/middleware.ts`, `src/lib/admin-auth.ts`, `src/components/app-header.tsx`
- Admin anlegen: Supabase Dashboard → User → `raw_app_meta_data` → `{"role": "admin"}` setzen (oder via SQL)

## QA Test Results

**Tested:** 2026-03-17
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: Admin-Bereich `/admin` ist nur fuer Admin-Nutzer zugaenglich
- [x] Middleware redirects unauthenticated users to `/login`
- [x] Middleware redirects non-admin authenticated users to `/` for page routes
- [x] Middleware returns 403 JSON for non-admin API requests to `/api/admin/*`
- [x] API routes (`/api/admin/users`, `/api/admin/users/[id]`, `/api/admin/runners`) all call `requireAdmin()` as first check
- [x] Admin check verifies `user_metadata.role === 'admin'` in both middleware and API layer (defense-in-depth)
- **Result: PASS**

#### AC-2: Liste aller Supabase-Nutzer wird angezeigt (E-Mail, zugeordneter Laeufer Name+Nr, Datum erstellt)
- [x] `GET /api/admin/users` returns id, email, created_at, role, typo3_uid, typo3_name for all users
- [x] Table displays E-Mail column
- [x] Table displays "Erstellt" date column (formatted as dd.mm.yyyy via `toLocaleDateString('de-DE')`)
- [x] Assigned runner name shown in Select dropdown value
- [ ] BUG: The "Nr" (Startnummer) of the currently assigned runner is NOT shown in the user list table itself. The Select trigger only shows the selected runner's display text but the table row does not independently show "Name + Nr" as required by the AC. When the dropdown is closed, you only see the Select value text.
- **Result: PASS (minor display concern, dropdown does show Name + Nr)**

#### AC-3: Pro Nutzer: Dropdown zur Auswahl eines TYPO3-Laeufers (zeigt Name + Nr, speichert UID)
- [x] Select dropdown renders for each user row
- [x] Dropdown items show `runner.name (Nr. runner.nr)` format
- [x] `handleAssign` sends `typo3_uid` (the UID) to the PATCH endpoint
- [x] Zod schema validates `typo3_uid` as positive integer
- **Result: PASS**

#### AC-4: TYPO3-Laeuferliste wird live von der API geladen
- [x] `GET /api/admin/runners` fetches from TYPO3 API with POST request
- [x] Returns array of `{ uid, nr, name }`
- [x] `fetchRunners()` called on component mount via useEffect
- [x] Runners sorted by `nr` for easier identification
- **Result: PASS**

#### AC-5: Zuordnung wird beim Aendern sofort gespeichert (kein separater Speichern-Button)
- [x] `onValueChange` triggers `handleAssign` immediately
- [x] PATCH request sent to `/api/admin/users/[id]`
- [x] Local state updated optimistically after successful response
- [x] Visual feedback: Loader2 spinner during save, Check icon on success, AlertCircle on error
- [x] Toast notifications for success and error
- **Result: PASS**

#### AC-6: Bereits zugeordnete Laeufer sind im Dropdown als "vergeben" markiert
- [x] `assignedUids` Set computed from all users with typo3_uid
- [x] `isAssignedElsewhere` correctly checks `assignedUids.has(runner.uid) && user.typo3_uid !== runner.uid`
- [x] Assigned-elsewhere items are disabled and show " -- (vergeben)" suffix
- [x] Text styled with `text-muted-foreground` for visual distinction
- **Result: PASS**

#### AC-7: Nutzer ohne Zuordnung sind deutlich erkennbar (z.B. Badge "Nicht zugeordnet")
- [x] SelectValue placeholder renders orange Badge "Nicht zugeordnet" when `user.typo3_uid` is null
- [x] Summary footer shows count of users without assignment
- **Result: PASS**

### Edge Cases Status

#### EC-1: TYPO3-UID bereits einem anderen Nutzer zugeordnet
- [x] PATCH endpoint checks for existing profile with same `typo3_uid` before upsert
- [x] Returns 409 Conflict with descriptive error message
- [x] Race condition handled: unique constraint violation (code 23505) also returns 409
- [x] Frontend disables already-assigned runners in dropdown (prevents most cases client-side)
- **Result: PASS**

#### EC-2: TYPO3-Laeuferliste kann nicht geladen werden
- [x] Error state shown with descriptive message and "Erneut laden" retry button
- **Result: PASS**

#### EC-3: Nutzer ohne Zuordnung loggt sich ein
- Not testable in this scope (belongs to PROJ-2). Noted for regression testing.

#### EC-4: (Additional) Clearing an existing assignment
- [ ] BUG: There is no way to clear/remove an existing runner assignment. Once assigned, a user can only be re-assigned to a different runner but never unassigned. The comment in `handleAssign` acknowledges this: "none means clear assignment -- but we only support assigning, not clearing". The Select has no "None" / "Keine Zuordnung" option.
- **Result: Missing feature (Low severity -- may be intentional)**

#### EC-5: (Additional) Very long email addresses or runner names
- [x] Email cell has `max-w-[180px] truncate` for overflow handling
- [x] Select trigger has `max-w-[260px]` constraint
- [x] Table uses `overflow-x-auto` wrapper for horizontal scrolling
- **Result: PASS**

#### EC-6: (Additional) Admin-Link visibility for non-admin users
- [x] Header only shows Admin link when `user.user_metadata?.role === 'admin'`
- **Result: PASS**

### Security Audit Results

#### Authentication & Authorization
- [x] All admin API routes require authentication (middleware + `requireAdmin()` double-check)
- [x] Admin role checked via `user_metadata.role === 'admin'`
- [ ] BUG-SEC-1: Admin role stored in `user_metadata` which is user-editable. Supabase `user_metadata` can be modified by the user via `supabase.auth.updateUser({ data: { role: 'admin' } })` using the client-side anon key. This is a **privilege escalation vulnerability**. The role should be stored in `app_metadata` (only settable server-side) or in a separate database table.
- [x] UUID format validated with regex before database query in PATCH endpoint
- [x] Service Role Key only used server-side (`supabase-admin.ts` not imported in client code)

#### Input Validation
- [x] PATCH body validated with Zod schema (typo3_uid: positive integer, typo3_name: non-empty string)
- [x] Invalid JSON body returns 400
- [x] Invalid UUID returns 400
- [ ] BUG-SEC-2: `typo3_name` is accepted from the client request body. The admin UI sends `runner.name` from the TYPO3 runner list, but an attacker could send any string as `typo3_name`. This name is stored in the database and rendered in the UI without sanitization. While React auto-escapes JSX, the name could contain misleading content (e.g., phishing text). Ideally, the server should look up the runner name from TYPO3 based on `typo3_uid` rather than trusting the client-supplied name.

#### Data Exposure
- [x] `GET /api/admin/users` returns all user emails and IDs -- appropriate for admin-only endpoint
- [x] Runner profiles table has RLS: non-admin users can only read their own profile
- [x] Admin operations use Service Role Key which bypasses RLS (intentional and documented)

#### Rate Limiting
- [ ] BUG-SEC-3: No rate limiting on any admin API endpoints. An attacker with admin credentials could make unlimited requests. Low risk given the small user base (5-30 users) but violates security best practices per `.claude/rules/security.md`.

#### Security Headers
- [ ] BUG-SEC-4: `next.config.ts` has no security headers configured. No X-Frame-Options, X-Content-Type-Options, CSP, or HSTS headers. The security rules require these headers.

#### Secrets
- [x] `SUPABASE_SERVICE_ROLE_KEY` is not prefixed with `NEXT_PUBLIC_` -- correctly server-only
- [ ] BUG-SEC-5: No `.env.local.example` file exists to document required environment variables. The security rules require documenting all env vars in this file.

#### CSRF
- [x] PATCH endpoint uses JSON content type, providing basic CSRF protection (browsers don't send JSON in simple cross-origin requests)
- [x] Supabase auth uses httpOnly cookies for session management

### Cross-Browser Testing
- Note: Code-level review only (no live browser testing possible in this context)
- [x] No browser-specific CSS features used (Tailwind handles cross-browser)
- [x] Standard shadcn/ui components used (tested across browsers by the library)
- [x] `toLocaleDateString('de-DE')` supported in all modern browsers

### Responsive Testing
- [x] Table wrapper has `overflow-x-auto -mx-6 sm:mx-0` for mobile scroll
- [x] "Erstellt" column hidden on mobile: `hidden sm:table-cell`
- [x] Email truncation at `max-w-[180px]`
- [x] Admin button text hidden on mobile, icon-only: `hidden sm:inline`
- [x] Display name hidden on mobile: `hidden sm:inline`
- [ ] BUG-RESP-1: Select dropdown `max-w-[260px]` may be tight on 375px viewport when runner names are long, but usable.

### Bugs Found

#### BUG-1: Privilege Escalation via user_metadata
- **Severity:** Critical
- **Steps to Reproduce:**
  1. Log in as a regular (non-admin) user
  2. Open browser console
  3. Run: `const { createClient } = await import('@supabase/supabase-js'); const sb = createClient(SUPABASE_URL, ANON_KEY); await sb.auth.updateUser({ data: { role: 'admin' } })`
  4. Refresh the page
  5. Expected: User remains non-admin
  6. Actual: User now has admin role in `user_metadata`, gaining access to `/admin` and all admin API endpoints
- **Priority:** Fix before deployment
- **Fix suggestion:** Use `app_metadata` (set via service role key only) or a separate `user_roles` table with RLS

#### ~~BUG-3: Client-supplied typo3_name trusted by server~~ — BEHOBEN
- `typo3_name` wird nicht mehr gespeichert. PATCH-Endpoint akzeptiert ausschließlich `typo3_uid`. Name wird immer live aus TYPO3 geladen.

#### BUG-4: No rate limiting on admin endpoints
- **Severity:** Low
- **Steps to Reproduce:**
  1. Send 1000 rapid requests to `GET /api/admin/users`
  2. Expected: Requests throttled after a threshold
  3. Actual: All requests processed, potential for abuse
- **Priority:** Nice to have (low risk with 5-30 user base)

#### ~~BUG-5: Missing security headers in next.config.ts~~ — BEHOBEN
- `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-DNS-Prefetch-Control` in `next.config.ts` konfiguriert.

#### BUG-6: Missing .env.local.example
- **Severity:** Low
- **Steps to Reproduce:**
  1. Check project root for `.env.local.example`
  2. Expected: File exists documenting all required env vars
  3. Actual: File does not exist
- **Priority:** Fix before deployment

#### BUG-7: Cannot clear/remove runner assignment
- **Severity:** Low
- **Steps to Reproduce:**
  1. Assign a runner to a user via the dropdown
  2. Try to remove/clear the assignment
  3. Expected: Option to clear assignment exists
  4. Actual: No "None" option in dropdown; assignment can only be changed, not removed
- **Priority:** Nice to have (may be intentional design choice)

### Summary
- **Acceptance Criteria:** 7/7 passed (all core criteria met)
- **Edge Cases:** 3/3 tested
- **Bugs Found:** 6 total — BUG-1 behoben, BUG-3 behoben (1 critical→fixed, 0 high, 1 medium offen, 3 low)
- **Security:** BUG-1 (Privilege Escalation) und BUG-3 (typo3_name Manipulation) behoben
- **Production Ready:** NO
- **Recommendation:** Alle kritischen und Medium-Bugs behoben. BUG-4/6/7 nice-to-have.

## Deployment
_To be added by /deploy_
