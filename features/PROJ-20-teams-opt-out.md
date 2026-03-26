# PROJ-20: Teams-Benachrichtigung Opt-out

## Status: Deployed
**Frontend completed:** 2026-03-26
**Created:** 2026-03-26

## Dependencies
- Requires: PROJ-19 (Teams-Benachrichtigung nach Lauf-Eintrag) — erweitert die Notification-Logik um eine Nutzer*innen-Präferenz

---

## User Stories
- Als Läufer*in möchte ich auf der Laufmaske einstellen können, dass für meine Läufe keine Teams-Benachrichtigungen gesendet werden, damit ich das Team nicht mit meinen Läufen behellige.
- Als Läufer*in möchte ich meinen Opt-out-Status jederzeit wieder rückgängig machen können, damit ich Benachrichtigungen bei Bedarf wieder aktivieren kann.
- Als Läufer*in möchte ich, dass mein Opt-out-Status dauerhaft gespeichert wird und nach einem erneuten Login noch aktiv ist.
- Als Teammitglied möchte ich, dass der Opt-out einer Läufer*in keinen Einfluss auf die Benachrichtigungen der anderen hat.
- Als Läufer*in möchte ich klar sehen, ob Benachrichtigungen für mich gerade aktiv oder deaktiviert sind.

## Acceptance Criteria
- [ ] **AC-1:** Auf der Laufmaske gibt es einen Toggle (Ein/Aus) mit der Beschriftung „Teams-Benachrichtigungen" (oder ähnlich)
- [ ] **AC-2:** Der aktuelle Status des Toggles wird aus dem Läufer*innen-Profil geladen und beim Seitenaufruf korrekt angezeigt (Standard: Opt-out deaktiviert = Benachrichtigungen werden gesendet)
- [ ] **AC-3:** Eine Änderung des Toggles wird sofort und dauerhaft gespeichert — ohne separaten Speichern-Button
- [ ] **AC-4:** Ist der Toggle deaktiviert (Opt-out), wird beim Speichern eines Laufs **keine** Teams-Nachricht gesendet — weder über die UI noch über den Strava-Webhook
- [ ] **AC-5:** Ist der Toggle aktiviert, wird wie gewohnt eine Teams-Nachricht gesendet
- [ ] **AC-6:** Die Präferenz ist pro Läufer*in gespeichert — die Einstellung einer Person hat keinen Einfluss auf andere
- [ ] **AC-7:** Die Präferenz überlebt einen Logout und erneuten Login (persistente Speicherung, nicht nur Session-State)

## Edge Cases
- Neuer Account ohne gespeicherter Präferenz → Opt-out ist deaktiviert, d. h. Benachrichtigungen werden gesendet (`teams_notifications_enabled = true` als DB-Default)
- Toggle-Änderung schlägt fehl (API-Fehler) → Toast-Fehlermeldung, Toggle springt auf alten Wert zurück
- Strava-Webhook kommt für eine Läufer*in mit Opt-out → keine Benachrichtigung; Lauf-Import selbst läuft normal weiter
- Läufer*in ändert Toggle während ein Lauf gerade gespeichert wird → Race condition unkritisch, da Toggle-Status beim Auslösen der Notification gelesen wird

## Technical Requirements
- Neue Spalte `teams_notifications_enabled` (boolean, `DEFAULT TRUE NOT NULL`) in der `runner_profiles`-Tabelle (Migration) — bestehende Accounts erhalten automatisch `true`
- Neuer API-Endpunkt `PATCH /api/runner/notifications` — speichert die Präferenz für die eingeloggte Nutzer*in
- Erweiterung von `GET /api/runner` — gibt `teamsNotificationsEnabled` zurück
- `sendTeamsNotification()` in `src/lib/teams-notification.ts` prüft vor dem Senden die Präferenz der Läufer*in
- UI-Komponente: shadcn `Switch` + `Label` auf der Laufmaske (`src/app/runs/page.tsx` oder `src/components/page-header.tsx`)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick

Kleines Full-Stack-Feature: eine neue Spalte in der Datenbank, ein neuer API-Endpunkt, eine Erweiterung des bestehenden Runner-Endpunkts, eine Anpassung der Notification-Logik und ein Toggle in der bestehenden Laufmaske.

### Datenmodell

**Erweiterung der bestehenden Tabelle `runner_profiles`:**

| Neue Spalte | Typ | Default | Beschreibung |
|-------------|-----|---------|--------------|
| `teams_notifications_enabled` | Boolean | `TRUE` | `true` = Benachrichtigungen aktiv, `false` = Opt-out |

Bestehende Zeilen erhalten automatisch `true` durch den DB-Default — keine manuelle Datenmigration nötig.

