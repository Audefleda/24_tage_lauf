# PROJ-23: Externer Webhook-Token (Make.com / Zapier Alternative)

## Status: Deployed
**Created:** 2026-04-03
**Last Updated:** 2026-04-03

### Implementation Notes (Frontend + Backend)
- Created `ExternalWebhookSection` component (`src/components/external-webhook-section.tsx`) following the same Card pattern as `StravaConnectSection`
- Integrated into runs page below the Strava section
- Created API routes: `GET/POST/DELETE /api/runner/webhook-token` for token management (session-authenticated)
- Created API route: `POST /api/webhook/external` for external webhook calls (Bearer token auth, rate-limited)
- Created Supabase migration `20260403001_create_external_webhook_tokens.sql` with RLS policies
- Token generation uses Node.js `crypto.randomBytes(32)` (64 hex chars), stored as SHA-256 hash
- Token is displayed once after generation in an AlertDialog with copy button and reveal/hide toggle
- Regeneration requires confirmation dialog warning about old token invalidation
- Instructions section shows webhook URL (derived from `window.location.origin`), header format, and example body
- External webhook endpoint validates with Zod, uses admin client for token lookup, reuses `fetchRunnerRuns` + `updateRunnerRuns` from `typo3-runs.ts`
- Teams notification triggered via `after()` for non-blocking execution
- TYPO3 request logging automatic via `updateRunnerRuns`

## Dependencies
- Requires: PROJ-2 (Anmeldung — Supabase Auth, User-ID für Token-Speicherung)
- Requires: PROJ-4 (Läufe-Verwaltung CRUD — TYPO3-Update-Logik muss vorhanden sein)
- Ergänzt: PROJ-5 (Strava-Webhook-Integration — beide Methoden koexistieren parallel)

## Kontext

PROJ-5 setzt eine bei Strava genehmigte App voraus. Falls Strava die App nicht freigibt, bietet PROJ-23 eine alternative Lösung: Jeder Läufer richtet selbst ein Make.com- oder Zapier-Szenario ein, das neue Strava-Aktivitäten an einen persönlichen Webhook-Endpunkt der App schickt. Die App identifiziert den Läufer anhand eines persönlichen API-Tokens (Bearer Token) und trägt den Lauf in TYPO3 ein. Beide Integrationen (PROJ-5 OAuth und PROJ-23 Token) können gleichzeitig aktiv sein.

## User Stories

- Als Läufer möchte ich in der App einen persönlichen Webhook-Token generieren können, damit ich Make.com oder Zapier damit konfigurieren kann.
- Als Läufer möchte ich meinen Token jederzeit neu generieren können (z.B. wenn er kompromittiert wurde), damit alte Tokens sofort ungültig werden.
- Als Läufer möchte ich auf der Runs-Seite sehen, ob mein externer Webhook-Token aktiv ist, damit ich weiß, ob die Integration eingerichtet ist.
- Als Läufer möchte ich eine kurze Anleitung in der App sehen, wie ich Make.com / Zapier konfiguriere, damit ich die Einrichtung ohne externe Dokumentation abschließen kann.
- Als Make.com-Szenario (automatisiert) möchte ich Datum und Distanz eines Laufs an die App schicken, und der Lauf wird automatisch in TYPO3 eingetragen.

## Acceptance Criteria

