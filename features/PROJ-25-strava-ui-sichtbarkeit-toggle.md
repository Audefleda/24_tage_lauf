# PROJ-25: Strava UI-Sichtbarkeit Toggle (Admin)

## Status: Planned
**Created:** 2026-04-17
**Last Updated:** 2026-04-17

## Dependencies
- Requires: PROJ-5 (Strava-Webhook-Integration) — der Toggle steuert die Sichtbarkeit der Strava-Komponenten
- Requires: PROJ-6 (Benutzerverwaltung Admin) — Admin-Bereich muss existieren

## User Stories
- Als Administrator möchte ich die Sichtbarkeit des Strava-Bereichs auf der Läufer-Seite global ein- oder ausschalten können, damit ich die UI ausblenden kann, während meine Strava-App noch nicht offiziell freigegeben ist.
- Als Administrator möchte ich, dass meine eigene Strava-Verbindung weiterhin funktioniert, auch wenn die UI für andere Läufer ausgeblendet ist, damit ich die Integration testen kann.
- Als Läufer möchte ich den Strava-Bereich nicht sehen, wenn er deaktiviert ist, damit ich nicht versuche ein Feature zu nutzen, das noch nicht verfügbar ist.

## Acceptance Criteria
- [ ] **AC-1:** Auf der Admin-Seite (`/admin`) gibt es einen neuen Bereich "Strava UI-Sichtbarkeit" mit einem Toggle-Schalter
- [ ] **AC-2:** Der Toggle zeigt den aktuellen Status an: "Strava-Bereich für Läufer sichtbar" (aktiviert) oder "Strava-Bereich für Läufer ausgeblendet" (deaktiviert)
- [ ] **AC-3:** Der Status wird in der `app_settings` Tabelle als `strava_ui_visible` (boolean) gespeichert
- [ ] **AC-4:** Wenn `strava_ui_visible = false`, wird die `StravaConnectSection` Komponente auf der `/runs` Seite nicht gerendert
- [ ] **AC-5:** Wenn `strava_ui_visible = false`, funktionieren die Strava-API-Endpoints (`/api/strava/connect`, `/api/strava/callback`, `/api/strava/status`) weiterhin normal — nur die UI ist ausgeblendet
- [ ] **AC-6:** Der Strava-Webhook (`/api/strava/webhook`) funktioniert unabhängig vom Toggle-Status — bestehende Verbindungen bleiben aktiv und synchronisieren weiter
- [ ] **AC-7:** Der Toggle ist immer sichtbar, unabhängig davon, ob der Webhook bereits registriert wurde oder nicht
- [ ] **AC-8:** Beim Umschalten des Toggles wird der Status sofort in der Datenbank aktualisiert und beim nächsten Laden der `/runs` Seite übernommen (kein Page-Refresh erforderlich für Admin-Seite)
- [ ] **AC-9:** Der Default-Wert ist `strava_ui_visible = true`, wenn der Eintrag in `app_settings` noch nicht existiert

## Edge Cases
- Was passiert, wenn ein Läufer die `/runs` Seite lädt, während der Toggle gerade umgeschaltet wird? → Die Seite zeigt den Status zum Zeitpunkt des Ladens an. Bei erneutem Laden wird der neue Status übernommen.
- Was passiert, wenn `strava_ui_visible` in `app_settings` fehlt? → Default ist `true` (Strava-Bereich sichtbar).
- Was passiert mit bestehenden Strava-Verbindungen, wenn der Toggle auf `false` gesetzt wird? → Sie bleiben in der Datenbank und funktionieren weiter. Der Webhook trägt Läufe weiterhin automatisch ein, nur die UI-Komponente wird ausgeblendet.
- Was passiert, wenn ein Läufer versucht, direkt auf `/api/strava/connect` zuzugreifen, während `strava_ui_visible = false` ist? → Der Endpoint funktioniert normal. Der Toggle steuert nur die UI-Sichtbarkeit, nicht die API-Funktionalität.
- Was passiert, wenn der Admin den Toggle mehrmals schnell hintereinander umschaltet? → Der letzte Zustand wird gespeichert. Race Conditions sind durch Supabase-Transaktionen ausgeschlossen.

