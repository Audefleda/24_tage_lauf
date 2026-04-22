# PROJ-5: Strava-Webhook-Integration

## Status: Deployed
**Created:** 2026-03-17
**Last Updated:** 2026-04-22

## Dependencies
- Requires: PROJ-1 (API-Konfiguration & Superuser-Authentifizierung)
- Requires: PROJ-2 (Anmeldung — Supabase Auth, User-ID für Token-Speicherung)
- Requires: PROJ-4 (Läufe-Verwaltung CRUD — TYPO3-Update-Logik muss vorhanden sein)

## User Stories
- Als Läufer möchte ich meinen Strava-Account mit der App verbinden, damit meine Läufe automatisch übertragen werden.
- Als Läufer möchte ich den Strava-Sync deaktivieren können, wenn ich ihn nicht mehr brauche.
- Als Läufer möchte ich auf der Runs-Seite sehen, ob mein Strava-Account verbunden ist und wann der letzte Lauf automatisch übertragen wurde.
- Als Administrator möchte ich den globalen Strava-Webhook einmalig registrieren, damit alle verbundenen Läufer Events empfangen können.

## Acceptance Criteria
- [ ] **AC-1:** Auf der Runs-Seite gibt es unterhalb der Laufliste einen "Strava"-Bereich
- [ ] **AC-2:** Der Strava-Bereich zeigt: Verbindungsstatus (verbunden / nicht verbunden), Zeitpunkt der letzten automatischen Synchronisierung (oder "noch nicht synchronisiert"), Button zum Verbinden (startet OAuth-Flow) oder Trennen der Verbindung
- [ ] **AC-3:** Nach Klick auf "Strava verbinden" wird der Nutzer zum Strava-OAuth-Flow weitergeleitet; nach erfolgreicher Autorisierung werden `access_token`, `refresh_token` und `athlete_id` in Supabase gespeichert
- [ ] **AC-4:** Ein abgelaufener Strava-Access-Token wird automatisch über den gespeicherten `refresh_token` erneuert, bevor Aktivitätsdetails abgerufen werden
- [ ] **AC-5:** Wenn Strava ein Webhook-Event vom Typ `create` für ein Objekt vom Typ `activity` sendet, werden die Aktivitätsdetails über die Strava API abgerufen
- [ ] **AC-6:** Aktivitäten werden nur verarbeitet, wenn der Typ in der erlaubten Liste ist: `Run`, `TrailRun`, `VirtualRun`, `Hike`, `Walk`
- [ ] **AC-7:** Aus den Aktivitätsdetails werden `start_date` (→ Datum des Laufs) und `distance` (Meter → km, auf 2 Dezimalstellen gerundet) extrahiert und via `/api/runner/runs` in TYPO3 eingetragen
- [ ] **AC-8:** Das Eintragen in TYPO3 durch den Webhook läuft über die bestehende `PUT /api/runner/runs`-Logik (alle Läufe des Nutzers werden ersetzt — wie bei manuellem Eintrag)
- [ ] **AC-9:** Webhook-Events für Nutzer ohne aktive Strava-Verbindung oder ohne zugeordneten TYPO3-Läufer werden stillschweigend ignoriert (HTTP 200, kein Fehler)
- [ ] **AC-10:** Der Webhook-Endpunkt `GET /api/strava/webhook` beantwortet Strava-Verification-Requests korrekt (Hub Challenge)
- [ ] **AC-11:** Die Admin-Seite hat einen Bereich zum einmaligen Registrieren der globalen Webhook-Subscription bei Strava (einmalig, nicht pro Nutzer)
- [ ] **AC-12:** Strava API-Credentials (`STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_VERIFY_TOKEN`) sind als Env-Variablen konfigurierbar