- [ ] **AC-1:** Auf der Runs-Seite gibt es unterhalb der Laufliste einen Bereich "Externer Webhook" (neben bzw. unterhalb des Strava-Bereichs aus PROJ-5)
- [ ] **AC-2:** Der Bereich zeigt: Token-Status (aktiv seit [Datum] / kein Token), Button "Token generieren" (wenn kein Token) oder "Token neu generieren" (wenn Token bereits vorhanden) — der Token selbst wird nach dem Schließen des Generierungs-Dialogs nicht mehr angezeigt (nur Status)
- [ ] **AC-3:** Bei Klick auf "Token generieren" / "Token neu generieren" wird ein kryptografisch sicherer zufälliger Token (min. 32 Byte, hex-kodiert) erzeugt, gehasht in Supabase gespeichert, und dem Nutzer **einmalig im Klartext** angezeigt (mit Hinweis, dass er nicht erneut einsehbar ist)
- [ ] **AC-4:** Der Klartexttoken wird nach dem Schließen des Dialogs nie wieder angezeigt — nur der Hinweis "Token aktiv (seit [Datum])"
- [ ] **AC-5:** Die Anleitung befindet sich in einem einklappbaren Bereich (Akkordeon / Collapsible), standardmäßig zugeklappt. Wenn aufgeklappt, zeigt sie: vollständige Webhook-URL `POST /api/webhook/external`, `Authorization: Bearer <token>` Header und Beispiel-Body
- [ ] **AC-6:** Der Endpunkt `POST /api/webhook/external` akzeptiert einen `Authorization: Bearer <token>` Header und identifiziert den Läufer anhand des Tokens (Vergleich mit gespeichertem Hash)
- [ ] **AC-7:** Der erwartete Request-Body ist: `{ "date": "YYYY-MM-DD", "distance_km": <Zahl> }` — beide Felder sind Pflichtfelder und werden mit Zod validiert
- [ ] **AC-8:** Bei gültigem Token und korrektem Body wird der Lauf über die bestehende TYPO3-Update-Logik eingetragen (alle Läufe des Nutzers werden ersetzt — wie bei PROJ-4 und PROJ-5)
- [ ] **AC-9:** Der Endpunkt gibt immer innerhalb von 5 Sekunden eine Antwort zurück (Make.com-Timeout-Anforderung)
- [ ] **AC-10:** Fehlerhafte Requests werden mit sprechenden HTTP-Status-Codes beantwortet: `401` (kein / ungültiger Token), `422` (Validierungsfehler), `500` (TYPO3-Fehler)
- [ ] **AC-11:** Das Eintragen in TYPO3 durch den externen Webhook wird im TYPO3 Request Log (PROJ-8) erfasst
- [ ] **AC-12:** Ein Läufer ohne zugeordnetes TYPO3-Profil erhält `422` mit einer klaren Fehlermeldung ("Kein TYPO3-Läuferprofil zugeordnet")
- [ ] **AC-13:** Der Admin kann auf der Admin-Seite alle externen Webhooks zentral deaktivieren. Deaktivierte Webhooks geben `503 Service Unavailable` zurück mit der Meldung "Der externe Webhook ist derzeit deaktiviert."
- [ ] **AC-14:** Beim Deaktivieren bleiben alle bestehenden Tokens erhalten. Nach Reaktivierung funktionieren sie ohne erneutes Generieren.
- [ ] **AC-15:** Der Admin-Bereich zeigt den aktuellen Status (Aktiv / Deaktiviert) als Badge sowie einen Button "Webhook deaktivieren" / "Webhook aktivieren". Vor dem Deaktivieren erscheint ein Bestätigungs-Dialog.

## Edge Cases

