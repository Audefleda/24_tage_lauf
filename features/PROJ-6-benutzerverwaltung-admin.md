# PROJ-6: Benutzerverwaltung (Admin)

## Status: In Progress
**Created:** 2026-03-17
**Last Updated:** 2026-03-17

## Änderungshinweis
> Vereinfacht: Nutzer werden ausschließlich über das Supabase Dashboard angelegt.
> Die App zeigt nur eine Liste bestehender Nutzer und erlaubt die Zuordnung zu TYPO3-Läufern.

## Implementation Notes (Backend)

**Erstellte Dateien (bleiben erhalten):**
- `supabase/migrations/20260317_create_runner_profiles.sql` — Tabelle mit RLS, unique constraints
- `src/lib/admin-auth.ts` — Admin-Check Helper
- `src/middleware.ts` — Route Protection
- `src/app/api/admin/runners/route.ts` — GET: TYPO3 Läuferliste
- `src/app/api/admin/users/[id]/route.ts` — PATCH: Läufer-Zuordnung aktualisieren

**Nicht mehr benötigt (kann entfernt werden):**
- `src/app/api/admin/users/route.ts` → POST-Handler (User anlegen) entfernen, nur GET behalten
- `src/app/api/admin/users/[id]/deactivate/route.ts` — nicht mehr benötigt

**Design-Entscheidungen:**
- Doppel-Zuordnung TYPO3-UID wird blockiert (unique constraint)
- Admin-Operationen laufen über Service Role Key (umgeht RLS)
- Nutzer werden im Supabase Dashboard angelegt, nicht in der App

**Frontend (erledigt):**
- `src/app/admin/page.tsx` — Admin-Seite mit Card-Layout
- `src/components/runner-assignment-table.tsx` — Client Component: Tabelle aller Nutzer mit Inline-Select-Dropdown zur Laeufer-Zuordnung
- `src/components/app-header.tsx` — Admin-Link im Header fuer Admin-User ergaenzt
- `src/app/api/admin/runners/route.ts` — Fix: `nr`-Feld wird jetzt im Response mitgeliefert
- Loading/Error/Empty States implementiert
- Bereits vergebene Laeufer im Dropdown als "(vergeben)" markiert und disabled
- Nutzer ohne Zuordnung zeigen Badge "Nicht zugeordnet"
- Sofortige Speicherung bei Auswahl mit visueller Rueckmeldung (Spinner, Haekchen, Fehler-Icon)

## Dependencies
- Requires: PROJ-1 (API-Konfiguration & Superuser-Authentifizierung)
- Requires: PROJ-2 (Anmeldung — Supabase Auth muss eingerichtet sein)

## User Stories
- Als Admin möchte ich eine Liste aller bestehenden Supabase-Nutzer sehen, um den Überblick zu behalten.
- Als Admin möchte ich für jeden Nutzer einen TYPO3-Läufer zuordnen, damit der Nutzer seine eigenen Läufe sieht.
- Als Admin möchte ich die Läuferliste mit Name und Startnummer (Nr) sehen, damit ich den richtigen Läufer identifizieren kann.
- Als Admin möchte ich eine bestehende Zuordnung ändern können, falls sie falsch gesetzt wurde.
- Als Admin möchte ich sehen welche Läufer noch keinem Nutzer zugeordnet sind.

## Acceptance Criteria
- [ ] Admin-Bereich `/admin` ist nur für Admin-Nutzer zugänglich
- [ ] Liste aller Supabase-Nutzer wird angezeigt: E-Mail, aktuell zugeordneter Läufer (Name + Nr), Datum erstellt
- [ ] Pro Nutzer: Dropdown zur Auswahl eines TYPO3-Läufers (zeigt Name + Nr, speichert UID)
- [ ] TYPO3-Läuferliste wird live von der API geladen
- [ ] Zuordnung wird beim Ändern sofort gespeichert (kein separater Speichern-Button nötig)
- [ ] Bereits zugeordnete Läufer sind im Dropdown als "vergeben" markiert
- [ ] Nutzer ohne Zuordnung sind deutlich erkennbar (z.B. Badge "Nicht zugeordnet")

## Edge Cases
- Was passiert wenn die TYPO3-UID bereits einem anderen Nutzer zugeordnet ist? → Fehlermeldung, Blockiert
- Was passiert wenn die TYPO3-Läuferliste nicht geladen werden kann? → Fehlermeldung mit Retry, manuelle UID-Eingabe als Fallback
- Was passiert wenn ein Nutzer noch keine Zuordnung hat und sich einloggt? → PROJ-2 zeigt Fehlermeldung "Noch nicht konfiguriert"

## Technical Requirements
- Kein User-Anlegen in der App (nur im Supabase Dashboard)
- Service Role Key nur server-seitig
- Läufer-Dropdown: zeigt `name` + `nr`, speichert `uid`
- Zuordnung via PATCH `/api/admin/users/[id]`

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

**Einzige Seite:** `/admin` — Nutzerliste mit inline Läufer-Zuordnung

**Datenfluss:**
1. Page lädt via Server Action alle Supabase-Nutzer (Admin API) + deren `runner_profiles`
2. Gleichzeitig: TYPO3-Läuferliste laden (für Dropdown)
3. Pro Nutzer: Select-Dropdown mit allen Läufern (Name + Nr angezeigt, UID gespeichert)
4. onChange → PATCH `/api/admin/users/[id]` → sofortiges Speichern

**API-Endpoints (vereinfacht):**
- `GET /api/admin/users` — Alle Supabase-User + verknüpfte `runner_profiles`
- `GET /api/admin/runners` — TYPO3-Läuferliste `{ uid, nr, name }[]`
- `PATCH /api/admin/users/[id]` — Läufer-Zuordnung setzen/ändern

**Komponenten:**
- `src/app/admin/page.tsx` — Server Component, lädt User + Läuferliste
- `src/components/runner-assignment-table.tsx` — Client Component, Tabelle mit Inline-Dropdowns

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
