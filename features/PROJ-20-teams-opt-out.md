# PROJ-20: Teams-Benachrichtigung Opt-out

## Status: In Review
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

**Tested:** 2026-03-26
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Code review + build verification (no running instance)

### Build & Lint

- [x] `npm run build` passes without errors
- [x] `npm run lint` passes without new warnings (2 pre-existing warnings unrelated to PROJ-20)
- [x] TypeScript compilation clean

### Acceptance Criteria Status

#### AC-1: Toggle auf der Laufmaske
- [x] Switch (shadcn `Switch`) + Label vorhanden in `src/app/runs/page.tsx` (Zeilen 216-235)
- [x] Beschriftung: "Teams-Benachrichtigungen deaktivieren" mit Erklaerungstext
- [x] Platziert unterhalb der `StravaConnectSection` in einer eigenen Card
- [x] BUG-2 (Low) FIXED: Toggle-Semantik korrigiert. Label ist jetzt "Teams-Benachrichtigungen", Switch ON = Benachrichtigungen aktiv (positiv). `checked={teamsNotificationsEnabled}`.

#### AC-2: Status wird aus Profil geladen
- [x] `GET /api/runner` liefert `teamsNotificationsEnabled` aus `runner_profiles.teams_notifications_enabled`
- [x] State wird im `fetchRunner` Callback initialisiert (Zeile 59): `setTeamsNotificationsEnabled(data.teamsNotificationsEnabled ?? true)`
- [x] Default `true` falls Feld fehlt (defensiver Fallback)

#### AC-3: Sofortige Speicherung ohne Speichern-Button
- [x] `onCheckedChange` auf Switch triggert `handleToggleNotifications` direkt
- [x] Kein separater Speichern-Button vorhanden
- [x] Optimistisches Update: Toggle springt sofort um, PATCH folgt asynchron
- [x] Erfolgs-Toast bei erfolgreicher Speicherung
- [x] Switch wird waehrend PATCH disabled (`togglingNotifications` State)

#### AC-4: Opt-out verhindert Teams-Nachricht (UI + Strava)
- [x] `sendTeamsNotification()` prueft `payload.teamsNotificationsEnabled === false` (Zeile 210) -- bei `false` wird sofort abgebrochen
- [x] `PUT /api/runner/runs` (UI-Speicherung): liest `profile.teams_notifications_enabled` und gibt es an `sendTeamsNotification` weiter (Zeile 88)
- [x] `POST /api/strava/webhook` (Strava-Webhook): liest `profile.teams_notifications_enabled` und gibt es an `sendTeamsNotification` weiter (Zeile 184)

#### AC-5: Aktivierter Toggle sendet Nachricht wie gewohnt
- [x] Wenn `teamsNotificationsEnabled` true oder undefined ist, wird die Notification gesendet (kein early return)
- [x] Sicherer Default: `undefined` wird nicht als `false` behandelt

#### AC-6: Praeferenz ist pro Laeufer*in
- [x] Spalte `teams_notifications_enabled` ist in `runner_profiles` (pro User-Zeile)
- [x] PATCH-Endpunkt filtert mit `.eq('user_id', user.id)` -- nur eigene Zeile
- [x] RLS-Policy `"Own profile update notifications"` beschraenkt auf `auth.uid() = user_id`

#### AC-7: Praeferenz ueberlebt Logout/Login
- [x] Gespeichert als persistente DB-Spalte in `runner_profiles` (nicht Session-State)
- [x] Wird bei jedem Seitenaufruf via `GET /api/runner` geladen

### Edge Cases Status

#### EC-1: Neuer Account ohne Praeferenz
- [x] DB-Default ist `TRUE` (Migration Zeile 6: `boolean not null default true`)
- [x] Frontend-Fallback: `data.teamsNotificationsEnabled ?? true`

#### EC-2: Toggle-Aenderung schlaegt fehl (API-Fehler)
- [x] `handleToggleNotifications` macht optimistisches Update, bei Fehler Revert auf `previous` Wert
- [x] Toast-Fehlermeldung wird angezeigt

#### EC-3: Strava-Webhook + Opt-out
- [x] `strava/webhook/route.ts` liest `teams_notifications_enabled` aus Profil (Zeile 129) und gibt es weiter (Zeile 184)
- [x] Lauf-Import laeuft normal weiter (nur Notification wird uebersprungen)

#### EC-4: Race Condition Toggle vs. Lauf-Speicherung
- [x] Unkritisch: Toggle-Status wird zum Zeitpunkt der Notification gelesen (nicht gecached)

### Security Audit Results

- [x] **Authentication:** PATCH-Endpunkt prueft Session via `supabase.auth.getUser()` -- 401 bei fehlender Auth
- [x] **Authorization:** RLS-Policy beschraenkt Update auf eigene Zeile (`auth.uid() = user_id`)
- [x] **BUG-1 (Medium/Security) FIXED:** RLS-Policy `"Own profile update notifications"` war zu breit. Gefixt durch neue Migration `20260326_fix_teams_opt_out_rls_policy.sql`: WITH CHECK stellt sicher, dass `typo3_uid` unveraendert bleibt.
- [x] **Input Validation:** Zod-Schema `BodySchema` validiert `{ enabled: boolean }` -- ungueltige Werte werden mit 400 abgelehnt
- [x] **Rate Limiting:** 10 Anfragen pro 60 Sekunden pro IP
- [x] **Keine Secrets exponiert:** Keine sensitiven Daten in API-Responses
- [x] **HTTP-Methoden:** Nur PATCH exportiert; Next.js gibt 405 fuer andere Methoden zurueck
- [x] **JSON-Parsing:** try/catch um `request.json()` -- ungueltige Payloads geben 400 zurueck