- Was passiert, wenn der Nutzer "Token neu generieren" klickt? → Der alte Token wird sofort ungültig. Laufende Make.com-Szenarien schlagen bis zur Token-Aktualisierung dort mit `401` fehl. Nutzer wird im Dialog darauf hingewiesen.
- Was passiert, wenn Make.com denselben Lauf zweimal schickt (Retry nach Fehler)? → Der Endpunkt ist idempotent: TYPO3 enthält nach dem zweiten Aufruf denselben Stand wie nach dem ersten (letzter Stand gewinnt).
- Was passiert, wenn `distance_km` als String statt Number geschickt wird? → Zod-Validierung schlägt fehl → `422`. In der Anleitung steht das korrekte Format.
- Was passiert, wenn `date` kein gültiges Datum ist (z.B. `"2026-13-45"`)? → Zod-Validierung schlägt fehl → `422`.
- Was passiert, wenn der Läufer gleichzeitig PROJ-5 (Strava OAuth) und PROJ-23 (externen Webhook) aktiv hat? → Beide funktionieren unabhängig. Es kann zu doppelten Einträgen kommen, wenn Make.com UND Strava dieselbe Aktivität melden. Das ist akzeptabel (idempotent, TYPO3 enthält nach beiden Calls denselben Stand).
- Was passiert, wenn der Webhook deaktiviert ist und ein Aufruf eingeht? → `503 Service Unavailable` mit klarer Fehlermeldung. Token wird nicht geprüft, kein TYPO3-Request.
- Was passiert, wenn kein Eintrag für `external_webhook_enabled` in `app_settings` existiert? → Standardmäßig aktiviert (kein Breaking Change bei Erstinstallation).
- Was passiert, wenn kein Token in der DB gespeichert ist und der Endpunkt aufgerufen wird? → `401 Unauthorized`.
- Was passiert, wenn TYPO3 den Lauf ablehnt? → `500`, Fehler wird in PROJ-8 Request Log erfasst.
- Was passiert mit `distance_km: 0`? → Wird akzeptiert und eingetragen (kein Minimum-Wert-Filter, das liegt in der Verantwortung des Läufers).

## Technical Requirements

### Neue Supabase-Tabelle: `external_webhook_tokens`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → auth.users, UNIQUE) | Supabase User — ein Token pro User |
| `token_hash` | text | SHA-256-Hash des Klartokens (nie im Klartext gespeichert) |
| `created_at` | timestamptz | Zeitpunkt der Token-Generierung |

RLS: Jeder Nutzer sieht und verwaltet nur seine eigene Zeile. Der Webhook-Endpunkt verwendet den Admin-Client (Service Role).

### Neue API-Routen

| Route | Zweck | Auth |
|-------|-------|------|
| `POST /api/runner/webhook-token` | Token generieren / neu generieren | Eingeloggt |
| `GET /api/runner/webhook-token` | Token-Status abfragen (aktiv seit, kein Klartext) | Eingeloggt |
| `DELETE /api/runner/webhook-token` | Token löschen | Eingeloggt |
| `POST /api/webhook/external` | Lauf-Eintrag via externem Webhook | Bearer Token |

### Neue UI-Komponenten

- `external-webhook-section.tsx` — Bereich auf der Runs-Seite: Token-Status, Token-Anzeige (einmalig), Token-Generierungs-Dialog, Anleitung mit Webhook-URL und Beispiel-Body

### Token-Sicherheit

- Token wird mit `crypto.getRandomValues` (32 Byte) erzeugt, hex-kodiert (64 Zeichen)
- In DB wird nur `SHA-256(token)` gespeichert
- Klartexttoken wird nur einmalig im Dialog angezeigt, nie persistiert
- Vergleich beim Webhook: `SHA-256(eingehender_token) === gespeicherter_hash`

### Anleitung in der App (Beispiel-Content)

```
Webhook-URL: POST https://<deine-app>.vercel.app/api/webhook/external
Header: Authorization: Bearer <dein-token>
Body (JSON):
{
  "date": "2026-04-03",
  "distance_km": 10.5
}
```

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Zwei unabhängige Flows

**Flow 1: Läufer verwaltet seinen Token (einmalig)**
Läufer → "Token generieren" → `POST /api/runner/webhook-token` → Server erzeugt Token, speichert Hash in DB → gibt Klartext einmalig zurück → Dialog zeigt Token mit Copy-Button

**Flow 2: Automatischer Lauf-Eintrag (dauerhaft)**
Make.com / beliebige App → `POST /api/webhook/external` (Bearer Token) → Server prüft Token-Hash → TYPO3 update → Request Log (PROJ-8)

---

### Komponenten-Struktur