### Komponenten-Struktur

```
Laufmaske (/runs)
+-- PageHeader (bereits vorhanden)
+-- RunsTable (bereits vorhanden)
+-- Teams-Opt-out-Bereich (neu, unterhalb der Lauftabelle)
    +-- Switch (shadcn — bereits installiert)
    +-- Label "Teams-Benachrichtigungen deaktivieren"
    +-- Kurzer Erklärungstext (z. B. "Wenn aktiv, werden für deine Läufe keine Nachrichten an Teams gesendet.")
```

### Datenfluss

```
Seitenaufruf /runs
      ↓
GET /api/runner  →  liefert jetzt auch teamsNotificationsEnabled
      ↓
Toggle zeigt aktuellen Status

Nutzer*in ändert Toggle
      ↓
PATCH /api/runner/notifications  →  speichert neue Präferenz in runner_profiles
      ↓
Sofortiges Feedback (Toast)  ←  Erfolg / Fehler
      ↓ (bei Fehler)
Toggle springt auf alten Wert zurück

Lauf wird gespeichert
      ↓
sendTeamsNotification() prüft teams_notifications_enabled
      ↓
Opt-out aktiv → stiller Abbruch
Opt-out inaktiv → Nachricht wird gesendet
```

### Neue / geänderte Dateien

| Was | Datei | Art |
|-----|-------|-----|
| DB-Spalte hinzufügen | `supabase/migrations/XXXX_add_teams_opt_out.sql` | Neu |
| Opt-out speichern | `src/app/api/runner/notifications/route.ts` | Neu |
| Präferenz mitliefern | `src/app/api/runner/route.ts` | Änderung (1 Zeile) |
| Opt-out prüfen vor Senden | `src/lib/teams-notification.ts` | Änderung |
| Toggle-UI | `src/app/runs/page.tsx` | Änderung |

### Neue Umgebungsvariablen

Keine — das Feature nutzt ausschließlich die bestehende Supabase-Verbindung.

### Keine neuen Pakete

`Switch` aus shadcn/ui ist bereits installiert (`src/components/ui/switch.tsx`).

## Implementation Notes

### Backend (2026-03-26)

**Migration** (`supabase/migrations/20260326_add_teams_opt_out.sql`):
- Added `teams_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE` to `runner_profiles`
- Added RLS UPDATE policy `"Own profile update notifications"` so authenticated users can update their own row (uses `auth.uid() = user_id` in both USING and WITH CHECK)

**New endpoint** (`src/app/api/runner/notifications/route.ts`):
- `PATCH /api/runner/notifications` — accepts `{ enabled: boolean }`, validates with Zod
- Uses `createClient()` (user-scoped, RLS-aware) — NOT `createAdminClient()`
- Rate limited: 10 requests per 60 seconds per IP
- Returns 401/400/429/500 as appropriate

**Modified files:**
- `src/app/api/runner/route.ts` — extended SELECT to include `teams_notifications_enabled`, returned as `teamsNotificationsEnabled` in response
- `src/lib/teams-notification.ts` — added `teamsNotificationsEnabled?: boolean` to `TeamsNotificationPayload`; early return when `false`
- `src/app/api/runner/runs/route.ts` — extended profile SELECT; passes `teamsNotificationsEnabled` to `sendTeamsNotification()`
- `src/app/api/strava/webhook/route.ts` — extended profile SELECT; passes `teamsNotificationsEnabled` to `sendTeamsNotification()`

**Note:** Migration file is created but must be applied to the Supabase project manually (Supabase CLI not available in this environment).

### Frontend (2026-03-26)

**Modified file:** `src/app/runs/page.tsx`
- Added `teamsNotificationsEnabled` to `RunnerData` interface
- Added `teamsNotificationsEnabled` and `togglingNotifications` state variables
- State initialized from `GET /api/runner` response (default: `true` if field missing)
- Added `handleToggleNotifications` callback: optimistic update, PATCH to `/api/runner/notifications`, success/error toast, revert on failure
- Added opt-out toggle UI below `StravaConnectSection`: shadcn `Switch` + `Label` in a bordered card
- Switch is `checked` when opt-out is active (`!teamsNotificationsEnabled`), matching the "deaktivieren" label semantics
- Switch is disabled during the PATCH request to prevent double-toggling
- Uses `sonner` toast (matching existing codebase pattern, not shadcn useToast)
- No new dependencies added

## QA Test Results

**Tested:** 2026-03-26 (Re-test after fixes)
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Code review + build verification

### Build & Lint

- [x] `npm run build` passes without errors
- [x] `npm run lint` passes without new warnings (2 pre-existing warnings unrelated to PROJ-20)
- [x] TypeScript compilation clean

