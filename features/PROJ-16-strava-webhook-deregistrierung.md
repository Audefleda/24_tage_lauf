# PROJ-16: Strava Webhook De-registrierung (Admin)

## Status: In Progress
**Created:** 2026-03-24

## Dependencies
- Requires: PROJ-5 (Strava-Webhook-Integration) — bestehende Registrierungslogik und `app_settings`-Eintrag

## User Stories
- Als Administrator möchte ich den globalen Strava Webhook deregistrieren können, damit keine neuen Lauf-Events mehr empfangen werden.
- Als Administrator möchte ich vor der Deregistrierung einen Bestätigungsdialog sehen, damit ich keine versehentliche Deregistrierung auslöse.
- Als Administrator möchte ich nach der Deregistrierung sofort den aktualisierten Status ("Nicht registriert") auf der Admin-Seite sehen.
- Als Administrator möchte ich, dass bestehende Strava-Verbindungen der Nutzer*innen erhalten bleiben — nur der globale Empfang neuer Events wird gestoppt.
- Als Administrator möchte ich den Webhook erneut registrieren können, nachdem er deregistriert wurde.

## Acceptance Criteria
- [ ] **AC-1:** Im Strava-Webhook-Bereich der Admin-Maske erscheint ein "Webhook deregistrieren"-Button, solange ein Webhook aktiv registriert ist
- [ ] **AC-2:** Ein Klick auf "Webhook deregistrieren" öffnet einen Bestätigungsdialog mit Warnung ("Neue Strava-Events werden nicht mehr verarbeitet") und den Buttons "Abbrechen" / "Deregistrieren"
- [ ] **AC-3:** Nach Bestätigung ruft `DELETE /api/admin/strava/register-webhook` die Strava API auf (`DELETE https://www.strava.com/api/v3/push_subscriptions/{subscription_id}`) mit `client_id` und `client_secret`
- [ ] **AC-4:** Nach erfolgreicher Strava-API-Antwort wird `strava_subscription_id` aus `app_settings` gelöscht
- [ ] **AC-5:** Gibt die Strava API einen 404 zurück (Subscription bereits auf Strava-Seite gelöscht), wird `app_settings` trotzdem bereinigt und Erfolg gemeldet (idempotent)
- [ ] **AC-6:** Nach Deregistrierung zeigt die Admin-Maske "Nicht registriert" und der Registrierungs-Button wird wieder angezeigt
- [ ] **AC-7:** Bestehende `strava_connections`-Einträge der Nutzer*innen bleiben unberührt
- [ ] **AC-8:** Endpunkt ist Admin-only (Middleware + `requireAdmin()`)

## Edge Cases
- Was passiert, wenn kein Webhook registriert ist und der Endpunkt aufgerufen wird? → HTTP 404 mit Fehlermeldung "Kein Webhook registriert"
- Was passiert, wenn die Strava API nicht erreichbar ist? → HTTP 502, Fehlermeldung in der UI, `app_settings`-Eintrag bleibt erhalten
- Was passiert, wenn die Strava API 404 zurückgibt (Subscription nicht mehr bei Strava vorhanden)? → Als Erfolg werten, `app_settings` trotzdem löschen
- Was passiert, wenn `STRAVA_CLIENT_ID` oder `STRAVA_CLIENT_SECRET` fehlen? → HTTP 500, Fehlermeldung "Strava-Konfiguration unvollständig"
- Was passiert, wenn der Admin unmittelbar nach Deregistrierung erneut registriert? → Normaler Registrierungsablauf, kein Sonderfall

## Technical Requirements
- Neue HTTP-Methode an bestehendem Endpunkt: `DELETE /api/admin/strava/register-webhook`
- Strava API-Call: `DELETE https://www.strava.com/api/v3/push_subscriptions/{id}` mit Form-Body `client_id` + `client_secret`
- Strava gibt bei Erfolg HTTP 204 (No Content) zurück
- Strava gibt bei unbekannter Subscription HTTP 404 zurück → als Erfolg werten
- UI: `StravaWebhookSetup`-Komponente erhält "Deregistrieren"-Button und `AlertDialog` zur Bestätigung
- Kein neues UI-Komponent nötig — Erweiterung der bestehenden `StravaWebhookSetup`-Komponente

---

## Tech Design (Solution Architect)

### Komponenten-Struktur

```
StravaWebhookSetup (strava-webhook-setup.tsx) — ERWEITERT
+-- Status-Anzeige (loading / error / loaded)
|   +-- "Webhook aktiv" Badge (wenn registriert + Strava bestätigt)
|   +-- "Lokal registriert, Strava nicht bestätigt" Badge
|   +-- "Nicht registriert" Badge
+-- "Webhook registrieren" Button     (nur wenn NICHT registriert — unverändert)
+-- "Webhook deregistrieren" Button   (nur wenn registriert — NEU)
    +-- AlertDialog (Bestätigung)     (NEU)
        +-- Titel: "Webhook deregistrieren?"
        +-- Beschreibung: "Neue Strava-Events werden nicht mehr verarbeitet."
        +-- "Abbrechen" Button
        +-- "Deregistrieren" Button → löst DELETE-Call aus
```

Keine neue Datei — `strava-webhook-setup.tsx` wird erweitert.
`AlertDialog` ist bereits installiert (shadcn/ui).

### API-Erweiterung

Bestehende Datei `src/app/api/admin/strava/register-webhook/route.ts` erhält eine neue `DELETE`-Funktion:

```
DELETE /api/admin/strava/register-webhook
  1. Admin-Prüfung (requireAdmin)
  2. subscription_id aus app_settings lesen
     → Nicht vorhanden: HTTP 404 "Kein Webhook registriert"
  3. Strava API: DELETE push_subscriptions/{id} mit client_id + client_secret
     → HTTP 204: Erfolg
     → HTTP 404: Auch Erfolg (Subscription war bereits weg)
     → Netzwerkfehler: HTTP 502, app_settings bleibt erhalten
  4. subscription_id aus app_settings löschen
  5. HTTP 200 OK zurück
```

### Datenfluss

```
Admin klickt "Webhook deregistrieren"
  → AlertDialog öffnet sich
  → Admin klickt "Deregistrieren"
  → Frontend: DELETE /api/admin/strava/register-webhook
  → Backend: Strava API-Call
  → Backend: app_settings bereinigen
  → Frontend: fetchStatus() neu laden
  → Badge wechselt zu "Nicht registriert"
  → Registrieren-Button erscheint wieder
```

### Datenmodell — Änderungen

| Tabelle | Aktion | Wann |
|---|---|---|
| `app_settings` | Zeile mit `key = 'strava_subscription_id'` löschen | Nach erfolgreicher Deregistrierung |
| `strava_connections` | Keine Änderung | Nutzer*innen-OAuth unberührt |

### Neue Pakete

Keine — alles bereits vorhanden.