```
Runs-Seite (src/app/runs/page.tsx) — bestehend, erweitert
└── ExternalWebhookSection (NEU: src/components/external-webhook-section.tsx)
    ├── Card Header: "Externer Webhook" + Beschreibungstext
    ├── Token-Status Badge: "Aktiv (seit [Datum])" / "Kein Token" (grau)
    ├── Aktions-Buttons:
    │   ├── "Token generieren" — wenn kein Token vorhanden
    │   └── "Token neu generieren" — wenn Token vorhanden (Bestätigungs-Dialog zuerst!)
    └── Anleitung (immer sichtbar, wenn Token aktiv):
        ├── Webhook-URL (Textfeld, read-only + Copy-Button)
        ├── Header: Authorization: Bearer <token>
        └── Beispiel-Body (JSON, Codeblock)

Token-Einmal-Dialog (AlertDialog — nach Generierung):
    ├── Klartexttoken (Textfeld, read-only + Copy-Button)
    ├── Warnhinweis: "Dieser Token wird nur einmal angezeigt. Kopiere ihn jetzt."
    └── "Verstanden" Button (schließt Dialog, Token nie wieder sichtbar)

Token-Neu-generieren-Dialog (AlertDialog — vor Generierung):
    ├── Warntext: "Der alte Token wird sofort ungültig."
    └── Buttons: "Abbrechen" / "Token neu generieren"
```

---

### Datenmodell

**Neue Supabase-Tabelle: `external_webhook_tokens`**

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | UUID | Primärschlüssel |
| `user_id` | UUID (UNIQUE, FK → auth.users) | Ein Token pro Nutzer |
| `token_hash` | Text | SHA-256-Hash des Klartokens |
| `created_at` | Timestamp | Zeitpunkt der Token-Generierung |

- **RLS-Policy:** Jeder Nutzer liest/schreibt/löscht nur seine eigene Zeile
- **Webhook-Endpunkt:** Nutzt Admin-Client (Service Role), da kein Auth-Context vorhanden

---

### API-Routen

| Route | Methode | Zweck | Auth |
|-------|---------|-------|------|
| `/api/runner/webhook-token` | GET | Token-Status (aktiv seit, kein Klartext) | Eingeloggt |
| `/api/runner/webhook-token` | POST | Token generieren / neu generieren | Eingeloggt |
| `/api/runner/webhook-token` | DELETE | Token löschen | Eingeloggt |
| `/api/webhook/external` | POST | Lauf-Eintrag via externem Webhook | Bearer Token |

---

### Wiederverwendung bestehender Infrastruktur

| Was | Wo | Wie genutzt |
|-----|----|-------------|
| TYPO3-Update-Logik | `src/lib/typo3-runs.ts` | `fetchRunnerRuns()` + `updateRunnerRuns()` direkt wiederverwendet — identisch zu PROJ-4 und PROJ-5 |
| Rate Limiting | `src/lib/rate-limit.ts` | Wird auf `/api/webhook/external` angewendet, verhindert Missbrauch |
| Admin-Client | `src/lib/supabase-admin.ts` | Token-Hash-Lookup im Webhook-Endpunkt (kein User-Session-Kontext) |
| TYPO3 Request Log | bestehend via PROJ-8 | Webhook-Eintrag wird automatisch geloggt |
| `strava-connect-section.tsx` | UI-Vorlage | Gleiche Card-Struktur und Interaktionsmuster |

---

### Technische Entscheidungen

| Entscheidung | Begründung |
|---|---|
| SHA-256 (Web Crypto API, kein npm-Paket) | In Node.js built-in, kein zusätzliches Package nötig |
| Token einmalig im Klartext zurückgeben | Sicherheitsprinzip: nur der Nutzer kennt den Klartext, nie die Datenbank |
| Admin-Client im Webhook | Webhook hat keinen Auth-Cookie — Service Role ist der einzige Weg, DB zu lesen |
| Rate Limiting auf `/api/webhook/external` | Bestehende `rate-limit.ts` schützt vor Token-Brute-Force |
| Endpunkt unter `/api/webhook/` (nicht `/api/strava/`) | Bewusst technologie-neutral benannt — gilt für Make, Zapier, curl, Shortcuts etc. |
| `NEXT_PUBLIC_APP_URL` für Anleitung | Webhook-URL in der App muss zur tatsächlichen Deployment-URL zeigen |