## Edge Cases
- Was passiert, wenn Strava den Webhook nicht zustellen kann (Timeout)? → Strava wiederholt automatisch. Der Endpunkt prüft, ob sich die Kilometerzahl für den Tag geändert hat — bei unveränderter Distanz wird weder geschrieben noch benachrichtigt.
- Was passiert, wenn Strava mehrfach auslöst (z.B. Titel-Edit)? → Kilometerzahl wird mit bestehendem Lauf verglichen. Nur bei tatsächlicher Änderung wird TYPO3 aktualisiert und Teams benachrichtigt.
- Was passiert, wenn der Aktivitätstyp nicht in der erlaubten Liste ist? → Event wird ignoriert (HTTP 200, kein Lauf eingetragen)
- Was passiert, wenn die Strava API die Aktivitätsdetails nicht zurückgibt (Fehler)? → Fehler wird geloggt, TYPO3 bleibt unverändert
- Was passiert, wenn TYPO3 den automatisch eingetragenen Lauf ablehnt? → Fehler wird im TYPO3-Request-Log (PROJ-8) erfasst
- Was passiert, wenn der Läufer Strava trennt? → `access_token` und `refresh_token` werden aus Supabase gelöscht; zukünftige Events für diesen Athlete werden ignoriert
- Was passiert, wenn zwei Nutzer denselben Strava-Account verbinden? → Sollte durch UI verhindert werden (unique constraint auf `athlete_id` in DB)
- Was passiert, wenn `update`- oder `delete`-Events von Strava eingehen? → Werden ignoriert (nur `create`-Events lösen TYPO3-Updates aus)

## Debug-Logging (PROJ-12)
Bei aktiviertem `LOG_LEVEL=debug` werden folgende Ausgaben erzeugt:
- OAuth-Flow gestartet (User-ID, OAuth-URL ohne Client Secret)
- OAuth-Callback empfangen (Athlete-ID, gewährte Scopes)
- Token-Refresh ausgelöst (User-ID, verbleibende Sekunden bis Ablauf)
- Token-Refresh erfolgreich (neue `expires_at`)
- Webhook-Event empfangen (vollständiger Body)
- Aktivitätsdetails abgerufen (Activity-ID, Typ, Distanz in Metern, Datum)
- Aktivitätstyp ignoriert (Typ, Grund)
- Webhook-Event vollständig verarbeitet (Activity-ID, eingetragene Distanz in km)
- Webhook-Event ignoriert (Grund: kein User gefunden, kein TYPO3-Profil, nicht erlaubter Typ)

## Technical Requirements

### Neue Supabase-Tabelle: `strava_connections`
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → auth.users) | Supabase User |
| `athlete_id` | bigint (unique) | Strava Athlete ID |
| `access_token` | text | Strava Access Token (kurzlebig) |
| `refresh_token` | text | Strava Refresh Token (langlebig) |
| `token_expires_at` | timestamptz | Ablaufzeit des Access Tokens |
| `last_synced_at` | timestamptz | Zeitpunkt der letzten erfolgreichen Synchronisierung |
| `created_at` | timestamptz | |

### Neue API-Routen
- `GET /api/strava/connect` — Startet OAuth-Flow (Redirect zu Strava)
- `GET /api/strava/callback` — Empfängt OAuth-Code, tauscht gegen Tokens, speichert in Supabase
- `DELETE /api/strava/connect` — Löscht Strava-Verbindung des aktuellen Nutzers
- `GET /api/strava/webhook` — Strava Hub Challenge Verification (öffentlich, kein Auth)
- `POST /api/strava/webhook` — Empfängt Strava-Events (öffentlich, mit `verify_token` validiert)
- `POST /api/admin/strava/register-webhook` — Einmalige Webhook-Registrierung bei Strava (Admin only)

### Neue UI-Komponenten
- `strava-connect-section.tsx` — Bereich unterhalb der Laufliste auf der Runs-Seite: Status, letzter Sync, Connect/Disconnect-Button

### Env-Variablen (neu)
```
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
STRAVA_VERIFY_TOKEN=...   # Selbst gewählter String zur Webhook-Verifizierung
```

### Daten-Mapping: Strava → TYPO3
| Strava-Feld | Transformation | TYPO3-Feld |
|-------------|----------------|------------|
| `start_date` | ISO 8601 → `YYYY-MM-DD` | `runDate` |
| `distance` | Meter ÷ 1000, auf 2 Dezimalstellen | `runDistance` (km, als String) |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Zwei unabhängige Flows

