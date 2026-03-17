# PROJ-3: Läufe-Übersicht

## Status: Planned
**Created:** 2026-03-17
**Last Updated:** 2026-03-17

## Dependencies
- Requires: PROJ-1 (API-Konfiguration & Superuser-Authentifizierung)
- Requires: PROJ-2 (Anmeldung — Supabase Auth, liefert TYPO3-UID des eingeloggten Läufers)

## User Stories
- Als Läufer möchte ich alle meine eingetragenen Läufe auf einen Blick sehen, damit ich den Überblick behalte.
- Als Läufer möchte ich für jeden Lauf die wichtigsten Daten sehen (Datum, Distanz, Zeit o.ä.), damit ich sie auf Korrektheit prüfen kann.
- Als Läufer möchte ich eine Gesamtstatistik sehen (z.B. Gesamtdistanz), damit ich meinen Fortschritt erkenne.
- Als Läufer möchte ich einen Button sehen, um einen neuen Lauf hinzuzufügen.

## Acceptance Criteria
- [ ] Die Übersicht zeigt alle Läufe des ausgewählten Läufers, geordnet nach Datum (neueste zuerst)
- [ ] Jeder Lauf zeigt mindestens: Datum, Distanz, ggf. Dauer/Pace
- [ ] Eine Gesamtstatistik (Summe der Distanzen) wird angezeigt
- [ ] Ein "Neuen Lauf eintragen"-Button ist prominent sichtbar
- [ ] Jeder Lauf hat Edit- und Delete-Aktionen (führen zu PROJ-4)
- [ ] Ladezustand wird während des API-Calls angezeigt
- [ ] Leerzustand ("Noch keine Läufe eingetragen") wird angezeigt wenn die Liste leer ist
- [ ] Der Name des ausgewählten Läufers ist sichtbar (mit "Wechseln"-Link)

## Edge Cases
- Was passiert, wenn der Läufer noch keine Läufe hat? → Leerzustand mit CTA "Ersten Lauf eintragen"
- Was passiert, wenn die API-Abfrage fehlschlägt? → Fehlermeldung mit Retry-Button
- Was passiert bei sehr vielen Läufen (>50)? → Pagination oder Scroll-Liste

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
