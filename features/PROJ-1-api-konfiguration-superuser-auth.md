# PROJ-1: API-Konfiguration & Superuser-Authentifizierung

## Status: Deployed
**Created:** 2026-03-17
**Last Updated:** 2026-03-17

## Implementation Notes
- `src/lib/typo3-client.ts` — TYPO3 Auth-Client mit regex-basiertem HTML-Parser (kein ext. Package nötig)
- `src/app/api/health/route.ts` — GET /api/health → JSON `{ ok, message }`
- `src/components/api-status.tsx` — Client Component mit Loading/Error/Success States
- `src/app/layout.tsx` — App Shell: Header, max-w-2xl, Toaster, lang="de"
- `src/app/page.tsx` — Redirect zu /select
- `.env.local.example` — TYPO3_BASE_URL, TYPO3_LOGIN_PATH, TYPO3_EMAIL, TYPO3_PASSWORD

## Dependencies
- None

## User Stories
- Als Betreiber möchte ich Superuser-Credentials als Umgebungsvariablen konfigurieren, damit keine Passwörter im Code oder Frontend sichtbar sind.
- Als App möchte ich mich beim Start automatisch mit dem Superuser an der Ziel-Website anmelden, damit alle nachfolgenden API-Aufrufe authentifiziert sind.
- Als Entwickler möchte ich eine zentrale API-Client-Instanz haben, damit alle Features denselben authentifizierten Client nutzen.
- Als Nutzer möchte ich eine verständliche Fehlermeldung sehen, wenn die API nicht erreichbar ist oder die Anmeldung fehlschlägt.

## Acceptance Criteria
- [ ] Superuser-Credentials sind als Env-Variablen konfigurierbar: `TYPO3_BASE_URL`, `TYPO3_LOGIN_PATH`, `TYPO3_EMAIL`, `TYPO3_PASSWORD`
- [ ] Die App führt beim ersten API-Aufruf eine Authentifizierung durch und speichert das Session-Token (z.B. Cookie oder Bearer Token)
- [ ] Alle API-Aufrufe verwenden den authentifizierten Client
- [ ] Bei fehlgeschlagener Authentifizierung wird eine klare Fehlermeldung angezeigt (kein leerer Screen)
- [ ] Das Auth-Token wird nicht im Browser-LocalStorage persistiert (Session-only)
- [ ] API-Basis-URL ist konfigurierbar, um zwischen Staging und Produktion zu wechseln

## Edge Cases
- Was passiert, wenn die Ziel-Website nicht erreichbar ist? → Fehlermeldung mit Retry-Option
- Was passiert, wenn das Token abläuft während die App läuft? → Automatischer Re-Login
- Was passiert, wenn falsche Credentials konfiguriert sind? → Klare Fehlermeldung für den Admin
- Was passiert, wenn die API eine unerwartete Antwortstruktur zurückgibt? → Graceful Error Handling

## Debug-Logging (PROJ-12)
Bei aktiviertem `LOG_LEVEL=debug` werden folgende Ausgaben erzeugt:
- Login-Versuch gestartet (URL, E-Mail maskiert)
- Login-Formular geladen (Anzahl gefundener Felder)
- Login-POST abgeschickt (Ziel-URL)
- Login erfolgreich / fehlgeschlagen (Cookie gesetzt oder nicht)
- Re-Login ausgelöst (HTTP-Status als Grund)
- Token-Cache invalidiert

## Technical Requirements
- Auth erfolgt server-seitig (Next.js API Route oder Server Action), damit Credentials nie im Browser landen
- API-Client als Singleton in `src/lib/typo3-client.ts`
- Umgebungsvariablen: `TYPO3_BASE_URL`, `TYPO3_LOGIN_PATH`, `TYPO3_EMAIL`, `TYPO3_PASSWORD` (alle server-only, kein `NEXT_PUBLIC_` Prefix)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

**Ziel-System:** TYPO3 CMS — kein klassisches JSON REST API, sondern formular-basierter Login mit Cookie-Session.