### Zentrale Deaktivierung (Admin, nachträglich ergänzt)

| Was | Detail |
|-----|--------|
| Speicherort | `app_settings` Tabelle, Key `external_webhook_enabled`, Value `'true'`/`'false'` |
| Default | Kein Eintrag = aktiv (kein Breaking Change) |
| Neue API-Route | `GET/POST /api/admin/external-webhook/status` (Admin only) |
| Neue Admin-Komponente | `external-webhook-control.tsx` — Badge + Toggle-Button + Bestätigungs-Dialog |
| Webhook-Endpunkt | Prüft Setting als erstes nach Rate-Limiting, vor Token-Validierung |
| HTTP-Status bei deaktiviert | `503 Service Unavailable` |

### Keine neuen npm-Pakete erforderlich

Alle benötigten Funktionen sind durch bestehende Infrastruktur oder Node.js-Built-ins abgedeckt.

## QA Test Results

**Tested:** 2026-04-03 (erster Lauf) + 2026-04-03 (zweiter Lauf nach Bug-Fixes + Admin-Feature)
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI) + manueller Code-Review
**Method:** Code review + static analysis (no running instance available for manual browser testing)

### Acceptance Criteria Status

#### AC-1: Externer Webhook Bereich auf der Runs-Seite
- [x] `ExternalWebhookSection` component exists and is rendered on the runs page (`src/app/runs/page.tsx`, line 215)
- [x] Placed below `StravaConnectSection` as specified
- **PASS**

#### AC-2: Token-Status Anzeige (aktiv / kein Token)
- [x] Badge "Aktiv" (green) shown when token exists, with "seit [Datum]" text
- [x] Badge "Kein Token" (secondary/grey) shown when no token
- [x] Button "Token generieren" shown when no token
- [x] Button "Token neu generieren" shown when token exists
- [ ] BUG-1: Token is NOT shown masked with "Anzeigen" button on the main card. The spec says the section should show "den Token selbst (maskiert, mit Anzeigen-Button)" but the implementation only shows status badge + date, never the masked token. The token is only visible once in the generation dialog.
- **PARTIAL PASS** (see BUG-1)

#### AC-3: Token-Generierung (kryptografisch sicher, gehasht, einmalig im Klartext)
- [x] Token generated with `crypto.randomBytes(32)` = 32 bytes = 64 hex chars
- [x] Stored as SHA-256 hash in Supabase (`hashToken` function in route.ts)
- [x] Plaintext token returned once in POST response and shown in AlertDialog
- [x] Warning text: "Dieser Token wird nur einmal angezeigt. Kopiere ihn jetzt."
- **PASS**

#### AC-4: Klartexttoken nach Dialog-Schluss nie wieder angezeigt
- [x] `handleTokenDialogClose` sets `newToken` to `null` and `tokenRevealed` to `false`
- [x] GET endpoint only returns `{ active: true, created_at }`, never the token hash or plaintext
- **PASS**

#### AC-5: Anleitung mit Webhook-URL, Header und Beispiel-Body
- [x] Webhook URL shown (using `window.location.origin` + `/api/webhook/external`)
- [x] Header format shown: `Authorization: Bearer <dein-token>`
- [x] Example JSON body with date and distance_km shown
- [x] Copy button for webhook URL
- [x] Instructions only visible when token is active
- **PASS**

#### AC-6: Bearer Token Authentication auf POST /api/webhook/external
- [x] Authorization header parsed, Bearer prefix checked
- [x] Token hashed with SHA-256 and looked up in DB
- [x] Returns 401 if no header, wrong format, empty token, or no match in DB
- **PASS**