**Flow 1: Nutzer verbindet Strava (einmalig)**
Läufer → "Strava verbinden" → Strava OAuth → `/api/strava/callback` → Supabase speichert Tokens

**Flow 2: Automatischer Lauf-Eintrag (dauerhaft)**
Strava → `POST /api/strava/webhook` → Strava API (Aktivitätsdetails) → TYPO3 updateruns

### Komponenten-Struktur

```
src/app/runs/page.tsx (bestehend, erweitert)
└── StravaConnectSection (NEU: unterhalb RunsTable)
    ├── Strava-Icon + Titel "Strava"
    ├── Badge: "Verbunden" (grün) / "Nicht verbunden" (grau)
    ├── Text: "Zuletzt synchronisiert: [Datum]" oder "Noch nicht synchronisiert"
    └── Button: "Strava verbinden" → startet OAuth
                "Strava trennen" → Verbindung löschen (mit Bestätigungs-Dialog)

src/app/admin/page.tsx (bestehend, erweitert)
└── Strava-Webhook-Setup-Bereich (NEU)
    ├── Status: "Webhook registriert" / "Nicht registriert"
    └── Button: "Webhook bei Strava registrieren" (einmalig)
```

### Neue API-Routen

| Route | Zweck | Auth |
|-------|-------|------|
| `GET /api/strava/connect` | Leitet zu Strava OAuth weiter | Eingeloggt |
| `GET /api/strava/callback` | Empfängt OAuth-Code, speichert Tokens | Öffentlich (Strava-Redirect) |
| `DELETE /api/strava/connect` | Löscht Verbindung des aktuellen Nutzers | Eingeloggt |
| `GET /api/strava/status` | Verbindungsstatus + letzter Sync | Eingeloggt |
| `GET /api/strava/webhook` | Strava Hub Challenge Verification | Öffentlich |
| `POST /api/strava/webhook` | Empfängt Aktivitäts-Events | Öffentlich (verify_token) |
| `POST /api/admin/strava/register-webhook` | Globalen Webhook einmalig registrieren | Admin only |

### Neue Supabase-Tabelle: `strava_connections`

RLS: Jeder Nutzer sieht nur seine eigene Zeile. Webhook-Endpunkt verwendet Admin-Client.

### Webhook-Verarbeitungs-Ablauf (Flow 2)

1. Strava sendet `POST /api/strava/webhook` mit `object_type=activity`, `aspect_type=create`
2. `verify_token` prüfen → sonst 403
3. Nutzer anhand `owner_id` (Strava Athlete-ID) in `strava_connections` suchen
4. Nutzer hat TYPO3-Profil? Sonst: HTTP 200, ignorieren
5. Access-Token abgelaufen? → Refresh via Strava Token-Endpoint
6. Aktivitätsdetails via Strava API abrufen
7. Typ prüfen (Run/TrailRun/VirtualRun/Hike/Walk) → sonst ignorieren
8. Alle bestehenden Läufe aus TYPO3 laden, neuen anhängen, komplette Liste zurückschreiben
9. `last_synced_at` in DB aktualisieren
10. Immer HTTP 200 zurück (Strava-Anforderung — sonst endlose Retries)

### Technische Entscheidungen

| Entscheidung | Grund |
|---|---|
| Tokens in Supabase (nicht Env) | Jeder Nutzer hat eigene Tokens |
| `verify_token` validiert Webhook | Nur Strava kann echte Events senden |
| Immer HTTP 200 vom Webhook | Strava-Anforderung — Fehler intern geloggt |
| Bestehende TYPO3-Logik wiederverwenden | PROJ-8-Logging greift automatisch |
| Kein Strava-SDK | Native `fetch` genügt, keine externe Abhängigkeit |

### Neue Env-Variablen
- `STRAVA_CLIENT_ID` — Strava App Client ID
- `STRAVA_CLIENT_SECRET` — Strava App Client Secret
- `STRAVA_VERIFY_TOKEN` — Selbst gewählter Verifikations-String

## QA Test Results

**Tested:** 2026-03-23
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Code review + build verification (no live Strava sandbox available)

### Acceptance Criteria Status

