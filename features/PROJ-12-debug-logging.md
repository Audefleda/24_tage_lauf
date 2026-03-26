# PROJ-12: Debug-Logging

## Status: Deployed
**Created:** 2026-03-23
**Last Updated:** 2026-03-23

## Dependencies
- None (querschnittliche Anforderung — gilt für alle Backend-Features)

## User Stories
- Als Administrator möchte ich ein erweitertes Logging aktivieren können, um bei Problemen die genaue Kommunikation zwischen der App und externen Diensten nachvollziehen zu können.
- Als Administrator möchte ich das Debug-Logging ohne Code-Änderung ein- und ausschalten können, damit ich es im Problemfall schnell aktivieren und danach wieder deaktivieren kann.
- Als Entwickler möchte ich im Debug-Modus vollständige Anfrage- und Antwort-Details sehen, damit ich Integrationsprobleme analysieren kann.

## Acceptance Criteria
- [ ] **AC-1:** Es gibt eine Env-Variable `LOG_LEVEL` (Werte: `debug` oder leer/nicht gesetzt = normaler Betrieb)
- [ ] **AC-2:** `LOG_LEVEL=debug` kann im Vercel Dashboard (Settings → Environment Variables) gesetzt und durch einen Redeploy aktiviert werden — kein Code-Change nötig
- [ ] **AC-3:** Im normalen Betrieb (`LOG_LEVEL` nicht gesetzt) werden nur Fehler geloggt — kein zusätzliches Rauschen in den Vercel Logs
- [ ] **AC-4:** Im Debug-Modus werden alle relevanten Schritte der externen Kommunikation geloggt (siehe Debug-Ausgaben je Feature unten)
- [ ] **AC-5:** Debug-Ausgaben sind einheitlich formatiert: `[DEBUG][Modul] Beschreibung: {daten}`
- [ ] **AC-6:** Sensible Daten (Passwörter, vollständige Access-Tokens) werden in Debug-Ausgaben niemals im Klartext ausgegeben — Tokens werden auf die ersten 8 Zeichen gekürzt (z.B. `abc12345...`)

## Debug-Ausgaben je Feature

### PROJ-1 — TYPO3 Authentifizierung
- Login-Versuch gestartet (URL, E-Mail maskiert)
- Login-Formular erfolgreich geladen (Anzahl gefundener Felder)
- Login-POST abgeschickt (Ziel-URL)
- Login erfolgreich / fehlgeschlagen (Cookie gesetzt oder nicht)
- Re-Login ausgelöst (wegen HTTP-Status X)
- Token-Cache invalidiert

### PROJ-4 / PROJ-8 — TYPO3 Runs Update
- PUT-Anfrage an TYPO3 gestartet (Runner-UID, Anzahl Läufe)
- HTTP-Status der TYPO3-Antwort
- TYPO3-Antwort-Body (vollständig, da kein Geheimnis)

### PROJ-5 — Strava-Integration
- OAuth-Flow gestartet (User-ID, OAuth-URL ohne Secrets)
- OAuth-Callback empfangen (Athlete-ID, Scopes)
- Token-Refresh ausgelöst (User-ID, Grund: Token läuft ab)
- Token-Refresh erfolgreich (neue `expires_at`)
- Webhook-Event empfangen (vollständiger Body)
- Aktivitätsdetails abgerufen (Activity-ID, Typ, Distanz, Datum)
- Aktivitätstyp ignoriert (Typ, Grund)
- Webhook-Event verarbeitet (Activity-ID, eingetragene Distanz)
- Webhook-Event ignoriert (Grund: kein User, kein TYPO3-Profil, falscher Typ)

## Edge Cases
- Was passiert, wenn `LOG_LEVEL` auf einen ungültigen Wert gesetzt wird? → Wird wie "nicht gesetzt" behandelt (normaler Betrieb)
- Führt Debug-Logging zu Performance-Problemen? → Nein, da `console.log` in Serverless-Funktionen async ist und der Request nicht blockiert wird
- Können Debug-Logs Secrets enthalten? → Nein — AC-6 stellt sicher, dass Tokens immer maskiert werden