**Login-URL:** `https://www.stuttgarter-kinderstiftung.de/unsere-arbeit/24-tage-lauf-fuer-kinderrechte/mein-team`

**Authentifizierungsflow (TYPO3-spezifisch):**
1. GET Login-URL → HTML-Seite mit Login-Formular wird geladen
2. Formular parsen: versteckte Felder (CSRF-Token etc.) + `action`-URL extrahieren
3. POST an `action`-URL mit Feldern `user` (E-Mail) + `pass` (Passwort) + alle hidden inputs
4. Prüfen ob Cookie `fe_typo_user` gesetzt wurde → Erfolg
5. Cookie wird server-seitig gecacht und für alle weiteren Requests mitgeschickt

**Session-Management:**
- Cookie `fe_typo_user` = TYPO3 Standard-Auth-Cookie
- Cookie im Modul-Scope des Next.js Servers gespeichert (nie im Browser)
- Bei abgelaufenem Cookie (HTTP 403 oder Redirect zur Login-Seite): automatischer Re-Login

**Komponenten:**
- `src/lib/typo3-client.ts` — Singleton mit Login + Cookie-Management (server-only)
- Alle weiteren Server Actions importieren und nutzen diesen Client

**Env-Variablen:**
| Variable | Wert |
|----------|------|
| `TYPO3_BASE_URL` | `https://www.stuttgarter-kinderstiftung.de` |
| `TYPO3_LOGIN_PATH` | `/unsere-arbeit/24-tage-lauf-fuer-kinderrechte/mein-team` |
| `TYPO3_EMAIL` | E-Mail des Superusers |
| `TYPO3_PASSWORD` | Passwort des Superusers |

**Fehlerbehandlung:** Eigener Error-Typ `Typo3Error` mit Status-Code und Nachricht für einheitliches Handling in allen Features.

**Wichtig:** Da TYPO3 HTML zurückgibt (kein JSON), müssen Daten aus dem HTML geparst werden. Dafür wird `node-html-parser` oder ähnliches serverseitig genutzt.

## QA Test Results

**Tested:** 2026-03-18
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Code review + build verification (sandbox restricted live HTTP testing)

### Acceptance Criteria Status

#### AC-1: Superuser-Credentials als Env-Variablen konfigurierbar
- [x] Env vars `TYPO3_BASE_URL`, `TYPO3_LOGIN_PATH`, `TYPO3_EMAIL`, `TYPO3_PASSWORD` are read from `process.env` in `src/lib/typo3-client.ts`
- [x] `.env.local.example` documents all four variables with dummy values
- [x] `.env.local` exists and is in `.gitignore` (pattern `.env*.local`)
- [ ] BUG-1: Env variable names deviate from spec. Spec says `API_BASE_URL`, `API_SUPERUSER`, `API_PASSWORD`; implementation uses `TYPO3_BASE_URL`, `TYPO3_LOGIN_PATH`, `TYPO3_EMAIL`, `TYPO3_PASSWORD`. The Tech Design updated the names but the Acceptance Criteria and Technical Requirements sections still reference the old names.

**Verdict: PASS (functionally correct; spec text outdated)**

#### AC-2: Authentifizierung beim ersten API-Aufruf + Session-Token speichern
- [x] `getAuthCookie()` lazily authenticates on first call and caches to module-level `cachedCookie`
- [x] Login flow: GET login page, extract form fields + CSRF token, POST credentials, collect `fe_typo_user` cookie
- [x] Cookie persisted in module-scope variable (server process lifetime)

**Verdict: PASS**

#### AC-3: Alle API-Aufrufe verwenden den authentifizierten Client
- [x] `typo3Fetch()` is the single entry point, always calls `getAuthCookie()` before requests
- [x] All API routes (`/api/health`, `/api/runner`, `/api/runner/runs`, `/api/admin/runners`) import and use `typo3Fetch` or `checkConnection`
- [x] No direct `fetch()` calls to TYPO3 outside of `typo3-client.ts`

**Verdict: PASS**