#### AC-7: Request-Body Validierung mit Zod
- [x] `date` validated as YYYY-MM-DD format with regex AND `new Date()` roundtrip check
- [x] `distance_km` validated as `z.number()`
- [x] Both fields required (Zod schema requires both)
- [x] Invalid JSON body returns 422
- **PASS**

#### AC-8: Lauf-Eintrag via bestehende TYPO3-Update-Logik
- [x] Uses `fetchRunnerRuns()` to get existing runs
- [x] Appends new run and calls `updateRunnerRuns()` (same as PROJ-4/PROJ-5)
- [x] Run format: `{ runDate: date, runDistance: distance_km.toFixed(2) }`
- **PASS**

#### AC-9: Antwort innerhalb von 5 Sekunden
- [x] No artificial delays in code; depends on TYPO3 API response time
- [x] Teams notification runs via `after()` (non-blocking)
- **PASS** (code-level; runtime depends on TYPO3 API)

#### AC-10: Sprechende HTTP-Status-Codes
- [x] 401 for missing/invalid token
- [x] 422 for validation errors (bad JSON, invalid fields)
- [x] 500 for TYPO3 errors
- [x] 429 for rate limiting
- **PASS**

#### AC-11: TYPO3 Request Log Erfassung
- [x] `updateRunnerRuns` internally calls `logTypo3Request` (see typo3-runs.ts line 134)
- [x] Both success and error cases are logged
- **PASS**

#### AC-12: Fehler bei fehlendem TYPO3-Profil
- [x] Runner profile looked up via `supabaseAdmin.from('runner_profiles')` with user_id from token
- [x] Returns 422 with message "Kein TYPO3-Laeuferprofil zugeordnet" if no profile
- **PASS**

### Edge Cases Status

#### EC-1: Token neu generieren invalidiert alten Token
- [x] POST uses upsert with `onConflict: 'user_id'` -- replaces old hash
- [x] Confirmation dialog warns user about invalidation
- **PASS**

#### EC-2: Idempotente doppelte Aufrufe (Make.com Retry)
- [x] Each call appends the run and replaces all runs in TYPO3
- [ ] BUG-2: NOT idempotent as documented. If Make.com sends the same run twice, the run will appear TWICE in TYPO3 because the code does `[...existingRuns, newRun]` without deduplication. The spec says "TYPO3 enthaelt nach dem zweiten Aufruf denselben Stand wie nach dem ersten" but this is incorrect -- the second call will include the duplicate.
- **FAIL** (see BUG-2)

#### EC-3: distance_km als String statt Number
- [x] Zod schema uses `z.number()` which rejects strings -- returns 422
- **PASS**

#### EC-4: Ungueltiges Datum (z.B. "2026-13-45")
- [x] Regex check + `new Date()` roundtrip validation catches invalid dates
- **PASS**

#### EC-5: Strava OAuth und externer Webhook gleichzeitig aktiv
- [x] Both sections render independently on the runs page
- [x] No conflicts in code
- **PASS**

#### EC-6: Kein Token in DB + Endpoint aufgerufen
- [x] Returns 401 Unauthorized
- **PASS**

#### EC-7: TYPO3 lehnt Lauf ab
- [x] Typo3Error caught, returns 500, logged via PROJ-8
- **PASS**

#### EC-8: distance_km = 0
- [x] Zod `z.number()` accepts 0, no minimum filter
- **PASS**

### Security Audit Results

#### Authentication & Authorization
- [x] `/api/runner/webhook-token` (GET/POST/DELETE): Properly checks Supabase session via `createClient()` + `getUser()`
- [x] `/api/webhook/external`: Properly validates Bearer token via SHA-256 hash comparison
- [x] Middleware correctly lists `/api/webhook/external` as public route (Bearer auth, not session)
- [x] RLS enabled on `external_webhook_tokens` table with per-user policies
- [x] Admin client used only in webhook endpoint (where no session cookie exists)

