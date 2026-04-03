# PROJ-23: Externer Webhook-Token (Make.com / Zapier Alternative)

## Status: In Progress
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
- [ ] **AC-2:** Der Bereich zeigt: Token-Status (aktiv / kein Token), den Token selbst (maskiert, mit "Anzeigen"-Button), Button "Token generieren" (wenn kein Token) oder "Token neu generieren" (wenn Token bereits vorhanden)
- [ ] **AC-3:** Bei Klick auf "Token generieren" / "Token neu generieren" wird ein kryptografisch sicherer zufälliger Token (min. 32 Byte, hex-kodiert) erzeugt, gehasht in Supabase gespeichert, und dem Nutzer **einmalig im Klartext** angezeigt (mit Hinweis, dass er nicht erneut einsehbar ist)
- [ ] **AC-4:** Der Klartexttoken wird nach dem Schließen des Dialogs nie wieder angezeigt — nur der Hinweis "Token aktiv (seit [Datum])"
- [ ] **AC-5:** In der Anleitung wird die vollständige Webhook-URL `POST /api/webhook/external` angezeigt (inkl. `Authorization: Bearer <token>` Header und Beispiel-Body)
- [ ] **AC-6:** Der Endpunkt `POST /api/webhook/external` akzeptiert einen `Authorization: Bearer <token>` Header und identifiziert den Läufer anhand des Tokens (Vergleich mit gespeichertem Hash)
- [ ] **AC-7:** Der erwartete Request-Body ist: `{ "date": "YYYY-MM-DD", "distance_km": <Zahl> }` — beide Felder sind Pflichtfelder und werden mit Zod validiert
- [ ] **AC-8:** Bei gültigem Token und korrektem Body wird der Lauf über die bestehende TYPO3-Update-Logik eingetragen (alle Läufe des Nutzers werden ersetzt — wie bei PROJ-4 und PROJ-5)
- [ ] **AC-9:** Der Endpunkt gibt immer innerhalb von 5 Sekunden eine Antwort zurück (Make.com-Timeout-Anforderung)
- [ ] **AC-10:** Fehlerhafte Requests werden mit sprechenden HTTP-Status-Codes beantwortet: `401` (kein / ungültiger Token), `422` (Validierungsfehler), `500` (TYPO3-Fehler)
- [ ] **AC-11:** Das Eintragen in TYPO3 durch den externen Webhook wird im TYPO3 Request Log (PROJ-8) erfasst
- [ ] **AC-12:** Ein Läufer ohne zugeordnetes TYPO3-Profil erhält `422` mit einer klaren Fehlermeldung ("Kein TYPO3-Läuferprofil zugeordnet")

## Edge Cases

- Was passiert, wenn der Nutzer "Token neu generieren" klickt? → Der alte Token wird sofort ungültig. Laufende Make.com-Szenarien schlagen bis zur Token-Aktualisierung dort mit `401` fehl. Nutzer wird im Dialog darauf hingewiesen.
- Was passiert, wenn Make.com denselben Lauf zweimal schickt (Retry nach Fehler)? → Der Endpunkt ist idempotent: TYPO3 enthält nach dem zweiten Aufruf denselben Stand wie nach dem ersten (letzter Stand gewinnt).
- Was passiert, wenn `distance_km` als String statt Number geschickt wird? → Zod-Validierung schlägt fehl → `422`. In der Anleitung steht das korrekte Format.
- Was passiert, wenn `date` kein gültiges Datum ist (z.B. `"2026-13-45"`)? → Zod-Validierung schlägt fehl → `422`.
- Was passiert, wenn der Läufer gleichzeitig PROJ-5 (Strava OAuth) und PROJ-23 (externen Webhook) aktiv hat? → Beide funktionieren unabhängig. Es kann zu doppelten Einträgen kommen, wenn Make.com UND Strava dieselbe Aktivität melden. Das ist akzeptabel (idempotent, TYPO3 enthält nach beiden Calls denselben Stand).
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

### Keine neuen npm-Pakete erforderlich

Alle benötigten Funktionen sind durch bestehende Infrastruktur oder Node.js-Built-ins abgedeckt.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
