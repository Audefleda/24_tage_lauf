# PROJ-5: Strava-Webhook-Integration

## Status: Planned
**Created:** 2026-03-17
**Last Updated:** 2026-03-22

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
- Was passiert, wenn Strava den Webhook nicht zustellen kann (Timeout)? → Strava wiederholt automatisch. Der Endpunkt ist idempotent — doppelte Events für dieselbe Aktivität werden geloggt, TYPO3 wird erneut aktualisiert (letzter Stand gewinnt)
- Was passiert, wenn der Aktivitätstyp nicht in der erlaubten Liste ist? → Event wird ignoriert (HTTP 200, kein Lauf eingetragen)
- Was passiert, wenn die Strava API die Aktivitätsdetails nicht zurückgibt (Fehler)? → Fehler wird geloggt, TYPO3 bleibt unverändert
- Was passiert, wenn TYPO3 den automatisch eingetragenen Lauf ablehnt? → Fehler wird im TYPO3-Request-Log (PROJ-8) erfasst
- Was passiert, wenn der Läufer Strava trennt? → `access_token` und `refresh_token` werden aus Supabase gelöscht; zukünftige Events für diesen Athlete werden ignoriert
- Was passiert, wenn zwei Nutzer denselben Strava-Account verbinden? → Sollte durch UI verhindert werden (unique constraint auf `athlete_id` in DB)
- Was passiert, wenn `update`- oder `delete`-Events von Strava eingehen? → Werden ignoriert (nur `create`-Events lösen TYPO3-Updates aus)

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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
