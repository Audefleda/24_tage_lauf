# PROJ-3: Läufe-Übersicht

## Status: In Review
**Created:** 2026-03-17
**Last Updated:** 2026-03-17

## Frontend Implementation Notes (Redesign 2026-03-17)
- **Redesign:** Switched from showing only logged runs to showing ALL 25 event days (20.04.2026--14.05.2026) as a calendar list
- `src/lib/event-config.ts` -- Shared event constants (EVENT_START, EVENT_END, 25 days) and helper functions (buildEventDays, date formatting, index<->date mapping)
- `src/app/runs/page.tsx` -- Client page with loading/error/success states; builds 25-day event calendar from TYPO3 runs array using buildEventDays()
- `src/components/page-header.tsx` -- Runner name display only (removed "Neuen Lauf eintragen" button)
- `src/components/stats-card.tsx` -- Two cards: total distance + Lauftage (days with distance > 0)
- `src/components/runs-table.tsx` -- shadcn/ui Table showing all 25 event days; days without runs are visually dimmed (text-muted-foreground); each row has Edit button linking to /runs/[index]/edit
- `src/components/delete-run-dialog.tsx` -- REMOVED (no longer needed; 0 km = delete)
- `src/app/api/runner/route.ts` -- GET endpoint unchanged
- `src/app/api/runner/runs/route.ts` -- PUT endpoint unchanged
- No "empty state" card needed -- all 25 days always visible even with 0 runs

## Dependencies
- Requires: PROJ-1 (API-Konfiguration & Superuser-Authentifizierung)
- Requires: PROJ-2 (Anmeldung — Supabase Auth, liefert TYPO3-UID des eingeloggten Läufers)

## User Stories
- Als Läufer möchte ich alle Tage des Events (20.04.2026–14.05.2026) als Liste sehen, damit ich auf einen Blick erkenne, an welchen Tagen ich gelaufen bin.
- Als Läufer möchte ich bei jedem Tag den Wochentag sehen, damit ich die Liste leichter lesen kann.
- Als Läufer möchte ich bei jedem Tag die eingetragene Distanz sehen (oder eine leere Zelle wenn kein Lauf eingetragen wurde).
- Als Läufer möchte ich eine Gesamtstatistik sehen (Gesamtdistanz, Anzahl Lauftage), damit ich meinen Fortschritt erkenne.
- Als Läufer möchte ich direkt aus der Übersicht heraus jeden Tag bearbeiten können.

## Acceptance Criteria
- [ ] Die Übersicht zeigt **alle 25 Tage** des Events (20.04.2026–14.05.2026) als Liste, aufsteigend nach Datum
- [ ] Jede Zeile zeigt: Wochentag (z.B. "Mo"), Datum (z.B. "20.04.2026"), Distanz (z.B. "5,50 km") — oder leer wenn kein Lauf eingetragen
- [ ] Zeilen ohne Laufeintrag (0 km oder nicht vorhanden) werden visuell unterschieden (z.B. gedimmt)
- [ ] Eine Gesamtstatistik wird angezeigt: Summe der Distanzen, Anzahl Lauftage (Tage mit Distanz > 0)
- [ ] Jede Zeile hat einen Edit-Button (führt zu PROJ-4 Bearbeitungsformular)
- [ ] Kein "Neuen Lauf hinzufügen"-Button — alle Tage sind immer sichtbar und bearbeitbar
- [ ] Ladezustand wird während des API-Calls angezeigt
- [ ] Fehlerfall (API nicht erreichbar) zeigt Fehlermeldung mit Retry-Button
- [ ] Der Name des eingeloggten Läufers ist sichtbar

## Edge Cases
- Was passiert wenn der Läufer noch keine Läufe eingetragen hat? → Alle 25 Tage werden trotzdem gezeigt, Distanzspalte leer
- Was passiert wenn die API-Abfrage fehlschlägt? → Fehlermeldung mit Retry-Button
- Was passiert mit Läufen außerhalb des Event-Zeitraums (z.B. aus früheren Events)? → Werden nicht angezeigt, aber auch nicht gelöscht

## Technical Requirements
- Daten werden frisch von der API geladen (kein persistentes Caching)
- Nach CRUD-Operationen (PROJ-4) wird die Liste automatisch aktualisiert
- shadcn/ui Table oder Card-Liste für die Darstellung

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

**Seite:** `/runs` — geschützt: Redirect zu `/select` wenn kein Läufer im Context

**Woher kommen die Läufe:**
Die Läufe sind bereits im `runs`-Array des Runner-Objekts enthalten, das beim Laden der Läuferliste (`runnerget.json`) mitgeliefert wird. Kein separater API-Aufruf nötig — die Daten kommen aus dem React Context.

**Lauf-Datenstruktur (von der API):**
```
runDate      — Datum + Uhrzeit als String: "2026-03-17 06:00:00"
runDistance  — Distanz als String: "5.5"  (in km)
```
*Hinweis: Keine individuelle Lauf-ID — Läufe werden per Array-Index identifiziert.*

**Datenfluss:**
1. Page liest Läufer + Runs aus dem React Context (bereits beim Login geladen)
2. Zeigt Tabelle + Stats — kein API-Call nötig für die reine Anzeige
3. Nach CRUD-Operationen (PROJ-4): Context wird mit frischen Daten aus `runnerget.json` aktualisiert

**Darstellung:**
- Datum: aus `"2026-03-17 06:00:00"` → formatiert als `"17.03.2026"`
- Distanz: aus `"5.5"` → formatiert als `"5,50 km"`
- Gesamtdistanz: Summe aller `runDistance`-Werte

**Komponenten:**
- `src/app/runs/page.tsx` — Client Page (braucht Context-Zugriff)
- `src/components/runs-table.tsx` — shadcn/ui `Table` mit Datum, Distanz, Index-basierten Aktionen
- `src/components/stats-card.tsx` — shadcn/ui `Card` mit Gesamtdistanz + Anzahl Läufe
- `src/components/delete-run-dialog.tsx` — shadcn/ui `AlertDialog` für Lösch-Bestätigung
- `src/components/page-header.tsx` — Läufername + "Läufer wechseln"-Link

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