### Acceptance Criteria Status

#### AC-1: Toggle auf der Laufmaske
- [x] Switch (shadcn `Switch`) + Label vorhanden in `src/app/runs/page.tsx` (Zeilen 216-235)
- [x] Label: "Teams-Benachrichtigungen" (positiv formuliert, kein Doppel-Negativ)
- [x] Erklaerungstext: "Wenn aktiv, werden fuer deine Laeufe Nachrichten an Teams gesendet."
- [x] Platziert unterhalb der `StravaConnectSection` in einer eigenen Card
- [x] `checked={teamsNotificationsEnabled}` -- Switch ON = Benachrichtigungen aktiv
- **PASS**

#### AC-2: Status wird aus Profil geladen
- [x] `GET /api/runner` liefert `teamsNotificationsEnabled` aus `runner_profiles.teams_notifications_enabled` (route.ts Zeile 101)
- [x] State wird im `fetchRunner` Callback initialisiert (Zeile 59): `setTeamsNotificationsEnabled(data.teamsNotificationsEnabled ?? true)`
- [x] Default `true` falls Feld fehlt (defensiver Fallback)
- [x] Auch in `refreshRunner` (Zeile 78) wird der State aktualisiert
- **PASS**

#### AC-3: Sofortige Speicherung ohne Speichern-Button
- [x] `onCheckedChange` auf Switch triggert `handleToggleNotifications` direkt
- [x] Kein separater Speichern-Button vorhanden
- [x] Optimistisches Update: Toggle springt sofort um, PATCH folgt asynchron
- [x] Erfolgs-Toast bei erfolgreicher Speicherung
- [x] Switch wird waehrend PATCH disabled (`togglingNotifications` State)
- **PASS**

#### AC-4: Opt-out verhindert Teams-Nachricht (UI + Strava)
- [x] `sendTeamsNotification()` prueft `payload.teamsNotificationsEnabled === false` (Zeile 209) -- bei `false` wird sofort abgebrochen
- [x] `PUT /api/runner/runs` (UI-Speicherung): liest `profile.teams_notifications_enabled` und gibt es an `sendTeamsNotification` weiter (Zeile 88)
- [x] `POST /api/strava/webhook` (Strava-Webhook): liest `profile.teams_notifications_enabled` und gibt es an `sendTeamsNotification` weiter (Zeile 184)
- **PASS**

#### AC-5: Aktivierter Toggle sendet Nachricht wie gewohnt
- [x] Wenn `teamsNotificationsEnabled` true oder undefined ist, wird die Notification gesendet (kein early return)
- [x] Sicherer Default: `undefined` wird nicht als `false` behandelt (strict `=== false` check)
- **PASS**

#### AC-6: Praeferenz ist pro Laeufer*in
- [x] Spalte `teams_notifications_enabled` ist in `runner_profiles` (pro User-Zeile)
- [x] PATCH-Endpunkt filtert mit `.eq('user_id', user.id)` -- nur eigene Zeile
- [x] RLS-Policy `"Own profile update notifications"` beschraenkt auf `auth.uid() = user_id` + `typo3_uid` immutable check
- **PASS**

#### AC-7: Praeferenz ueberlebt Logout/Login
- [x] Gespeichert als persistente DB-Spalte in `runner_profiles` (nicht Session-State)
- [x] Wird bei jedem Seitenaufruf via `GET /api/runner` geladen
- **PASS**

### Edge Cases Status

#### EC-1: Neuer Account ohne Praeferenz
- [x] DB-Default ist `TRUE` (Migration: `boolean not null default true`)
- [x] Frontend-Fallback: `data.teamsNotificationsEnabled ?? true`
- **PASS**

#### EC-2: Toggle-Aenderung schlaegt fehl (API-Fehler)
- [x] `handleToggleNotifications` macht optimistisches Update, bei Fehler Revert auf `previous` Wert
- [x] Toast-Fehlermeldung wird angezeigt
- **PASS**

#### EC-3: Strava-Webhook + Opt-out
- [x] `strava/webhook/route.ts` liest `teams_notifications_enabled` aus Profil (Zeile 128) und gibt es weiter (Zeile 184)
- [x] Lauf-Import laeuft normal weiter (nur Notification wird uebersprungen)
- **PASS**

#### EC-4: Race Condition Toggle vs. Lauf-Speicherung
- [x] Unkritisch: Toggle-Status wird zum Zeitpunkt der Notification gelesen (nicht gecached)
- **PASS**

### Security Audit Results