## Technical Requirements

### Neue Komponente
- `strava-ui-visibility-toggle.tsx` — Admin-Komponente mit Toggle-Schalter, lädt aktuellen Status via `/api/admin/strava/ui-visibility` und aktualisiert via `PUT /api/admin/strava/ui-visibility`

### Neue API-Routes
- `GET /api/admin/strava/ui-visibility` — Gibt aktuellen Status zurück (`{ visible: boolean }`)
- `PUT /api/admin/strava/ui-visibility` — Aktualisiert Status in `app_settings` (Body: `{ visible: boolean }`)

### Neue `app_settings` Einträge
- `strava_ui_visible` (boolean, default: `true`)

### Anpassungen an bestehenden Komponenten
- `src/app/runs/page.tsx` — Lädt `strava_ui_visible` via neuer API-Route und rendert `StravaConnectSection` nur wenn `visible = true`
- `src/app/admin/page.tsx` — Integriert neue `StravaUiVisibilityToggle` Komponente in den bestehenden Admin-Bereich

### Datenbank-Migration
Keine neue Tabelle erforderlich. Der Eintrag `strava_ui_visible` wird dynamisch in `app_settings` eingefügt, ähnlich wie `webhook_subscription_id`.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
Dieses Feature fügt einen Admin-Toggle hinzu, der steuert, ob der Strava-Bereich auf der Läufer-Seite sichtbar ist. Die Strava-Integration selbst (Webhook, API-Endpoints) bleibt voll funktionsfähig — nur die UI-Komponente wird ein- oder ausgeblendet.

### Komponenten-Struktur

```
Admin-Seite (/admin)
└── Card: "Strava UI-Sichtbarkeit" (NEU)
    ├── Titel: "Strava UI-Sichtbarkeit"
    ├── Beschreibung: Erklärung, dass dies nur die UI steuert, nicht die Webhook-Funktionalität
    └── StravaUiVisibilityToggle (NEU)
        ├── Status-Badge: "Sichtbar" (grün) / "Ausgeblendet" (grau)
        ├── Toggle-Schalter (shadcn/ui Switch)
        └── Bestätigungs-Dialog beim Deaktivieren

Läufer-Seite (/runs)
└── StravaConnectSection (bestehend)
    ├── Wird nur gerendert, wenn strava_ui_visible = true
    └── Keine Änderung an der Komponente selbst
```

### Datenfluss

**Szenario 1: Admin schaltet Strava-UI aus**
1. Admin klickt Toggle auf `/admin` → Status wechselt zu "Ausgeblendet"
2. Bestätigungs-Dialog erscheint: "Bestehende Verbindungen bleiben aktiv"
3. Nach Bestätigung: `PUT /api/admin/strava/ui-visibility` mit `{ visible: false }`
4. Backend speichert in `app_settings`: `strava_ui_visible = 'false'`
5. Läufer laden `/runs` → Backend prüft `strava_ui_visible` → `StravaConnectSection` wird nicht gerendert

**Szenario 2: Läufer lädt /runs-Seite**
1. Seite lädt → Ruft `GET /api/strava/ui-visibility` auf (neuer öffentlicher Endpoint)
2. Backend liest `app_settings.strava_ui_visible` (Default: `true`)
3. Frontend entscheidet: Sichtbar = Komponente rendern, Ausgeblendet = nichts anzeigen
4. Strava-API-Endpoints (`/api/strava/connect`, `/api/strava/status`) funktionieren unabhängig vom Toggle

**Szenario 3: Webhook empfängt Event (egal ob UI sichtbar oder nicht)**
1. Strava sendet `POST /api/strava/webhook`
2. Webhook verarbeitet Event wie gewohnt (keine Prüfung auf `strava_ui_visible`)
3. Lauf wird in TYPO3 eingetragen
4. → Bestehende Verbindungen bleiben funktional, auch wenn UI ausgeblendet ist

### Datenmodell

**Neue `app_settings` Einträge:**
- `strava_ui_visible` (gespeichert als String `'true'` oder `'false'`, Default: `'true'`)
- Gleiche Struktur wie `external_webhook_enabled` aus PROJ-23