#### AC-1: Strava-Bereich unterhalb der Laufliste auf der Runs-Seite
- [x] `StravaConnectSection` component exists and is rendered at the bottom of `/runs` page (line 160 of `src/app/runs/page.tsx`)
- [x] Wrapped in a Card with Strava icon and title

#### AC-2: Strava-Bereich zeigt Verbindungsstatus, letzter Sync, Connect/Disconnect-Button
- [x] Shows "Verbunden" (green badge) or "Nicht verbunden" (secondary badge) based on `/api/strava/status` response
- [x] Shows "Zuletzt synchronisiert: [Datum]" or "Noch nicht synchronisiert"
- [x] "Strava verbinden" button visible when not connected (orange Strava brand color)
- [x] "Strava trennen" button visible when connected (with confirmation dialog)

#### AC-3: OAuth-Flow speichert access_token, refresh_token, athlete_id
- [x] `GET /api/strava/connect` redirects to Strava OAuth URL with correct params (client_id, redirect_uri, scope)
- [x] `GET /api/strava/callback` exchanges code for tokens via Strava API
- [x] Tokens are stored in `strava_connections` table via upsert
- [ ] BUG-1: Upsert uses `onConflict: 'user_id'` but `user_id` has no UNIQUE constraint in the migration (see BUG-1 below)
- [ ] BUG-2: No OAuth `state` parameter for CSRF protection (see BUG-2 below)

#### AC-4: Abgelaufener Access-Token wird automatisch erneuert
- [x] `getValidAccessToken()` checks `token_expires_at` with 5-minute buffer
- [x] If expired, calls `refreshStravaToken()` which hits Strava's token endpoint
- [x] New tokens are persisted to `strava_connections` in the webhook handler

#### AC-5: Webhook empfaengt create-Events und ruft Aktivitaetsdetails ab
- [x] `POST /api/strava/webhook` parses body for `object_type=activity` and `aspect_type=create`
- [x] Looks up user via `athlete_id` in `strava_connections`
- [x] Calls `fetchStravaActivity()` with valid access token

#### AC-6: Nur erlaubte Aktivitaetstypen werden verarbeitet
- [x] `ALLOWED_ACTIVITY_TYPES` Set contains: Run, TrailRun, VirtualRun, Hike, Walk
- [x] Activity type checked after fetching details; non-matching types are silently ignored

#### AC-7: start_date und distance korrekt extrahiert und an TYPO3 weitergegeben
- [x] `start_date` extracted via `.split('T')[0]` to get YYYY-MM-DD format
- [x] `distance` converted from meters to km via `(distance / 1000).toFixed(2)`
- [x] Mapped to `runDate` and `runDistance` fields matching TYPO3 schema

#### AC-8: Webhook nutzt bestehende PUT /api/runner/runs Logik
- [x] Webhook uses shared `fetchRunnerRuns()` and `updateRunnerRuns()` from `src/lib/typo3-runs.ts`
- [x] Same TYPO3 update logic as manual run entry (complete replacement of all runs)
- [x] TYPO3 request logging (PROJ-8) automatically applies via `logTypo3Request()`

#### AC-9: Events fuer Nutzer ohne Strava-Verbindung oder ohne TYPO3-Profil werden ignoriert
- [x] If no `strava_connections` row for athlete_id: returns HTTP 200, no processing
- [x] If no `runner_profiles` row for user_id: returns HTTP 200, no processing

#### AC-10: GET /api/strava/webhook beantwortet Hub Challenge korrekt
- [x] Checks `hub.mode === 'subscribe'` and `hub.verify_token` matches env var
- [x] Returns `{ "hub.challenge": "<challenge>" }` on success
- [x] Returns 403 on verification failure

#### AC-11: Admin-Seite hat Webhook-Registrierungs-Bereich
- [x] `StravaWebhookSetup` component rendered on `/admin` page
- [x] Shows "Webhook aktiv" / "Nicht registriert" status
- [x] "Webhook bei Strava registrieren" button (only when not registered)
- [x] Prevents double registration (API returns 409 if already registered)