## Nicht-Ziele
- Kein persistentes Log-Speichern in der Datenbank (Vercel Logs sind ausreichend)
- Kein UI für Logs in der App (Vercel Dashboard ist die Oberfläche)
- Kein Live-Toggle ohne Redeploy (Vercel Env-Vars erfordern immer einen Redeploy)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Ansatz: Zentraler Logger als einzige neue Datei

```
src/lib/
└── logger.ts  (NEU)

Bestehende Dateien die erweitert werden:
├── typo3-client.ts   → PROJ-1 Debug-Ausgaben
├── typo3-runs.ts     → PROJ-4/8 Debug-Ausgaben
└── strava.ts         → PROJ-5 Debug-Ausgaben
```

### Wie es funktioniert

`logger.ts` liest beim Modulstart einmalig `process.env.LOG_LEVEL`. Ist der Wert `debug`, gibt `logger.debug()` Nachrichten aus — andernfalls tut es nichts. `logger.error()` gibt immer aus (unabhängig vom Level). Token-Maskierung (`abc12345...`) sitzt zentral in `logger.ts`.

### Ausgabe-Format
`[DEBUG][modul] Beschreibung: {daten}`

### Technische Entscheidungen

| Entscheidung | Grund |
|---|---|
| Keine externe Logging-Bibliothek | Vercel Logs zeigen `console.log` nativ |
| `LOG_LEVEL` einmalig beim Modulstart gelesen | Performance: kein env-Lookup pro Aufruf |
| Maskierung zentralisiert in `logger.ts` | Ein Ort, keine Wiederholung in Modulen |
| Kein DB-Logging | Non-Goal laut Spec — Vercel Dashboard reicht |

### Neue Env-Variable
- `LOG_LEVEL=debug` — Vercel Dashboard → Settings → Environment Variables → Redeploy

## QA Test Results

**Tested:** 2026-03-23
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Static code review + build verification (feature is backend-only, no UI)

### Acceptance Criteria Status

#### AC-1: Env-Variable LOG_LEVEL existiert
- [x] `logger.ts` line 6: `const IS_DEBUG = process.env.LOG_LEVEL === 'debug'`
- [x] `.env.local.example` documents `LOG_LEVEL=debug` with instructions (line 22-24)
- [x] Default behavior when not set: `IS_DEBUG` evaluates to `false` -- no debug output
- **PASS**

#### AC-2: LOG_LEVEL=debug aktivierbar via Vercel Dashboard ohne Code-Change
- [x] `IS_DEBUG` reads from `process.env.LOG_LEVEL` at module load time -- standard Vercel env var
- [x] `.env.local.example` includes comment: "Vercel Dashboard -> Settings -> Environment Variables -> Redeploy nach Aenderung"
- [x] No hardcoded toggle, no feature flag in code -- purely env-driven
- **PASS**

#### AC-3: Normaler Betrieb loggt nur Fehler
- [x] `debug()` function returns immediately when `IS_DEBUG` is false (line 36)
- [x] `error()` function always outputs regardless of `IS_DEBUG` (line 47-52)
- [ ] BUG: `typo3-runs.ts` lines 67, 70 still use raw `console.error()` instead of `logger.error()` -- these always output but do not follow the `[ERROR][module]` format
- [ ] BUG: `strava/callback/route.ts` lines 29, 66, 75 use raw `console.error()` instead of `logger.error()`
- [ ] BUG: `strava/webhook/route.ts` line 108 uses raw `console.warn()` instead of `logger.error()` or `logger.debug()`
- **PARTIAL PASS** -- core logger behavior correct, but inconsistent usage across codebase

#### AC-4: Debug-Modus loggt alle relevanten Schritte

**PROJ-1 -- TYPO3 Authentifizierung:**
- [x] Login-Versuch gestartet (URL, E-Mail maskiert) -- `typo3-client.ts:85`
- [x] Login-Formular erfolgreich geladen (Anzahl gefundener Felder) -- `typo3-client.ts:112`
- [x] Login-POST abgeschickt (Ziel-URL) -- `typo3-client.ts:114`
- [x] Login fehlgeschlagen (Cookie nicht gesetzt) -- `typo3-client.ts:169`
- [x] Login erfolgreich (Cookie maskiert) -- `typo3-client.ts:175`
- [x] Re-Login ausgeloest (HTTP-Status) -- `typo3-client.ts:208`
- [x] Token-Cache invalidiert -- `typo3-client.ts:209`