#### AC-4: Klare Fehlermeldung bei fehlgeschlagener Authentifizierung
- [x] `checkConnection()` catches `Typo3Error` and returns `{ ok: false, message }` with descriptive German text
- [x] `api-status.tsx` shows `Alert variant="destructive"` with error message on failure
- [x] Loading state shows skeleton, not empty screen
- [x] Missing env vars produce: "TYPO3-Konfiguration unvollstaendig..."
- [x] Failed login produces: "Login fehlgeschlagen: fe_typo_user Cookie nicht gesetzt..."
- [x] Unreachable server produces: "Login-Seite nicht erreichbar: HTTP ..."

**Verdict: PASS**

#### AC-5: Auth-Token nicht im Browser-LocalStorage persistiert
- [x] Cookie stored in server-side module variable `cachedCookie` (never exposed to client)
- [x] `typo3-client.ts` is only imported by server-side API routes (verified via grep)
- [x] No `NEXT_PUBLIC_` prefix on any TYPO3 env variables
- [x] ~~BUG-2: Missing `server-only` guard~~ — FIXED: `import 'server-only'` added to `typo3-client.ts`, package installed (commit c0b54bd)

**Verdict: PASS (current state is safe, but missing guardrail)**

#### AC-6: API-Basis-URL konfigurierbar (Staging vs. Produktion)
- [x] `TYPO3_BASE_URL` is fully configurable via env vars
- [x] `TYPO3_LOGIN_PATH` is a separate variable allowing different paths per environment
- [x] `typo3Fetch()` constructs URLs dynamically from `BASE_URL`

**Verdict: PASS**

### Edge Cases Status

#### EC-1: Ziel-Website nicht erreichbar - Fehlermeldung mit Retry-Option
- [x] `login()` throws `Typo3Error` with HTTP status on non-ok GET response
- [x] `api-status.tsx` shows "Erneut versuchen" Button that re-triggers the health check
- [x] Retry button calls `check()` which resets status to loading and re-fetches

**Verdict: PASS**

#### EC-2: Token ablaeuft waehrend App laeuft - Automatischer Re-Login
- [x] `typo3Fetch()` checks response status; on 401/403/500 it clears `cachedCookie` and re-authenticates
- [x] ~~BUG-3: Re-login triggered on HTTP 500~~ — FIXED: Re-login only on 401/403, 500 is treated as real server error

**Verdict: PARTIAL PASS**

#### EC-3: Falsche Credentials konfiguriert - Klare Fehlermeldung
- [x] If `fe_typo_user` cookie is not set after login POST, throws `Typo3Error` with "Login fehlgeschlagen..." message
- [x] If env vars are empty, throws with "TYPO3-Konfiguration unvollstaendig..." message

**Verdict: PASS**

#### EC-4: Unerwartete Antwortstruktur - Graceful Error Handling
- [x] `checkConnection()` wraps all errors in try/catch, returns `{ ok: false, message }`
- [x] `typo3Fetch()` does not parse response body itself -- consumers handle parsing
- [x] API routes that consume TYPO3 JSON have try/catch with fallback error messages

**Verdict: PASS**

### Security Audit Results

#### Authentication & Authorization
- [x] TYPO3 credentials stored server-side only, never in browser
- [x] No `NEXT_PUBLIC_` prefix on sensitive env vars
- [x] `/api/health` endpoint is protected by middleware (requires Supabase auth)
- [ ] BUG-4: `/api/health` is NOT in the `PUBLIC_ROUTES` list in middleware, so it requires Supabase authentication. This is secure but means the `ApiStatus` component (which calls `/api/health`) only works for logged-in users. This is likely intentional but worth noting.

#### Secrets Exposure
- [x] `.env.local` is in `.gitignore`
- [x] `.env.local.example` contains only dummy values
- [ ] BUG-5: `typo3-client.ts` has no `import 'server-only'` guard. The `server-only` npm package is not installed. If a developer accidentally imports `typo3-client.ts` from a Client Component, the TYPO3 credentials (email + password) would be bundled into client-side JavaScript. This is a defense-in-depth issue.