#### AC-12: Strava API-Credentials als Env-Variablen konfigurierbar
- [x] `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_VERIFY_TOKEN` read from `process.env`
- [x] All three documented in `.env.local.example` with dummy values and instructions
- [x] None use `NEXT_PUBLIC_` prefix (server-only, not exposed to browser)

### Edge Cases Status

#### EC-1: Doppelte Webhook-Events (Strava Retry)
- [x] Handled correctly: endpoint is idempotent, runs are re-fetched and re-written (last state wins)
- [x] Per-user mutex (`processWithLock`) prevents race conditions from concurrent events for the same user

#### EC-2: Nicht erlaubter Aktivitaetstyp
- [x] Handled correctly: returns HTTP 200, no run created

#### EC-3: Strava API gibt Fehler zurueck
- [x] Handled correctly: error is caught and logged, HTTP 200 returned to Strava

#### EC-4: TYPO3 lehnt automatischen Lauf ab
- [x] Handled correctly: `updateRunnerRuns` logs via PROJ-8 request log, error is caught in webhook handler

#### EC-5: Laefer trennt Strava
- [x] `DELETE /api/strava/connect` deletes `strava_connections` row
- [x] Future events for that athlete_id will be silently ignored (no connection found)

#### EC-6: Zwei Nutzer verbinden denselben Strava-Account
- [x] `athlete_id` has UNIQUE constraint in database migration
- [ ] BUG-3: Callback upserts on `user_id` conflict, not `athlete_id`. If user B tries to connect an athlete_id already used by user A, the DB unique constraint on `athlete_id` will throw an error, but the error message shown to the user will be generic "Fehler beim Verbinden mit Strava" (see BUG-3 below)

#### EC-7: update/delete Events von Strava
- [x] Handled correctly: only `aspect_type === 'create'` is processed, all others return HTTP 200

### Security Audit Results

- [x] Authentication on /api/strava/connect (GET, DELETE): Verified, checks `supabase.auth.getUser()`
- [x] Authentication on /api/strava/status: Verified, checks `supabase.auth.getUser()`
- [x] Admin-only on /api/admin/strava/register-webhook: Verified via `requireAdmin()` + middleware admin check
- [x] Webhook endpoint public but validated: subscription_id checked against stored value in `app_settings`
- [x] Hub challenge verification: `STRAVA_VERIFY_TOKEN` checked before responding
- [x] RLS on strava_connections: Users can only CRUD their own rows via `auth.uid()` policies
- [x] app_settings has RLS enabled with no user policies (service role only)
- [x] Strava tokens stored server-side only, never exposed in API responses (status endpoint returns only `athlete_id` and `last_synced_at`)
- [x] Secrets not exposed: STRAVA_CLIENT_SECRET and tokens never sent to browser
- [x] Middleware correctly marks /api/strava/webhook and /api/strava/callback as public routes
- [ ] BUG-2: OAuth callback has no CSRF protection (no `state` parameter)
- [ ] BUG-4: No rate limiting on Strava connect/disconnect endpoints
- [ ] BUG-5: Webhook POST handler does not validate request body schema with Zod

### Cross-Browser Testing
Not applicable for this feature: all new UI components (`StravaConnectSection`, `StravaWebhookSetup`) use standard shadcn/ui components (Card, Badge, Button, AlertDialog, Alert, Skeleton) which are already cross-browser tested. No custom CSS or browser-specific APIs used.

### Responsive Testing
- [x] `StravaConnectSection` uses `flex-wrap` layout, which adapts to narrow screens
- [ ] BUG-6: On 375px mobile width, the "Strava verbinden" / "Strava trennen" button uses `ml-auto` which may push it off-screen or create awkward layout when badge + text + button are on a single flex row

### Bugs Found

#### BUG-1: Upsert onConflict targets non-unique column `user_id`
- **Severity:** Critical
- **File:** `src/app/api/strava/callback/route.ts` line 46
- **Steps to Reproduce:**
  1. User connects Strava account via OAuth flow
  2. Callback calls `.upsert({...}, { onConflict: 'user_id' })`
  3. Expected: Upsert succeeds, replacing existing connection for this user
  4. Actual: PostgreSQL requires a UNIQUE index on the conflict target. `user_id` has no UNIQUE constraint in the migration (`supabase/migrations/20260322_create_strava_tables.sql`). The upsert will fail with a database error, and the user will be redirected to `/runs?strava=error`.
