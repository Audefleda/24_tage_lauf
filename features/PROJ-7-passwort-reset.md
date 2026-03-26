# PROJ-7: Passwort-Reset

## Status: Deployed
**Created:** 2026-03-18
**Last Updated:** 2026-03-18

## Dependencies
- Requires: PROJ-2 (Anmeldung — Supabase Auth)

## User Stories
- Als Läufer möchte ich mein vergessenes Passwort zurücksetzen können, damit ich wieder Zugang zu meinem Account bekomme.
- Als Läufer möchte ich nach dem Klick auf "Passwort vergessen" eine E-Mail erhalten mit einem Link zum Zurücksetzen.
- Als Läufer möchte ich über den Link in der E-Mail direkt zu einem Formular in der App gelangen, wo ich mein neues Passwort eingeben kann.
- Als Läufer möchte ich nach erfolgreichem Zurücksetzen automatisch eingeloggt und zur Übersicht weitergeleitet werden.

## Acceptance Criteria
- [ ] Login-Seite hat einen "Passwort vergessen"-Link/-Button
- [ ] Nach Eingabe der E-Mail und Klick auf "Zurücksetzen" wird eine Rücksetz-Mail von Supabase verschickt
- [ ] Der Link in der Rücksetz-Mail führt zu unserer App (nicht ins Nirgendwo)
- [ ] Die App verarbeitet den Supabase Auth-Callback-Token korrekt (Token-Exchange)
- [ ] Nach Token-Exchange wird der Nutzer auf eine "Neues Passwort setzen"-Seite weitergeleitet
- [ ] Das Formular hat zwei Felder: "Neues Passwort" und "Passwort bestätigen"
- [ ] Validierung: mindestens 8 Zeichen, beide Felder müssen übereinstimmen
- [ ] Nach erfolgreichem Speichern: Nutzer ist eingeloggt und wird zu `/runs` weitergeleitet
- [ ] Abgelaufene oder ungültige Tokens zeigen eine verständliche Fehlermeldung mit Link zurück zur Login-Seite
- [ ] Der "Passwort vergessen"-Bereich ist vom Login-Formular klar getrennt (eigene Unterseite oder ausklappbarer Bereich)

## Edge Cases
- Was passiert wenn der Token abgelaufen ist (Supabase-Standard: 1 Stunde)? → Fehlermeldung "Link abgelaufen", Link zurück zu Login mit Hinweis erneut anzufordern
- Was passiert wenn ein Nutzer den Reset-Link mehrfach klickt? → Token ist nach einmaliger Nutzung ungültig, Fehlermeldung
- Was passiert wenn die E-Mail nicht im System existiert? → Aus Sicherheitsgründen trotzdem Erfolgsmeldung anzeigen ("Falls diese E-Mail registriert ist, wurde eine Mail verschickt")
- Was passiert wenn die Passwörter nicht übereinstimmen? → Client-seitige Validierung, kein API-Aufruf
- Was passiert wenn der Nutzer den Link in einem anderen Browser öffnet? → Supabase PKCE-Flow muss berücksichtigt werden

## Technical Notes
- Supabase verschickt die Reset-Mail mit einem Link der Form: `https://app.com/auth/callback?token_hash=...&type=recovery`
- Die App benötigt eine Route `src/app/auth/callback/route.ts` die den Token gegen eine Session tauscht
- Der `redirectTo`-Parameter beim `resetPasswordForEmail()`-Aufruf muss auf die Production-URL zeigen: `https://24-tage-lauf.vercel.app/auth/callback?next=/reset-password`
- In Supabase Dashboard muss `https://24-tage-lauf.vercel.app/**` als erlaubte Redirect-URL eingetragen sein

## Implementation Notes (Frontend)

### Files Created
- `src/app/auth/callback/route.ts` — Server-side route handler that exchanges the Supabase `token_hash` for a session via `verifyOtp()`, then redirects to `/reset-password`. On error, redirects to `/login?error=...`.
- `src/app/reset-password/page.tsx` — Page with Suspense boundary and loading skeleton.
- `src/components/reset-password-form.tsx` — Client component with two password fields (new + confirm), Zod validation (min 8 chars, must match), calls `supabase.auth.updateUser()`, redirects to `/runs` on success.

### Files Modified
- `src/middleware.ts` — Added `/auth/callback` and `/reset-password` to `PUBLIC_ROUTES` so unauthenticated users (and the callback itself) can access these routes.
- `src/components/login-form.tsx` — Changed `redirectTo` in `resetPasswordForEmail()` from `/login` to `/auth/callback?next=/reset-password`. Added handling for `?error=` query param so callback errors are displayed on the login page.

