# PROJ-2: Anmeldung (Supabase Auth Login)

## Status: In Progress
**Created:** 2026-03-17
**Last Updated:** 2026-03-17

## Frontend Implementation Notes
- `src/app/login/page.tsx` — Login page with Suspense boundary for `useSearchParams`
- `src/components/login-form.tsx` — Client component: login form with email/password, Zod validation, error handling, password reset flow
- `src/components/app-header.tsx` — Client component: header with user display name and logout button (shows runner name from `runner_profiles` or email fallback)
- `src/app/runs/page.tsx` — Placeholder runs page (redirect target after login, to be replaced by PROJ-3)
- `src/app/page.tsx` — Root redirect updated from `/select` to `/runs`
- `src/app/layout.tsx` — Updated to use `AppHeader` component
- Middleware was already implemented in PROJ-1 (route protection + admin role check)
- All edge cases handled: wrong password, no profile, password reset via Supabase magic link

## Änderungshinweis
> Ursprünglich als "Läufer-Auswahl" geplant (anonyme Auswahl aus Liste).
> Geändert zu eigenem Login per Supabase Auth, da Benutzerverwaltung und
> Strava-Integration pro Läufer benötigt werden.

## Dependencies
- Requires: PROJ-1 (API-Konfiguration & Superuser-Authentifizierung)
- Requires: PROJ-6 (Benutzerverwaltung — Admin legt Accounts an)

## User Stories
- Als Läufer möchte ich mich mit E-Mail und Passwort anmelden, damit nur ich Zugriff auf meine Läufe habe.
- Als Läufer möchte ich angemeldet bleiben, damit ich nicht bei jedem Besuch neu einloggen muss.
- Als Läufer möchte ich mich abmelden können.
- Als nicht angemeldeter Nutzer möchte ich automatisch zur Login-Seite weitergeleitet werden.
- Als Läufer möchte ich eine verständliche Fehlermeldung erhalten, wenn meine Zugangsdaten falsch sind.

## Acceptance Criteria
- [ ] Login-Seite `/login` mit E-Mail + Passwort Formular
- [ ] Erfolgreicher Login → Redirect zu `/runs`
- [ ] Fehlgeschlagener Login → Fehlermeldung unter dem Formular
- [ ] Alle Routen außer `/login` sind geschützt (Redirect zu `/login` wenn nicht angemeldet)
- [ ] "Abmelden"-Button in der App sichtbar, der die Session beendet und zu `/login` leitet
- [ ] Session bleibt über Seiten-Reload erhalten (Supabase Auth Sessions sind persistent)
- [ ] Nach Login: Supabase-Profil wird gelesen → TYPO3-Läufer-UID ist bekannt

## Edge Cases
- Was passiert bei falschem Passwort? → Fehlermeldung "E-Mail oder Passwort falsch"
- Was passiert wenn der Account nicht existiert? → Gleiche Fehlermeldung (kein Hinweis ob E-Mail bekannt ist)
- Was passiert wenn der Account keinem TYPO3-Läufer zugeordnet ist? → Fehlermeldung "Dein Account ist noch nicht konfiguriert. Bitte Admin kontaktieren."
- Was passiert wenn das Supabase-Passwort vergessen wird? → "Passwort vergessen"-Link (Supabase Magic Link per E-Mail)
- Was passiert bei Session-Ablauf? → Automatische Weiterleitung zu `/login`

## Technical Requirements
- Supabase Auth (E-Mail + Passwort)
- Supabase Tabelle `runner_profiles`: `user_id` → `typo3_uid`, `typo3_name`
- Route Protection via Next.js Middleware (`src/middleware.ts`)
- Kein Self-Service-Registrierung — nur Admin kann Accounts anlegen (PROJ-6)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

**Seiten:**
- `/login` — öffentlich, Email + Passwort Formular
- Alle anderen Routen — geschützt via Middleware

**Auth-Flow:**
1. Nutzer öffnet App → Middleware prüft Supabase-Session
2. Keine Session → Redirect zu `/login`
3. Login-Formular → `supabase.auth.signInWithPassword()` → Session gesetzt
4. Middleware lädt `runner_profiles` → TYPO3-UID in Session-Cookie gespeichert
5. `/runs` page liest TYPO3-UID aus Session → lädt Läufe

**Supabase-Schema:**
```
Tabelle: runner_profiles
- id          uuid (PK)
- user_id     uuid (FK → auth.users, unique)
- typo3_uid   integer (TYPO3 Läufer-UID)
- typo3_name  text (Name zur Anzeige)
- created_at  timestamptz
```

**Middleware** (`src/middleware.ts`):
- Prüft Supabase-Session auf allen Routen außer `/login`
- Kein Profil → Redirect zu `/login` mit Hinweis

**Komponenten:**
- `src/app/login/page.tsx` — Login-Formular (shadcn/ui Form + react-hook-form + Zod)
- `src/middleware.ts` — Route Protection
- `src/lib/supabase.ts` — wird aktiviert (war bisher Platzhalter)

**RLS-Policy (Supabase):**
- `runner_profiles`: Nutzer darf nur seinen eigenen Eintrag lesen

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
