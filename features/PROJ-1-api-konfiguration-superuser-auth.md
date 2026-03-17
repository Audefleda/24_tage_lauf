# PROJ-1: API-Konfiguration & Superuser-Authentifizierung

## Status: In Review
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
- [ ] Superuser-Credentials (URL, Username, Passwort) sind als Env-Variablen konfigurierbar (`API_BASE_URL`, `API_SUPERUSER`, `API_PASSWORD`)
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

## Technical Requirements
- Auth erfolgt server-seitig (Next.js API Route oder Server Action), damit Credentials nie im Browser landen
- API-Client als Singleton in `src/lib/api-client.ts`
- Umgebungsvariablen: `API_BASE_URL`, `API_SUPERUSER`, `API_PASSWORD` (alle server-only, kein `NEXT_PUBLIC_` Prefix)

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
_To be added by /qa_

## Deployment
_To be added by /deploy_