### Design Decisions
- The "Passwort vergessen" section was already implemented as a toggled area within the login form (from PROJ-2). This was kept as-is since it provides a clean UX with clear separation.
- The reset-password form follows the same Card + shadcn Form pattern as the login form for visual consistency.
- Security: non-existent emails still show a generic success message (already implemented in PROJ-2).
- The auth callback route uses `verifyOtp` with `token_hash` which supports cross-browser usage (no PKCE code verifier needed).

### Bug Fixes (Frontend)

**BUG-3 fix:** `/reset-password` page now checks for an active Supabase session on mount. If no session exists, the user is immediately redirected to `/login` with an error message instead of showing the form that would fail on submit.

**BUG-4 fix:** The `next` query parameter in `/auth/callback/route.ts` is now validated against an allowlist of permitted redirect paths (`/runs`, `/reset-password`, `/admin`). The parameter must start with `/` and must not start with `//`. Any invalid value falls back to `/runs`. This prevents open redirect attacks.

**BUG-5 fix:** Password update now goes through a new server-side API route `POST /api/auth/update-password` which validates the password with Zod (min 8 chars) before calling `supabase.auth.updateUser()`. The client component `reset-password-form.tsx` was updated to call this API instead of the Supabase client directly.

**BUG-6 fix:** Added a 60-second cooldown timer to the password reset email request in `login-form.tsx`. After sending a reset email, the button is disabled and shows a countdown ("Erneut senden in Xs"). This provides application-level rate limiting in addition to Supabase's built-in throttling.

### Additional Files Created (Bug Fixes)
- `src/app/api/auth/update-password/route.ts` — Server-side API route with Zod validation for password updates

---
<!-- Sections below are added by subsequent skills -->

## QA Test Results

**Tested:** 2026-03-18
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Code review + build verification + static analysis (dev server running but curl blocked by sandbox)

### Acceptance Criteria Status

#### AC-1: Login-Seite hat einen "Passwort vergessen"-Link/-Button
- [x] PASS: `login-form.tsx` line 214-224 renders a "Passwort vergessen?" button that toggles `showResetInfo` state

#### AC-2: Nach Eingabe der E-Mail und Klick auf "Zuruecksetzen" wird eine Ruecksetz-Mail von Supabase verschickt
- [x] PASS: `handlePasswordReset()` in `login-form.tsx` line 108-131 calls `supabase.auth.resetPasswordForEmail()` with the entered email
- [x] PASS: `redirectTo` is correctly set to `${window.location.origin}/auth/callback?next=/reset-password`

#### AC-3: Der Link in der Ruecksetz-Mail fuehrt zu unserer App
- [x] PASS: The `redirectTo` parameter uses `window.location.origin` which resolves to the app's domain. Supabase will include `token_hash` and `type=recovery` params.
- [ ] BUG-1: Technical Note says `redirectTo` should point to production URL `https://24-tage-lauf.vercel.app/auth/callback?next=/reset-password`, but implementation uses `window.location.origin` which is dynamic. This is actually BETTER for dev/staging, but the Supabase Dashboard redirect URL allowlist must include both localhost and production URLs.

#### AC-4: Die App verarbeitet den Supabase Auth-Callback-Token korrekt (Token-Exchange)
- [x] PASS: `auth/callback/route.ts` extracts `token_hash` and `type` from search params and calls `supabase.auth.verifyOtp()` to exchange them for a session

#### AC-5: Nach Token-Exchange wird der Nutzer auf eine "Neues Passwort setzen"-Seite weitergeleitet
- [x] PASS: On successful `verifyOtp()`, the callback redirects to the `next` param which defaults to `/runs` but is set to `/reset-password` via the reset flow

#### AC-6: Das Formular hat zwei Felder: "Neues Passwort" und "Passwort bestaetigen"
- [x] PASS: `reset-password-form.tsx` renders two password fields: "Neues Passwort" and "Passwort bestaetigen"

#### AC-7: Validierung: mindestens 8 Zeichen, beide Felder muessen uebereinstimmen
- [x] PASS: Zod schema at line 29-39 enforces `min(8)` and `.refine()` checks password match
- [x] PASS: Client-side validation via `zodResolver` prevents form submission if invalid

#### AC-8: Nach erfolgreichem Speichern: Nutzer ist eingeloggt und wird zu `/runs` weitergeleitet
- [x] PASS: `onSubmit()` calls `supabase.auth.updateUser()` and on success calls `router.push('/runs')` and `router.refresh()`