#### Token Security
- [x] Token stored as SHA-256 hash only -- plaintext never persisted
- [x] Token generated with `crypto.randomBytes(32)` -- cryptographically secure
- [x] Plaintext cleared from React state on dialog close (`setNewToken(null)`)
- [ ] BUG-3: No timing-safe comparison for token hash lookup. The code uses `supabaseAdmin.from('external_webhook_tokens').select().eq('token_hash', tokenHash)` which is a database equality check. While this is a standard approach and the risk is LOW (database query timing is dominated by network latency, not string comparison), best practice for bearer token validation is to use constant-time comparison. Since the token is hashed before comparison, timing attacks on the hash itself are not practically exploitable. Severity: Low.

#### Input Validation
- [x] Zod validation on all inputs to `/api/webhook/external`
- [x] JSON parse errors handled gracefully (422)
- [x] Date format validated with regex + roundtrip check
- [ ] BUG-4: No upper bound on `distance_km`. The Zod schema accepts any number including `Infinity`, `NaN` (via edge cases in JSON parsing), and extremely large numbers like `1e308`. While `z.number()` rejects `NaN`, it accepts `Infinity` if passed as JSON. An attacker could send `{"date":"2026-04-03","distance_km":1e308}` and `toFixed(2)` on Infinity produces "Infinity" which would be sent to TYPO3. Severity: Medium.
- [ ] BUG-5: No upper bound on `date` -- future dates far in the future (e.g., "9999-12-31") are accepted. The spec says this is the runner's responsibility, but it may cause issues with TYPO3. Severity: Low (by design per spec).

#### Rate Limiting
- [x] Rate limit: 60 requests per 60 seconds per IP on `/api/webhook/external`
- [x] In-memory rate limiter with cleanup to prevent memory leaks
- [x] Rate limit key includes IP address
- [ ] Note: In-memory rate limit resets on Vercel cold start / redeploy. Acceptable for 5-30 users.

#### Sensitive Data Exposure
- [x] GET `/api/runner/webhook-token` never returns the token hash
- [x] Token hash not exposed in any API response
- [x] No secrets in client-side code
- [x] `server-only` import on admin client prevents client bundling

#### CORS / Request Forgery
- [x] Next.js API routes do not have CORS headers by default -- external webhook endpoint is called server-to-server by Make.com/Zapier, so CORS is not needed
- [x] No CSRF concern on Bearer token endpoint (token IS the CSRF protection)

#### Injection
- [x] No raw SQL -- all queries go through Supabase client (parameterized)
- [x] No HTML rendering of user input (React escapes by default)
- [x] Token is hex-encoded, limiting injection surface

### Cross-Browser Testing
Note: Code review only. UI uses standard shadcn/ui components (Card, Badge, Button, AlertDialog, Alert) which are well-tested across browsers. No custom CSS that would cause cross-browser issues detected.

- [x] Chrome: Expected to work (shadcn/ui components)
- [x] Firefox: Expected to work (shadcn/ui components)
- [x] Safari: Expected to work (shadcn/ui components)

### Responsive Testing
- [x] Flex layout uses `flex-col` -> `sm:flex-row` for mobile/desktop adaptation (line 173)
- [x] Code blocks use `break-all` for long URLs/tokens on narrow screens
- [x] Instructions section uses standard padding, should work at 375px

### Regression Testing
- [x] Build passes successfully (no compile errors)
- [x] Existing Vitest unit tests pass (86/86)
- [x] Runs page still renders StravaConnectSection and all existing components
- [x] Middleware correctly handles all existing public routes alongside new route
- [x] `typo3-runs.ts` shared code unchanged -- PROJ-4 and PROJ-5 not affected

### Bugs Found

#### BUG-1: Token nicht maskiert auf Hauptseite angezeigt
- **Severity:** Low
- **AC:** AC-2 specifies "den Token selbst (maskiert, mit Anzeigen-Button)" on the main section
- **Steps to Reproduce:**
  1. Generate a webhook token
  2. Close the one-time dialog
  3. Look at the External Webhook section
  4. Expected: Masked token with "Anzeigen" button visible
  5. Actual: Only "Aktiv (seit [Datum])" badge shown, no masked token display