#### Input Validation
- [x] `extractFormFields()` uses regex to parse HTML -- no injection risk since it only reads, does not eval
- [x] Form data is URL-encoded via `URLSearchParams` which handles escaping

#### Security Headers
- [x] `X-Frame-Options: SAMEORIGIN` configured in `next.config.ts`
- [x] `X-Content-Type-Options: nosniff` configured
- [x] `Referrer-Policy: strict-origin-when-cross-origin` configured
- [x] `Permissions-Policy` restricts camera/mic/geo
- [ ] BUG-6: `X-Frame-Options` is set to `SAMEORIGIN` but security rules (`.claude/rules/security.md`) specify `DENY`. Already reported in PROJ-3 and PROJ-6 QA but remains unfixed.
- [ ] BUG-7: Missing `Strict-Transport-Security` header. Security rules require HSTS with `includeSubDomains`. Already reported in PROJ-3 and PROJ-6 QA but remains unfixed.

#### Rate Limiting
- [x] ~~BUG-8: No rate limiting on `/api/health`~~ — FIXED: `checkConnection()` caches result for 30s, prevents TYPO3 login spam

#### Credential Handling in HTML Parser
- [x] `extractFormFields()` correctly fills `user`/`pass` fields from server-side env vars only
- [ ] BUG-9: The regex matching in `extractFormFields()` is greedy with field name matching. Any `<input>` with `type="email"` or a name containing "email" gets the superuser email, and any `<input>` with `type="password"` or name containing "pass" gets the password. If the TYPO3 page contains additional forms (e.g., newsletter signup), credentials could be sent to unintended form fields. The fields are only sent to the same TYPO3 domain, so this is low severity but a code quality concern.

#### Infinite Re-Login Loop
- [x] ~~BUG-10: Infinite re-login loop on persistent 500 errors~~ — Resolved by BUG-3 fix: 500 no longer triggers re-login, loop impossible

### Cross-Browser / Responsive Testing

Note: Code-level review only. The `ApiStatus` component uses shadcn/ui Alert, Skeleton, and Button components which are well-tested across browsers. No custom CSS that would cause cross-browser issues.

- [x] `api-status.tsx` uses standard shadcn/ui components (Alert, Skeleton, Button)
- [x] No browser-specific CSS or JS APIs used
- [x] Layout uses Tailwind responsive classes (`max-w-6xl`, `px-4`, `py-8`)
- [x] `lang="de"` set on `<html>` element

### Bugs Found

#### BUG-1: Env variable names deviate from acceptance criteria
- **Severity:** Low
- **Steps to Reproduce:**
  1. Read Acceptance Criteria AC-1: expects `API_BASE_URL`, `API_SUPERUSER`, `API_PASSWORD`
  2. Read `src/lib/typo3-client.ts`: uses `TYPO3_BASE_URL`, `TYPO3_LOGIN_PATH`, `TYPO3_EMAIL`, `TYPO3_PASSWORD`
  3. Expected: Names match between spec and implementation
  4. Actual: Tech Design updated names but original AC and Technical Requirements still reference old names
- **Priority:** Nice to have (update spec to match implementation)

#### BUG-2: Missing `server-only` guard on typo3-client.ts
- **Severity:** High
- **Steps to Reproduce:**
  1. Note that `src/lib/typo3-client.ts` has no `import 'server-only'` statement
  2. Note that `server-only` npm package is not installed
  3. If a developer adds `import { typo3Fetch } from '@/lib/typo3-client'` in a Client Component, credentials would leak to browser
  4. Expected: Build-time error preventing client-side import
  5. Actual: No protection; import would succeed silently
- **Priority:** Fix before deployment

#### BUG-3: Re-login triggered on HTTP 500 (too aggressive)
- **Severity:** Medium
- **Steps to Reproduce:**
  1. TYPO3 server returns HTTP 500 for a legitimate server error (not auth-related)
  2. `typo3Fetch()` clears cached cookie and re-authenticates
  3. Expected: Only 401/403 trigger re-authentication
  4. Actual: 500 also triggers re-auth, masking real errors and causing unnecessary login traffic