- [x] **Authentication:** PATCH-Endpunkt prueft Session via `supabase.auth.getUser()` -- 401 bei fehlender Auth
- [x] **Authorization:** RLS-Policy beschraenkt Update auf eigene Zeile (`auth.uid() = user_id`) UND verhindert `typo3_uid`-Aenderung (WITH CHECK Subquery)
- [x] **BUG-1 (Medium/Security) FIXED:** RLS-Policy via `20260326_fix_teams_opt_out_rls_policy.sql` eingeschraenkt -- bestaetigt bei Re-Test
- [x] **Input Validation:** Zod-Schema `BodySchema` validiert `{ enabled: boolean }` -- ungueltige Werte werden mit 400 abgelehnt
- [x] **Rate Limiting:** 10 Anfragen pro 60 Sekunden pro IP
- [x] **Keine Secrets exponiert:** Keine sensitiven Daten in API-Responses
- [x] **HTTP-Methoden:** Nur PATCH exportiert; Next.js gibt 405 fuer andere Methoden zurueck
- [x] **JSON-Parsing:** try/catch um `request.json()` -- ungueltige Payloads geben 400 zurueck
- [x] **BUG-3 (Low/Security) FIXED:** RLS-Policy sperrt jetzt auch `created_at` via WITH CHECK. Beide unveraenderlichen Spalten (`typo3_uid`, `created_at`) sind immutable. Migration: `20260326_fix_teams_opt_out_rls_lock_created_at.sql`.

### Cross-Browser & Responsive

**Hinweis:** Bewertung basiert auf Code-Review (kein visueller Test moeglich).

- [x] Switch ist ein shadcn/Radix-Primitiv -- funktioniert in Chrome, Firefox, Safari
- [x] Layout nutzt `flex items-center gap-3` in einer Card -- responsiv ab 375px
- [x] `pl-14` auf dem Erklaerungstext koennte auf sehr schmalen Viewports (< 320px) knapp werden, aber 375px ist akzeptabel
- [x] Keine viewport-spezifischen Breakpoints noetig (einfaches Toggle-Element)

### Previously Reported Bugs -- Status Update

- **BUG-1 (Medium/Security) -- RLS-Policy zu breit:** FIXED via Migration `20260326_fix_teams_opt_out_rls_policy.sql`. Re-Test bestaetigt: WITH CHECK prueft `typo3_uid` Immutabilitaet.
- **BUG-2 (Low/UX) -- Toggle-Semantik invertiert:** FIXED. Label ist jetzt "Teams-Benachrichtigungen", Switch ON = aktiv (positiv). `checked={teamsNotificationsEnabled}` korrekt.

### New Bugs (Re-Test)

#### BUG-3: RLS-Policy koennte theoretisch andere Spalten aendern lassen
- **Severity:** Low (Security)
- **Steps to Reproduce:**
  1. Direkter Supabase PostgREST-Aufruf: `PATCH /rest/v1/runner_profiles?user_id=eq.<eigene-id>` mit Body `{ "teams_notifications_enabled": true, "created_at": "2020-01-01" }`
  2. Die WITH CHECK Policy prueft nur `auth.uid()` und `typo3_uid` -- andere Spalten wie `created_at` koennten theoretisch geaendert werden
- **Impact:** Minimal. `runner_profiles` hat nur `user_id`, `typo3_uid`, `teams_notifications_enabled`, `created_at`. `user_id` ist durch USING eingeschraenkt, `typo3_uid` durch WITH CHECK. `created_at` hat keinen sicherheitsrelevanten Impact.
- **Priority:** Nice to have

### Regression Check

- [x] PROJ-19 (Teams-Benachrichtigung): `sendTeamsNotification` hat optionalen Parameter `teamsNotificationsEnabled` -- safe default (`undefined` wird nicht als `false` behandelt)
- [x] PROJ-5 (Strava-Webhook): Webhook-Route erweitert um `teams_notifications_enabled` SELECT -- kein Breaking Change
- [x] PROJ-4 (Laeufe-CRUD): `runner/runs` Route erweitert um `teams_notifications_enabled` SELECT -- kein Breaking Change
- [x] PROJ-3 (Laeufe-Uebersicht): `runner` Route liefert zusaetzliches Feld `teamsNotificationsEnabled` -- additiv, kein Breaking Change
- [x] Build kompiliert erfolgreich mit allen bestehenden Routes

### Summary

- **Acceptance Criteria:** 7/7 passed
- **Edge Cases:** 4/4 handled correctly
- **Previously Reported Bugs:** 2/2 FIXED (BUG-1 RLS, BUG-2 Toggle-Semantik)
- **New Bugs:** 1 (BUG-3, Low/Security, nice to have)
- **Security:** Clean (no critical or high issues)
- **Regression:** No regressions detected
- **Production Ready:** YES

## Deployment
_To be added by /deploy_