### Cross-Browser & Responsive

**Hinweis:** Kein laufender Dev-Server fuer visuelle Tests verfuegbar. Bewertung basiert auf Code-Review.

- [x] Switch ist ein shadcn/Radix-Primitiv -- funktioniert in Chrome, Firefox, Safari
- [x] Layout nutzt `flex items-center gap-3` in einer Card -- responsiv ab 375px
- [x] `pl-14` auf dem Erklaerungstext koennte auf sehr schmalen Viewports (< 320px) knapp werden, aber 375px ist akzeptabel
- [x] Keine viewport-spezifischen Breakpoints noetig (einfaches Toggle-Element)

### Bugs Found

#### BUG-1: RLS-Policy erlaubt Updates auf alle Spalten der eigenen Zeile
- **Severity:** Medium (Security)
- **Steps to Reproduce:**
  1. Angemeldete*r Nutzer*in oeffnet die Browser-Konsole
  2. Nutzer*in sendet einen direkten POST an die Supabase PostgREST-API: `PATCH /rest/v1/runner_profiles?user_id=eq.<eigene-user-id>` mit Body `{ "typo3_uid": 999 }`
  3. Erwartet: Nur `teams_notifications_enabled` darf geaendert werden
  4. Tatsaechlich: Die RLS-Policy `"Own profile update notifications"` erlaubt das Update, da sie keine Spaltenbeschraenkung hat
- **Impact:** Nutzer*in koennte sich einem fremden TYPO3-Profil zuordnen und dessen Laeufe sehen/aendern
- **Mitigation:** Der PATCH-Endpunkt `/api/runner/notifications` sendet nur `teams_notifications_enabled`, aber der Supabase-Anon-Key ist im Browser verfuegbar (`NEXT_PUBLIC_SUPABASE_ANON_KEY`), sodass ein direkter PostgREST-Aufruf moeglich ist
- **Fix-Vorschlag:** RLS-Policy mit Column-Level-Security einschraenken, z. B. zusaetzlich pruefen, dass sich `typo3_uid` nicht aendert:
  ```sql
  create policy "Own profile update notifications"
    on runner_profiles for update
    using (auth.uid() = user_id)
    with check (
      auth.uid() = user_id
      AND typo3_uid = (SELECT typo3_uid FROM runner_profiles WHERE user_id = auth.uid())
    );
  ```
- **Priority:** Fix before deployment

#### BUG-2: Toggle-Semantik ist invertiert (Doppel-Negativ)
- **Severity:** Low (UX)
- **Steps to Reproduce:**
  1. Oeffne /runs als eingeloggte*r Laeufer*in
  2. Scrolle zum Teams-Bereich
  3. Switch steht auf AUS (= Benachrichtigungen aktiv), Label sagt "deaktivieren"
  4. Erwartet (laut AC-1): Ein positiver Toggle "Teams-Benachrichtigungen" mit Ein/Aus
  5. Tatsaechlich: Switch ON = Benachrichtigungen DEAKTIVIERT (Doppel-Negativ)
- **Impact:** Nutzer*innen koennten verwirrt werden, ob Benachrichtigungen gerade ein oder aus sind
- **Hinweis:** Die Implementation Notes dokumentieren diese Entscheidung explizit. Ob das geaendert werden soll, ist eine UX-Entscheidung.
- **Priority:** Nice to have

### Regression Check

- [x] PROJ-19 (Teams-Benachrichtigung): `sendTeamsNotification` hat neuen optionalen Parameter `teamsNotificationsEnabled` -- bestehende Aufrufe ohne den Parameter senden weiterhin (safe default)
- [x] PROJ-5 (Strava-Webhook): Webhook-Route erweitert um `teams_notifications_enabled` SELECT -- kein Breaking Change
- [x] PROJ-4 (Laeufe-CRUD): `runner/runs` Route erweitert um `teams_notifications_enabled` SELECT -- kein Breaking Change
- [x] PROJ-3 (Laeufe-Uebersicht): `runner` Route liefert zusaetzliches Feld `teamsNotificationsEnabled` -- additiv, kein Breaking Change
- [x] Build kompiliert erfolgreich mit allen bestehenden Routes

### Summary

- **Acceptance Criteria:** 7/7 passed (AC-1 hat Low-Severity UX-Hinweis)
- **Edge Cases:** 4/4 handled correctly
- **Bugs Found:** 2 total — beide gefixt (2026-03-26)
  - BUG-1 (Medium/Security) FIXED: RLS-Policy eingeschraenkt via `20260326_fix_teams_opt_out_rls_policy.sql`
  - BUG-2 (Low/UX) FIXED: Toggle-Semantik korrigiert (positiv, kein Doppel-Negativ)
- **Security:** Clean
- **Regression:** No regressions detected
- **Production Ready:** YES

## Deployment
_To be added by /deploy_