- **Priority:** Fix in next sprint

#### BUG-4: /api/health requires Supabase authentication
- **Severity:** Low
- **Steps to Reproduce:**
  1. Call `GET /api/health` without a Supabase session cookie
  2. Middleware redirects to `/login`
  3. Expected: Health check accessible for monitoring (debatable)
  4. Actual: Requires authentication; only usable by logged-in users
- **Priority:** Nice to have (consider adding to PUBLIC_ROUTES if external monitoring is desired)

#### BUG-5: `server-only` npm package not installed
- **Severity:** High
- **Steps to Reproduce:**
  1. Run `ls node_modules/server-only` -- directory does not exist
  2. Even if `import 'server-only'` were added to `typo3-client.ts`, it would fail at build time
  3. Expected: Package installed as dependency
  4. Actual: Package missing
- **Priority:** Fix before deployment (prerequisite for BUG-2)

#### BUG-6: X-Frame-Options set to SAMEORIGIN instead of DENY
- **Severity:** Low
- **Steps to Reproduce:**
  1. Read `next.config.ts` line 10: `value: 'SAMEORIGIN'`
  2. Read `.claude/rules/security.md`: requires `DENY`
  3. Expected: `X-Frame-Options: DENY`
  4. Actual: `X-Frame-Options: SAMEORIGIN`
- **Priority:** Fix in next sprint (already reported in PROJ-3, PROJ-6)

#### BUG-7: Missing Strict-Transport-Security header
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Read `next.config.ts` -- no HSTS header configured
  2. Read `.claude/rules/security.md`: requires `Strict-Transport-Security` with `includeSubDomains`
  3. Expected: HSTS header present
  4. Actual: Missing
- **Priority:** Fix before deployment (already reported in PROJ-3, PROJ-6)

#### BUG-8: No rate limiting on /api/health
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Send rapid repeated requests to `/api/health`
  2. Each failed health check triggers a TYPO3 login attempt
  3. Expected: Rate limiting prevents abuse
  4. Actual: No rate limiting; could cause TYPO3 account lockout
- **Priority:** Fix in next sprint

#### BUG-9: Overly broad input field matching in extractFormFields()
- **Severity:** Low
- **Steps to Reproduce:**
  1. If TYPO3 login page contains additional forms with `type="email"` or `type="password"` inputs
  2. `extractFormFields()` would fill those with superuser credentials
  3. Expected: Only target the login form fields (`user` and `pass`)
  4. Actual: Any email/password type input gets credentials
- **Priority:** Nice to have

#### BUG-10: Potential infinite re-login loop on persistent 500 errors
- **Severity:** Medium
- **Steps to Reproduce:**
  1. TYPO3 API consistently returns HTTP 500
  2. Each `typo3Fetch()` call: clears cookie -> re-authenticates -> retries -> gets 500 again
  3. Next call repeats the cycle
  4. Expected: Circuit breaker or max retry limit
  5. Actual: Unbounded re-login attempts over time
- **Priority:** Fix in next sprint

### Summary
- **Acceptance Criteria:** 6/6 passed (functionally correct; 1 has spec-vs-implementation naming mismatch)
- **Edge Cases:** 3/4 passed, 1 partial (EC-2 re-login too aggressive on 500)
- **Bugs Found:** 10 total (0 critical, 2 high, 3 medium, 5 low)
- **Security:** Issues found (missing server-only guard, missing HSTS, no rate limiting)
- **Production Ready:** NO
- **Recommendation:** Fix BUG-2 + BUG-5 (install `server-only` package and add import guard) and BUG-7 (HSTS header) before deployment. Other bugs can be addressed in subsequent sprints.

## Deployment

- **Production URL:** https://24-tage-lauf.vercel.app
- **Deployed:** 2026-03-18
- **Platform:** Vercel (auto-deploy from GitHub main branch)
- **High-priority bugs fixed before deploy:** BUG-2/5 (server-only guard), BUG-7 (HSTS header)
