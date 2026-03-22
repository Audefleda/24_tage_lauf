# PROJ-10: Erstanmeldung — Initiales Passwort setzen

## Status: Deployed
**Created:** 2026-03-21
**Last Updated:** 2026-03-21 (deployed)

## Dependencies
- Requires: PROJ-2 (Anmeldung — Supabase Auth) — Auth-Infrastruktur muss vorhanden sein
- Requires: PROJ-7 (Passwort-Reset) — `/auth/callback` Route und `/reset-password`-Seite müssen existieren

## User Stories
- Als neu angelegter Benutzer möchte ich beim ersten Klick auf den Einladungslink sofort zur Passwort-Setzen-Maske weitergeleitet werden, damit ich mein initiales Passwort selbst wählen kann.
- Als neu angelegter Benutzer möchte ich nicht mit einem temporären Passwort eingeloggt werden, sondern direkt mein eigenes Passwort setzen.
- Als Administrator möchte ich, dass neu angelegte Benutzer automatisch ihr Passwort setzen müssen, ohne dass ich ihnen ein temporäres Passwort mitteilen muss.

## Acceptance Criteria
- [ ] Wenn Supabase eine Einladungs-E-Mail versendet (Admin legt User über Supabase Dashboard an mit "Send invite"), enthält der Link einen Token vom Typ `invite`
- [ ] Wenn ein User über Supabase Dashboard angelegt wird und sich erstmalig über einen Magic-Link anmeldet, enthält der Token den Typ `signup`
- [ ] Die bestehende Route `/auth/callback` verarbeitet neben `type=recovery` auch `type=invite` und `type=signup`
- [ ] Nach erfolgreichem Token-Exchange mit `type=invite` oder `type=signup` wird der Benutzer zu `/reset-password` weitergeleitet — **nicht** zu `/runs`
- [ ] Die `/reset-password`-Seite ist identisch für Erstanmeldung und Passwort-Reset — kein separates UI nötig
- [ ] Nach erfolgreichem Setzen des Passworts auf `/reset-password` wird der Benutzer zu `/runs` weitergeleitet (bestehende Logik, keine Änderung nötig)
- [ ] Abgelaufene oder ungültige Einladungs-Tokens zeigen dieselbe Fehlermeldung wie bei abgelaufenen Reset-Links: Fehlermeldung mit Link zurück zur Login-Seite

## Edge Cases
- Was passiert wenn der Einladungslink abgelaufen ist (Supabase Standard: 24h für Invites)? → Gleiche Fehlerbehandlung wie bei abgelaufenen Reset-Links: Redirect zu `/login?error=...`
- Was passiert wenn der Benutzer den Einladungslink mehrfach klickt? → Nach erstem Klick und Token-Exchange ist der Token ungültig → Fehlermeldung beim zweiten Klick
- Was passiert wenn der Benutzer den Link in einem anderen Browser öffnet? → PKCE-Flow muss berücksichtigt werden (bereits in PROJ-7 implementiert)
- Was passiert wenn der Benutzer die `/reset-password`-Seite verlässt ohne das Passwort zu setzen? → Beim nächsten Login-Versuch muss er das normale Login nutzen; die Einladung ist verbraucht
- Was passiert wenn der Benutzer bereits eingeloggt ist und nochmals auf einen alten Einladungslink klickt? → Token ist ungültig → Fehlermeldung, kein Schaden

## Technical Requirements
- Änderung ausschließlich in `src/app/auth/callback/route.ts` — die Route muss `type=invite` und `type=signup` zusätzlich zu `type=recovery` erkennen und in beiden Fällen zu `/reset-password` weiterleiten
- Keine neuen Seiten, keine neuen Komponenten — `/reset-password` wird wiederverwendet
- Keine Änderungen an der Admin-Seite oder am Supabase Dashboard erforderlich

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_Skipped — change is minimal (single file, ~15 lines)._

## Implementation Notes (Backend)
**Changed file:** `src/app/auth/callback/route.ts`

**What was done:**
- Added a `PASSWORD_REQUIRED_TYPES` set containing `recovery`, `invite`, and `signup`
- The callback now checks if the `type` URL parameter matches one of these types
- If so, the redirect destination is forced to `/reset-password` regardless of the `next` parameter
- The legacy OTP verification flow now accepts `invite` as a valid type (in addition to `recovery` and `email`)
- No new pages, components, or API routes were created -- the existing `/reset-password` page is reused as-is
- Error handling for expired/invalid tokens remains unchanged (redirect to `/login?error=...`)

