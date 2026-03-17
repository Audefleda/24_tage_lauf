# PROJ-2: Läufer-Auswahl

## Status: Planned
**Created:** 2026-03-17
**Last Updated:** 2026-03-17

## Dependencies
- Requires: PROJ-1 (API-Konfiguration & Superuser-Authentifizierung)

## User Stories
- Als Nutzer möchte ich beim Öffnen der App eine Liste aller Läufer sehen, damit ich mich als die richtige Person identifizieren kann.
- Als Nutzer möchte ich meinen Namen in der Liste suchen oder filtern, damit ich ihn bei vielen Läufern schnell finde.
- Als Nutzer möchte ich meine Auswahl für die aktuelle Session merken lassen, damit ich bei jedem Tab-Wechsel nicht neu auswählen muss.
- Als Nutzer möchte ich die Läufer-Auswahl jederzeit wechseln können.

## Acceptance Criteria
- [ ] Beim App-Start wird die Läuferliste von der API geladen und angezeigt
- [ ] Die Liste zeigt mindestens: Name des Läufers (und ggf. Team/Kategorie falls vorhanden)
- [ ] Eine Suchfunktion filtert die Liste live nach Eingabe
- [ ] Nach der Auswahl wird der Nutzer zur Läufe-Übersicht weitergeleitet
- [ ] Die Auswahl wird in der Session (z.B. sessionStorage oder React Context) gespeichert
- [ ] Ein "Läufer wechseln"-Button ist immer sichtbar, um zur Auswahl zurückzukehren
- [ ] Ladezustand wird während des API-Calls angezeigt (Skeleton oder Spinner)

## Edge Cases
- Was passiert, wenn die Läuferliste leer ist? → Hinweismeldung "Keine Läufer gefunden"
- Was passiert, wenn die API die Läufer nicht zurückgibt? → Fehlermeldung mit Retry
- Was passiert, wenn der Nutzer die Seite neu lädt? → Auswahl-Screen wird wieder gezeigt (kein persistenter Login)
- Was passiert bei sehr vielen Läufern (>100)? → Suche/Filter muss funktionieren

## Technical Requirements
- Läuferliste wird über Server Action oder API Route von der externen API geladen
- Auswahl wird im React Context gehalten (kein LocalStorage)
- Komponente: Liste + Suchfeld aus shadcn/ui (Command-Komponente eignet sich gut)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

**Seite:** `/select` — eigenständige Page im App Router

**API-Endpoint (jetzt bekannt):**
- `POST https://www.stuttgarter-kinderstiftung.de/runnerget.json`
- Auth: Cookie `fe_typo_user` + Header `X-Requested-With: XMLHttpRequest`
- Gibt JSON-Array aller Läufer zurück

**Runner-Datenstruktur (von der API):**
```
uid             — eindeutige Läufer-ID (z.B. 6347)
nr              — Startnummer (z.B. 1739)
name            — Name des Läufers (z.B. "AKW")
totaldistance   — Gesamtdistanz als String (z.B. "0,00")
crdate          — Anmeldedatum (z.B. "26.02.2026")
runs            — Array der Läufe (leer oder befüllt)
totaldistanceFromArray — Gesamtdistanz als Zahl
```

**Datenfluss:**
1. Page lädt via Server Action alle Läufer von `runnerget.json` (nur `uid` + `name` relevant)
2. Liste wird als Props an Client-Komponente übergeben
3. Client-Komponente filtert die Liste lokal nach Name (kein erneuter API-Call)
4. Nach Auswahl: Läufer-Objekt (`uid` + `name` + `runs`) wird im React Context gespeichert

**Komponenten:**
- `src/app/select/page.tsx` — Server Component, lädt Läuferliste
- `src/components/runner-search.tsx` — Client Component mit shadcn/ui `Command` für Suche + Auswahl
- `src/context/runner-context.tsx` — React Context, speichert `{ uid, name, runs[] }` für die Session

**Navigation nach Auswahl:** `router.push('/runs')`

**Session-Verhalten:** Auswahl lebt nur im React Context (in-memory). Bei Seiten-Reload → zurück zu `/select`.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