- **Note:** This is actually MORE secure than the spec -- not showing even a masked token is better. The spec's AC-2 text may be outdated after the tech design decided to show the token only once. This could be considered a spec inconsistency rather than a bug.
- **Priority:** Nice to have (update spec to match implementation, or add masked display)

#### BUG-2: Doppelte Laeufe bei Retry (nicht idempotent)
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Send `POST /api/webhook/external` with `{"date":"2026-04-03","distance_km":10}` and valid Bearer token
  2. Send the same request again
  3. Expected: TYPO3 contains the run only once (idempotent)
  4. Actual: TYPO3 contains the run twice because `[...existingRuns, newRun]` always appends
- **Impact:** Make.com retries on timeout will create duplicate entries in TYPO3. The edge case documentation says the endpoint is idempotent, but it is not.
- **Priority:** Fix before deployment -- Make.com retries are common and will cause data corruption

#### BUG-3: Kein Timing-Safe-Vergleich fuer Token-Hash
- **Severity:** Low
- **Steps to Reproduce:** Theoretical timing attack on database query
- **Impact:** Practically not exploitable because (1) token is hashed before comparison so timing reveals nothing about plaintext, and (2) database query timing is dominated by network latency
- **Priority:** Nice to have

#### BUG-4: Keine Obergrenze fuer distance_km (Infinity/extrem grosse Werte)
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Send `POST /api/webhook/external` with `{"date":"2026-04-03","distance_km":1e308}`
  2. Expected: Validation error (422)
  3. Actual: Accepted, `toFixed(2)` on very large numbers produces unexpected strings, sent to TYPO3
  4. Also: `distance_km: -100` (negative values) is accepted
- **Impact:** Could corrupt TYPO3 data with invalid distance values
- **Priority:** Fix before deployment -- add `.finite().nonnegative()` or `.finite().min(0).max(1000)` to Zod schema

### Zweiter QA-Lauf (nach Bug-Fixes + Admin-Deaktivierung)

Alle 4 Bugs aus dem ersten Lauf wurden behoben:
- BUG-1: AC-2 in Spec korrigiert (nur Status, kein maskierter Token)
- BUG-2: Idempotenz implementiert — gleiche Datum-Einträge werden ersetzt (`.filter(r => r.runDate !== date)`)
- BUG-3: `timingSafeEqual` aus Node.js crypto für Hash-Vergleich
- BUG-4: `.finite().nonnegative().max(1000)` im Zod-Schema

Admin-Deaktivierungs-Feature (AC-13/14/15) geprüft:
- [x] `GET /api/admin/external-webhook/status` gibt korrekten Status zurück (default: aktiviert)
- [x] `POST /api/admin/external-webhook/status` mit `{ "enabled": false }` setzt `app_settings`
- [x] Webhook-Endpunkt gibt `503` zurück wenn deaktiviert — vor Token-Prüfung
- [x] Tokens bleiben bei Deaktivierung erhalten (`external_webhook_tokens` unverändert)
- [x] `ExternalWebhookControl` in Admin-Seite: Badge + Bestätigungs-Dialog korrekt implementiert

### Summary (zweiter Lauf)
- **Acceptance Criteria:** 15/15 bestanden ✅
- **Bugs:** Keine neuen Bugs gefunden
- **Security:** Token-Hashing, RLS, Rate-Limiting, timingSafeEqual, Zod-Validierung — alles korrekt
- **Build:** PASS (keine Compile-Fehler)
- **Production Ready:** JA — bereit für Deployment auf `main`

## Deployment

**Deployed:** 2026-04-03
**Tag:** v1.23.0-PROJ-23
**PR:** Audefleda/24_tage_lauf#1
**Plattform:** Vercel (auto-deploy via GitHub Action bei Push auf main)
**Datenbank-Migration:** `20260403001_create_external_webhook_tokens.sql` — auf Dev manuell angewendet, auf Prod automatisch via GitHub Action