#### AC-9: Abgelaufene oder ungueltige Tokens zeigen eine verstaendliche Fehlermeldung mit Link zurueck zur Login-Seite
- [x] PASS: Callback route redirects to `/login?error=Der Link ist ungueltig oder abgelaufen...` on failure
- [x] PASS: Login form reads `?error=` from search params and displays it in an Alert

#### AC-10: Der "Passwort vergessen"-Bereich ist vom Login-Formular klar getrennt
- [x] PASS: Toggle-based separation -- clicking "Passwort vergessen?" hides the login form and shows the reset email form. "Zurueck zum Login" button returns to login.

### Edge Cases Status

#### EC-1: Token abgelaufen (Supabase-Standard: 1 Stunde)
- [x] PASS: `verifyOtp()` will return an error for expired tokens, callback redirects to `/login?error=...`

#### EC-2: Reset-Link mehrfach geklickt
- [x] PASS: Supabase invalidates `token_hash` after first use; subsequent attempts will fail `verifyOtp()` and redirect to error

#### EC-3: E-Mail nicht im System
- [x] PASS: After `resetPasswordForEmail()` succeeds (Supabase returns success even for non-existent emails), the UI shows "Falls ein Account mit dieser E-Mail existiert, wurde eine E-Mail zum Zuruecksetzen des Passworts gesendet"
- [ ] BUG-2: If `resetPasswordForEmail()` returns an error (e.g., network issue), the error message is shown. However, the `resetSent` state is not set, so the user stays on the form -- this is correct behavior.

#### EC-4: Passwoerter stimmen nicht ueberein
- [x] PASS: Zod `.refine()` validates match client-side; `FormMessage` displays error under confirmPassword field

#### EC-5: Link in anderem Browser geoeffnet
- [x] PASS: Implementation uses `verifyOtp` with `token_hash` (not PKCE code exchange), which works cross-browser as noted in design decisions

### Security Audit Results

#### Authentication
- [x] Middleware correctly lists `/auth/callback` and `/reset-password` as PUBLIC_ROUTES -- these must be accessible without auth
- [ ] BUG-3: The `/reset-password` page is accessible to ANYONE without authentication. A user who navigates directly to `/reset-password` without going through the callback flow will see the form, but `supabase.auth.updateUser()` will fail because there is no active session. While this fails gracefully (error message shown), it would be better UX to detect the missing session and redirect to login immediately rather than letting the user fill out the form first.

#### Authorization
- [x] `updateUser()` only updates the currently authenticated user's password -- no IDOR possible
- [x] No user can reset another user's password through this flow

#### Open Redirect via `next` Parameter
- [ ] BUG-4: The `next` query parameter in `/auth/callback` is used directly in `NextResponse.redirect(new URL(next, origin))`. While `new URL(next, origin)` with a relative path is safe, an attacker could craft a callback URL with `next=//evil.com` or `next=https://evil.com`. The `new URL('//evil.com', 'https://app.com')` resolves to `https://evil.com` -- this is an **open redirect vulnerability**. An attacker could craft a phishing link: `/auth/callback?token_hash=VALID&type=recovery&next=//evil.com/phishing-page` which, after valid token exchange, redirects the victim to a malicious site.

#### XSS via `error` Query Parameter
- [x] PASS: The `error` query parameter from the callback is rendered inside a React `<AlertDescription>` component. React auto-escapes string content, so XSS via this parameter is not possible. The error message is also hardcoded in the callback route (not user-controlled from the URL query), so even the callback-originated error is safe.
- [x] PASS: However, the login page reads the `error` param from the URL directly (`searchParams.get('error')`). While React escapes it, a user could craft a URL like `/login?error=Any+message+here` to display arbitrary (but non-HTML) text. This is a minor social engineering vector but not exploitable for XSS.

#### Input Validation
- [x] Client-side Zod validation enforces min 8 characters and match
- [ ] BUG-5: No server-side password validation. The `updateUser()` call relies entirely on Supabase's built-in password policy. If Supabase has weaker requirements than the app's stated minimum of 8 characters, a crafted API call bypassing the form could set a shorter password. However, since Supabase's default minimum is 6 characters, this is a minor discrepancy. The security rules state "Validate ALL user input on the server side with Zod" -- this is violated.

#### Rate Limiting
- [ ] BUG-6: No rate limiting on the password reset email request. An attacker could spam `resetPasswordForEmail()` to flood a victim's inbox. Supabase has built-in rate limiting (default 1 email per 60 seconds per email address), but there is no application-level rate limiting. The security rules require "Implement rate limiting on authentication endpoints."