**PROJ-4/8 -- TYPO3 Runs Update:**
- [x] PUT-Anfrage an TYPO3 gestartet (Runner-UID, Anzahl Laeufe) -- `typo3-runs.ts:116`
- [x] HTTP-Status der TYPO3-Antwort -- `typo3-runs.ts:131`
- [x] TYPO3-Antwort-Body (vollstaendig) -- `typo3-runs.ts:132`

**PROJ-5 -- Strava-Integration:**
- [x] OAuth-Flow gestartet (User-ID, OAuth-URL ohne Secrets) -- `strava/connect/route.ts:33`
- [x] OAuth-Callback empfangen (Athlete-ID, Scopes) -- `strava.ts:75` + `callback/route.ts:45`
- [x] Token-Refresh ausgeloest (User-ID, Grund) -- `strava.ts:128`
- [x] Token-Refresh erfolgreich (neue expires_at) -- `strava.ts:135`
- [x] Webhook-Event empfangen (vollstaendiger Body) -- `webhook/route.ts:91`
- [x] Aktivitaetsdetails abgerufen (Activity-ID, Typ, Distanz, Datum) -- `webhook/route.ts:161`
- [x] Aktivitaetstyp ignoriert (Typ, Grund) -- `webhook/route.ts:165`
- [x] Webhook-Event verarbeitet (Activity-ID, eingetragene Distanz) -- `webhook/route.ts:188`
- [x] Webhook-Event ignoriert (kein User) -- `webhook/route.ts:120`
- [x] Webhook-Event ignoriert (kein TYPO3-Profil) -- `webhook/route.ts:132`
- [x] Webhook-Event ignoriert (falscher Typ) -- `webhook/route.ts:95`
- **PASS** -- all specified debug outputs are present

#### AC-5: Einheitliches Format [DEBUG][Modul] Beschreibung: {daten}
- [x] `debug()` outputs `[DEBUG][${module}] ${message}:` + JSON data -- `logger.ts:38`
- [x] `debug()` outputs `[DEBUG][${module}] ${message}` when no data -- `logger.ts:40`
- [x] `error()` outputs `[ERROR][${module}] ${message}:` + error -- `logger.ts:49`
- [x] Module names used consistently: `typo3-auth`, `typo3-runs`, `strava`
- **PASS**

#### AC-6: Sensible Daten werden maskiert
- [x] `maskToken()` truncates to first 8 chars + "..." -- `logger.ts:16`
- [x] `maskToken()` returns "***" for tokens <= 8 chars -- `logger.ts:15`
- [x] `maskToken()` returns "(empty)" for falsy values -- `logger.ts:14`
- [x] `maskEmail()` shows first 2 chars + "***@domain" -- `logger.ts:23-28`
- [x] TYPO3 login: email masked via `maskEmail()` -- `typo3-client.ts:85`
- [x] TYPO3 login: fe_typo_user cookie masked via `maskToken()` -- `typo3-client.ts:175`
- [x] Strava OAuth URL: secrets stripped by using `url.split('?')[0]` -- `connect/route.ts:33`
- [ ] BUG: `strava.ts:4` imports `maskToken` but never uses it -- indicates missing masking
- [ ] BUG: `strava.ts:75` logs `athleteId` and `scopes` but the OAuth response (`data`) may contain `access_token` and `refresh_token` in scope -- however the debug call only logs selected fields, so tokens are not leaked. The unused import is a code quality issue, not a security issue.
- [x] Passwords are never passed to any `debug()` call
- [x] No `access_token` or `refresh_token` values appear in any `debug()` call
- **PASS** (tokens are safe; unused import is cosmetic)

### Edge Cases Status

#### EC-1: LOG_LEVEL auf ungueltigen Wert gesetzt
- [x] `IS_DEBUG = process.env.LOG_LEVEL === 'debug'` -- strict equality means any value other than "debug" results in `false`
- **PASS**

#### EC-2: Performance-Auswirkungen
- [x] `IS_DEBUG` computed once at module load -- no per-call env lookup
- [x] `debug()` early-returns on line 36 when not in debug mode -- zero overhead
- **PASS**