## QA Test Results

**Tested:** 2026-03-21
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Code review + build verification (no live Supabase invite tokens available for end-to-end testing; all results below are based on static analysis of the changed code and its integration with the existing auth flow)

### Acceptance Criteria Status

#### AC-1: Supabase invite email contains token type `invite`
- [x] PASS (by design) -- Supabase Dashboard "Send invite" generates `type=invite` tokens. This is Supabase behavior, not app code.

#### AC-2: Supabase magic-link for new users contains token type `signup`
- [x] PASS (by design) -- Supabase generates `type=signup` for magic-link sign-ups. This is Supabase behavior, not app code.

#### AC-3: `/auth/callback` processes `type=invite` and `type=signup` in addition to `type=recovery`
- [x] PASS -- `PASSWORD_REQUIRED_TYPES` set on line 17 contains all three types: `recovery`, `invite`, `signup`
- [x] PASS -- The `needsPasswordSetup` check on line 27 correctly matches against all three types
- [x] PASS -- The legacy OTP flow on line 70-75 now accepts `invite` in the type cast (previously only `recovery | email`)

#### AC-4: After successful token exchange with `type=invite` or `type=signup`, user is redirected to `/reset-password` (not `/runs`)
- [x] PASS -- Line 41: `const next = needsPasswordSetup ? '/reset-password' : validatedNext` forces redirect to `/reset-password` for all three password-required types
- [x] PASS -- The `next` query parameter is ignored when `needsPasswordSetup` is true, preventing any bypass via `?next=/runs`

#### AC-5: `/reset-password` page is identical for first login and password reset (no separate UI)
- [x] PASS -- No new pages or components were created. The existing `ResetPasswordForm` component is reused. Title "Neues Passwort setzen" is appropriate for both use cases.

#### AC-6: After setting password on `/reset-password`, user is redirected to `/runs`
- [x] PASS -- `reset-password-form.tsx` line 94: `router.push('/runs')` is unchanged from PROJ-7

#### AC-7: Expired or invalid invite tokens show error message with link back to login
- [x] PASS -- Lines 78-83 in callback: on token exchange failure, redirects to `/login?error=Der Link ist ungueltig oder abgelaufen...`
- [x] PASS -- Login page reads `error` search param and displays it in an alert

### Edge Cases Status

#### EC-1: Expired invite link (24h default)
- [x] PASS -- Supabase returns error on `exchangeCodeForSession` or `verifyOtp` for expired tokens. Callback falls through to error redirect on line 78-83.

#### EC-2: User clicks invite link multiple times
- [x] PASS -- After first successful exchange, the token/code is consumed. Second click triggers error flow, redirecting to `/login?error=...`

#### EC-3: User opens invite link in different browser (PKCE)
- [x] PASS -- PKCE flow with `code` parameter is handled on lines 63-66. If opened in a different browser, the PKCE code verifier won't match and Supabase returns an error, which correctly falls through to the error redirect.

#### EC-4: User leaves `/reset-password` without setting password
- [x] PASS -- The invite token is already consumed. The session exists but no password is set. User must use "Passwort vergessen?" on the login page to get a new reset link. The `reset-password-form.tsx` session check (lines 51-62) will redirect to login if the session expires.

#### EC-5: Already logged-in user clicks old invite link
- [x] PASS -- The old token is invalid, so the exchange fails and user is redirected to `/login?error=...`. No session corruption occurs because the `createServerClient` in the callback creates a fresh client per request.

### Security Audit Results

- [x] **Open redirect prevention:** The `ALLOWED_REDIRECT_PATHS` allowlist (line 32) prevents open redirects. The `needsPasswordSetup` override further ensures invite/signup flows cannot be redirected elsewhere.
- [x] **Token type spoofing:** An attacker cannot forge `type=invite` to bypass auth because the token exchange itself (`exchangeCodeForSession` or `verifyOtp`) validates the token server-side with Supabase. A forged `type` with no valid `code` or `token_hash` will fail.
- [x] **Password update requires authentication:** The `/api/auth/update-password` endpoint checks for authenticated session (line 33-42) before updating.
- [x] **Server-side validation:** Password minimum length is validated server-side with Zod (line 11-15 in update-password route).
- [x] **No exposed secrets:** No API keys or credentials in client-side code related to this change.
- [x] **No XSS via error messages:** Error messages are hardcoded strings, not user-supplied input.