#### CSRF
- [x] PASS: The password reset form uses `supabase.auth.updateUser()` which requires an active session token, providing CSRF protection

#### Secrets
- [x] No secrets exposed in client-side code. Only `NEXT_PUBLIC_` prefixed env vars used in browser client.

### Cross-Browser Analysis (Code Review)
- [x] Chrome: Standard React/Next.js -- no browser-specific APIs used
- [x] Firefox: No compatibility issues identified in code
- [x] Safari: No compatibility issues identified in code
- Note: `verifyOtp` with `token_hash` avoids PKCE issues that would affect cross-browser scenarios

### Responsive Analysis (Code Review)
- [x] 375px (Mobile): Card uses `w-full max-w-sm` with centering -- will fill mobile width appropriately
- [x] 768px (Tablet): Card will be centered with `max-w-sm` (384px) constraint
- [x] 1440px (Desktop): Card will be centered, same `max-w-sm` constraint
- [x] Both pages (login reset area and reset-password page) use identical layout pattern

### Bugs Found

#### BUG-1: Supabase Dashboard Redirect URL Configuration Not Verified
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Deploy app to production at `https://24-tage-lauf.vercel.app`
  2. Request password reset
  3. Expected: Email contains link to `https://24-tage-lauf.vercel.app/auth/callback?...`
  4. Actual: If Supabase redirect URL allowlist does not include the production domain, the reset email link will not work
- **Priority:** Fix before deployment (configuration check, not code fix)

#### BUG-2: (Withdrawn -- not a bug, correct behavior on network error)

#### BUG-3: /reset-password Page Accessible Without Active Session
- **Severity:** Low
- **Steps to Reproduce:**
  1. Open `/reset-password` directly in browser without going through reset flow
  2. Fill in both password fields with a valid password (8+ chars, matching)
  3. Click "Passwort speichern"
  4. Expected: Immediate redirect to login or message that session is missing
  5. Actual: Form submits, `updateUser()` fails, generic error message shown
- **Priority:** Nice to have (UX improvement, no security impact)

#### BUG-4: Open Redirect Vulnerability in Auth Callback `next` Parameter
- **Severity:** Critical
- **Steps to Reproduce:**
  1. Obtain a valid password reset token (or use social engineering with a phishing link)
  2. Craft URL: `/auth/callback?token_hash=VALID_TOKEN&type=recovery&next=//evil.com`
  3. Visit the URL
  4. Expected: Redirect only to app-internal paths
  5. Actual: After successful token exchange, user is redirected to `https://evil.com`
- **Note:** `new URL('//evil.com', 'https://app.com')` resolves to `https://evil.com/`. This allows an attacker to redirect authenticated users to phishing pages.
- **Fix suggestion:** Validate that `next` starts with `/` and does not start with `//`. Or use a hardcoded allowlist of valid redirect paths.
- **Priority:** Fix before deployment

#### BUG-5: No Server-Side Password Validation
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Obtain active session via callback flow
  2. Call Supabase `updateUser` API directly with a 3-character password
  3. Expected: Server rejects password shorter than 8 chars
  4. Actual: Supabase may accept it (default minimum is 6 chars)
- **Note:** Violates security rule "Validate ALL user input on the server side with Zod"
- **Priority:** Fix in next sprint

#### BUG-6: No Application-Level Rate Limiting on Password Reset Requests
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Go to login page, click "Passwort vergessen?"
  2. Enter any email address
  3. Click "Passwort zuruecksetzen" rapidly many times
  4. Expected: App limits requests (e.g., 1 per minute)
  5. Actual: Each click triggers a new `resetPasswordForEmail()` call (though Supabase may throttle at their end)
- **Note:** Violates security rule "Implement rate limiting on authentication endpoints"
- **Priority:** Fix in next sprint

### Summary
- **Acceptance Criteria:** 10/10 passed (all functional criteria met)
- **Edge Cases:** 5/5 handled correctly
- **Bugs Found:** 5 total (1 critical, 0 high, 3 medium, 1 low)
- **Security:** Open redirect vulnerability (BUG-4) is critical
- **Build:** Compiles successfully, no TypeScript errors, 0 lint errors
- **Production Ready:** NO
- **Recommendation:** Fix BUG-4 (open redirect) before deployment. BUG-1 requires Supabase Dashboard configuration verification. BUG-5 and BUG-6 should be addressed in next sprint.

## Deployment
_To be added by /deploy_
