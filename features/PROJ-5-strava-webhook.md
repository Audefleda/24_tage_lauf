# PROJ-5: Strava-Webhook-Integration

## Status: Planned
**Created:** 2026-03-17
**Last Updated:** 2026-03-17

## Dependencies
- Requires: PROJ-1 (API-Konfiguration & Superuser-Authentifizierung)
- Requires: PROJ-2 (Anmeldung — Supabase Auth, User-ID für Token-Speicherung)
- Requires: PROJ-4 (Läufe-Verwaltung CRUD)
- Requires: PROJ-6 (Benutzerverwaltung — Supabase-Schema muss vorhanden sein)

## User Stories
- Als Läufer möchte ich meinen Strava-Account mit der App verbinden, damit meine Läufe automatisch übertragen werden.
- Als Läufer möchte ich den Strava-Webhook deaktivieren können, wenn ich ihn nicht mehr brauche.
- Als Läufer möchte ich sehen, ob mein Strava-Webhook aktiv ist oder nicht.
- Als Admin möchte ich Strava-API-Credentials zentral konfigurieren, damit kein Nutzer eigene API-Keys benötigt.

## Acceptance Criteria
- [ ] Strava OAuth-Flow: Läufer kann Strava-Account autorisieren
- [ ] Nach erfolgreicher OAuth-Verbindung wird ein Webhook für den Läufer bei Strava registriert
- [ ] Neuer Lauf in Strava → Webhook wird ausgelöst → Lauf wird automatisch in die Ziel-Website eingetragen
- [ ] Webhook-Status (aktiv/inaktiv) wird pro Läufer in Supabase gespeichert
- [ ] Läufer kann Strava-Verbindung trennen (Webhook deregistrieren)
- [ ] Strava API-Credentials (`STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`) sind als Env-Variablen konfigurierbar
- [ ] Webhook-Endpunkt (`/api/strava/webhook`) ist öffentlich erreichbar (für Strava-Callbacks)

## Edge Cases
- Was passiert, wenn Strava den Webhook nicht zustellen kann? → Retry durch Strava, Fehlerlog
- Was passiert, wenn der Lauf-Typ nicht "Run" ist (z.B. Radfahren)? → Nur Läufe werden übertragen, Rest ignoriert
- Was passiert, wenn die Ziel-Website den automatisch eingetragenen Lauf ablehnt? → Fehler wird geloggt
- Was passiert, wenn der Strava-Token abläuft? → Token-Refresh über Supabase gespeichertes Refresh-Token

## Technical Requirements
- Supabase wird für diese Funktion eingeführt: Tabelle `strava_connections` (läufer_id, access_token, refresh_token, webhook_id, aktiv)
- Strava OAuth 2.0 Callback-Route: `/api/strava/callback`
- Webhook-Empfangs-Route: `/api/strava/webhook` (GET für Verification, POST für Events)
- Strava-Aktivitäten werden in das Datenformat der Ziel-Website transformiert

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