### Bugs Found

#### BUG-1: Legacy OTP type cast missing `signup`
- **Severity:** Low
- **Steps to Reproduce:**
  1. Look at `src/app/auth/callback/route.ts` line 72
  2. The type assertion is `type as 'recovery' | 'email' | 'invite'`
  3. Expected: Should include `'signup'` since `PASSWORD_REQUIRED_TYPES` includes it and `EmailOtpType` in Supabase accepts it
  4. Actual: `'signup'` is missing from the type assertion
- **Impact:** No runtime impact since `as` is a compile-time-only assertion and Supabase accepts `signup` as a valid `EmailOtpType`. However, the cast is misleading and could cause confusion for future developers. A TypeScript-strict project might flag this as an inaccuracy.
- **Priority:** Nice to have -- fix when convenient

#### BUG-2: No dedicated UI messaging for first-time users on `/reset-password`
- **Severity:** Low
- **Steps to Reproduce:**
  1. Admin creates user via Supabase Dashboard with "Send invite"
  2. User clicks invite link, arrives at `/reset-password`
  3. Expected: Page could say "Willkommen! Bitte setze dein Passwort" or similar first-time messaging
  4. Actual: Page shows "Neues Passwort setzen" / "Gib dein neues Passwort ein" -- which technically works but is slightly confusing since the user never had an "old" password
- **Impact:** Minor UX confusion for first-time users. The page is fully functional.
- **Priority:** Nice to have -- cosmetic improvement

### Cross-Browser Assessment
- The change is entirely server-side (route handler logic). No client-side rendering changes were made.
- The `/reset-password` page UI was already tested under PROJ-7 and remains unchanged.
- No cross-browser or responsive concerns for this feature since no UI changes were introduced.

### Build Verification
- [x] `npm run build` completes successfully with no errors or warnings related to the callback route

### Summary
- **Acceptance Criteria:** 7/7 passed
- **Edge Cases:** 5/5 handled correctly
- **Bugs Found:** 2 total (0 critical, 0 high, 0 medium, 2 low)
- **Security:** Pass -- no vulnerabilities found
- **Production Ready:** YES
- **Recommendation:** Deploy. The two Low-severity items are cosmetic/code-quality improvements that can be addressed in a future cleanup pass.

## Deployment

**Deployed:** 2026-03-21
**Production URL:** https://24-tage-lauf.vercel.app/auth/callback (verarbeitet type=invite/signup)
**Changed files:** `src/app/auth/callback/route.ts`, `src/components/reset-password-form.tsx`

### Bug Fixes shipped
- BUG-1 (Low): `'signup'` zum Type-Cast in `verifyOtp()` ergänzt
- BUG-2 (Low): Erstanmeldungs-UI — Callback übergibt `?welcome=true`, Formular zeigt "Willkommen!" für Einladungsflows

### Post-Deploy Fix (2026-03-22): Implicit Flow

**Root cause:** Die Einladungs-E-Mail von Supabase nutzt `redirect_to=https://24-tage-lauf.vercel.app/` (Root-URL, kein `/auth/callback`). Supabase verwendet für Invites den **Implicit Flow** (nicht PKCE) — die Tokens landen im **URL-Hash-Fragment** (`#access_token=...&type=invite`), nicht als `?code=`.

**Problem:** Das Middleware sieht den Hash nicht (wird vom Browser nie an den Server gesendet). Es leitet unauthentifizierte Anfragen an `/` zu `/login` um. Der Browser bewahrt das Hash-Fragment beim Redirect. Die Login-Seite hat das Hash-Fragment nicht ausgewertet.

**Fix 1** (`src/middleware.ts`): Leitet Anfragen mit `?code=` auf beliebigen Routen zu `/auth/callback` weiter (für PKCE-Flows, die nicht auf `/auth/callback` landen).

**Fix 2** (`src/components/login-form.tsx`): `useEffect` erkennt `#access_token` im Hash, ruft `supabase.auth.setSession()` auf und leitet bei `type=invite`/`signup` zu `/reset-password?welcome=true` weiter.

**Verifiziert:** 2026-03-22 — End-to-End-Test mit echtem Supabase-Einladungslink erfolgreich.