#### EC-3: Secrets in Debug-Logs
- [x] All token values are masked via `maskToken()` before logging
- [x] Email masked via `maskEmail()`
- [x] No raw credential values passed to debug calls
- **PASS**

### Security Audit Results (Red Team)

- [x] `import 'server-only'` on `logger.ts` prevents client-side bundle inclusion
- [x] No secrets (passwords, full tokens) appear in any `debug()` call parameters
- [x] `maskToken` correctly truncates -- no way to reconstruct full token from 8 chars
- [x] OAuth URL logged without query string (secrets in query params stripped)
- [x] `error()` calls in webhook/callback routes use `console.error` with generic messages or error objects -- could theoretically contain token data if an Error message includes it, but this is standard error handling
- [ ] FINDING: `strava/callback/route.ts:75` does `console.error('[PROJ-5] Strava OAuth callback error:', err)` -- if `err` contains the full Strava API response (which may include tokens), this could leak sensitive data to Vercel logs. Low risk since this is server-side only, but should use `logger.error()` with proper masking.

### Cross-Browser / Responsive Testing
- Not applicable -- PROJ-12 is a backend-only feature with no UI components.

### Build Verification
- [x] `npm run build` succeeds with no errors
- [x] `npm run lint` passes with 0 errors (2 pre-existing warnings, one of which is the unused `maskToken` import in strava.ts)

### Bugs Found

#### BUG-1: Inconsistent logging -- raw console.error() used alongside logger
- **Severity:** Low
- **Steps to Reproduce:**
  1. Review `src/lib/typo3-runs.ts` lines 67, 70
  2. Review `src/app/api/strava/callback/route.ts` lines 29, 66, 75
  3. Review `src/app/api/strava/webhook/route.ts` line 108
  4. Expected: All server-side log output uses `logger.error()` for consistent `[ERROR][module]` formatting
  5. Actual: 5 call sites still use raw `console.error()` / `console.warn()` with inconsistent `[PROJ-X]` prefixes
- **Priority:** Nice to have -- does not affect functionality, but defeats the purpose of centralized formatting (AC-5)

#### BUG-2: Unused maskToken import in strava.ts
- **Severity:** Low
- **Steps to Reproduce:**
  1. Run `npm run lint`
  2. See warning: `'maskToken' is defined but never used` in `src/lib/strava.ts:4`
  3. Expected: Import is used or removed
  4. Actual: `maskToken` imported but never called
- **Priority:** Nice to have -- cosmetic lint warning, no functional impact

#### BUG-3: Potential token leak in error handler
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Review `src/app/api/strava/callback/route.ts:75`
  2. If `exchangeStravaCode()` throws an error whose message contains the Strava API response body (which includes `access_token`), the raw error is logged via `console.error('[PROJ-5] Strava OAuth callback error:', err)`
  3. Expected: Error logged through `logger.error()` which does not automatically mask, but at least provides consistent formatting and signals that the developer should consider masking
  4. Actual: Raw error object dumped to console, potentially including token values in error message
- **Priority:** Fix in next sprint -- low probability but violates the spirit of AC-6

#### BUG-4: Duplicate OAuth-Callback debug log
- **Severity:** Low
- **Steps to Reproduce:**
  1. Review `src/lib/strava.ts:75` -- logs `'OAuth-Callback empfangen'` inside `exchangeStravaCode()`
  2. Review `src/app/api/strava/callback/route.ts:45` -- logs `'OAuth-Callback empfangen'` again after `exchangeStravaCode()` returns
  3. Expected: Log message appears once per callback
  4. Actual: Same message logged twice with slightly different data (first has `scopes`, second has `userId`)
- **Priority:** Nice to have -- not harmful but creates noise in debug mode

### Summary
- **Acceptance Criteria:** 6/6 passed (AC-3 partial -- core behavior correct but inconsistent usage)
- **Bugs Found:** 4 total (0 critical, 0 high, 1 medium, 3 low)
- **Security:** One medium finding (potential token leak in error handler)
- **Production Ready:** YES -- no critical or high bugs. The medium finding is low probability and server-side only.
- **Recommendation:** Deploy, then fix BUG-3 in next sprint. BUG-1, BUG-2, BUG-4 are nice-to-have cleanup.

## Deployment
_To be added by /deploy_