- **Fix:** Either add a UNIQUE constraint on `user_id` in the migration, or change the onConflict target to use a unique index. Since a user should only have one Strava connection, adding `UNIQUE` on `user_id` is the correct fix.
- **Priority:** Fix before deployment

#### BUG-2: OAuth flow lacks CSRF protection (no `state` parameter)
- **Severity:** High
- **File:** `src/lib/strava.ts` (getStravaOAuthUrl) + `src/app/api/strava/callback/route.ts`
- **Steps to Reproduce:**
  1. Attacker crafts a URL: `/api/strava/callback?code=ATTACKER_STRAVA_CODE`
  2. Victim clicks the link while logged in
  3. Expected: The app should reject the callback because it was not initiated by the victim
  4. Actual: The app exchanges the code for tokens and connects the attacker's Strava account to the victim's profile. The attacker can then trigger webhook events that modify the victim's TYPO3 runs.
- **Mitigation:** Add a `state` parameter to `getStravaOAuthUrl()` (e.g., a random string stored in the user's session/cookie). Validate it in the callback. This is the standard OAuth 2.0 CSRF protection.
- **Priority:** Fix before deployment

#### BUG-3: No user-friendly error when athlete_id already connected by another user
- **Severity:** Medium
- **File:** `src/app/api/strava/callback/route.ts` lines 35-51
- **Steps to Reproduce:**
  1. User A connects Strava athlete 12345
  2. User B tries to connect the same Strava athlete 12345
  3. Expected: Clear error message like "Dieser Strava-Account ist bereits mit einem anderen Nutzer verbunden"
  4. Actual: The UNIQUE constraint on `athlete_id` will cause a database error. The generic catch block redirects to `/runs?strava=error` with no specific message.
- **Priority:** Fix in next sprint

#### BUG-4: No rate limiting on Strava connect/disconnect endpoints
- **Severity:** Medium
- **File:** `src/app/api/strava/connect/route.ts`
- **Description:** The `/api/strava/connect` (GET and DELETE) endpoints have no rate limiting. A malicious or buggy client could rapidly trigger OAuth redirects or disconnect requests. The project has a `rateLimit` utility (`src/lib/rate-limit.ts`) that is already used by other endpoints but not applied here.
- **Priority:** Fix in next sprint

#### BUG-5: Webhook POST body not validated with Zod
- **Severity:** Low
- **File:** `src/app/api/strava/webhook/route.ts`
- **Description:** Per security rules (`.claude/rules/security.md`): "Validate ALL user input on the server side with Zod." The webhook POST handler uses manual type checking (`body.object_type !== 'activity'`) instead of Zod schema validation. While the current checks are functionally sufficient (unknown fields are simply ignored, and the endpoint always returns 200), this deviates from project conventions.
- **Priority:** Nice to have

#### BUG-6: Mobile layout may overflow on 375px screens
- **Severity:** Low
- **File:** `src/components/strava-connect-section.tsx` lines 147-195
- **Description:** The flex layout with `ml-auto` on the action button may cause horizontal overflow on very narrow screens (375px). When the badge, sync text, and button are all in one flex row with `flex-wrap`, the button may wrap to a new line but remain right-aligned with `ml-auto`, leaving wasted space on the left.
- **Priority:** Nice to have

### Summary
- **Acceptance Criteria:** 11/12 passed (AC-3 partially failed due to BUG-1 and BUG-2)
- **Bugs Found:** 6 total (1 critical, 1 high, 2 medium, 2 low)
- **Security:** Issues found (BUG-2 OAuth CSRF, BUG-4 no rate limiting)
- **Build:** PASS (project builds successfully with no errors)
- **Production Ready:** NO
- **Recommendation:** Fix BUG-1 (critical, upsert will fail) and BUG-2 (high, OAuth CSRF) before deployment. BUG-3 and BUG-4 should be addressed in the next sprint.

## Deployment
_To be added by /deploy_