**Keine neuen Tabellen erforderlich.**

### API-Routen

**Neue Admin-Endpoints:**
- `GET /api/admin/strava/ui-visibility` — Gibt aktuellen Status zurück: `{ visible: boolean }`
- `PUT /api/admin/strava/ui-visibility` — Aktualisiert Status (Body: `{ visible: boolean }`)

**Neuer öffentlicher Endpoint:**
- `GET /api/strava/ui-visibility` — Öffentlich, keine Authentifizierung. Läufer-Seite fragt diesen ab, um zu entscheiden, ob `StravaConnectSection` gerendert wird.

### UI-Komponenten

**Neu zu erstellen:**
- `strava-ui-visibility-toggle.tsx` — Client-Komponente für Admin-Seite
  - Ähnlich wie `external-webhook-control.tsx` (PROJ-23)
  - Verwendet shadcn/ui: Switch, Badge, Alert, AlertDialog, Skeleton
  - Lädt Status via `GET /api/admin/strava/ui-visibility`
  - Speichert via `PUT /api/admin/strava/ui-visibility`
  - Bestätigungs-Dialog beim Deaktivieren: "Bestehende Strava-Verbindungen bleiben aktiv. Nur die UI wird ausgeblendet."

**Anzupassen:**
- `src/app/admin/page.tsx` — Neue Card mit `StravaUiVisibilityToggle` hinzufügen (zwischen Strava-Webhook und Externem Webhook)
- `src/app/runs/page.tsx` — `strava_ui_visible` via `GET /api/strava/ui-visibility` laden, `StravaConnectSection` nur rendern wenn `visible = true`

### Technische Entscheidungen

| Entscheidung | Grund |
|---|---|
| Toggle steuert NUR die UI, nicht die API-Funktionalität | Der Admin möchte seine eigene Strava-Verbindung testen können, während andere Läufer die UI nicht sehen. API-Endpoints bleiben zugänglich. |
| Neuer öffentlicher Endpoint `/api/strava/ui-visibility` | Die `/runs`-Seite muss den Status ohne Admin-Authentifizierung abrufen können. Der Wert ist nicht sensitiv (nur ein Boolean für UI-Sichtbarkeit). |
| Default-Wert: `true` (sichtbar) | Abwärtskompatibilität: Wenn der Toggle noch nie gesetzt wurde, soll Strava standardmäßig sichtbar sein. |
| Bestätigungs-Dialog beim Deaktivieren | Verhindert versehentliches Ausblenden. Macht klar, dass bestehende Verbindungen aktiv bleiben. |
| Speicherung in `app_settings` (nicht Env-Variable) | Ermöglicht Umschalten ohne Deployment. Admin kann reagieren, wenn Strava-App freigegeben wird. |

### Abhängigkeiten (Pakete)

Keine neuen Pakete erforderlich. Alle shadcn/ui-Komponenten sind bereits installiert:
- `@/components/ui/switch` (Toggle-Schalter)
- `@/components/ui/badge` (Status-Anzeige)
- `@/components/ui/alert` (Hinweise)
- `@/components/ui/alert-dialog` (Bestätigungs-Dialog)
- `@/components/ui/skeleton` (Ladezustand)

### Sicherheit & Validierung

- Admin-Endpoints (`/api/admin/strava/ui-visibility`) geschützt via `requireAdmin()` (PROJ-6)
- Öffentlicher Endpoint (`/api/strava/ui-visibility`) gibt nur einen Boolean zurück — keine sensitiven Daten
- Input-Validierung: `visible` muss boolean sein, sonst HTTP 422
- Kein CSRF-Schutz erforderlich (Admin-Bereich ist bereits authentifiziert)

### Rollback-Plan

Falls das Feature Probleme verursacht:
1. Admin setzt Toggle auf "Sichtbar" → Strava-Bereich wird wieder angezeigt
2. Kein Datenverlust: Alle Strava-Verbindungen bleiben in der Datenbank
3. Deployment-Rollback möglich ohne Datenmigration (nur `app_settings`-Eintrag wird gelöscht)

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
