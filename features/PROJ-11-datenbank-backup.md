# PROJ-11: Datenbank-Backup

## Status: Planned
**Created:** 2026-03-23
**Last Updated:** 2026-03-23

## Dependencies
- None (unabhängig vom restlichen System)

## User Stories
- Als Administrator möchte ich ein einfaches Script aufrufen können, das die aktuelle Datenbank sichert, damit ich bei Bedarf Daten wiederherstellen kann.
- Als Administrator möchte ich, dass jede Tabelle als CSV exportiert wird, damit ich die Daten ohne spezielle Tools lesen und importieren kann.
- Als Administrator möchte ich, dass das Backup komprimiert lokal gespeichert wird, damit es wenig Speicherplatz belegt und einfach archiviert werden kann.
- Als Administrator möchte ich, dass das Script die Credentials aus der bestehenden `.env.local` Datei liest, damit ich keine Zugangsdaten manuell eingeben muss.

## Acceptance Criteria
- [ ] Das Script `scripts/backup-db.js` ist per `node scripts/backup-db.js` ausführbar
- [ ] Das Script liest `NEXT_PUBLIC_SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` aus `.env.local`
- [ ] Alle Tabellen des `public` Schemas werden automatisch ermittelt und exportiert
- [ ] Jede Tabelle wird als eigene `.csv` Datei exportiert (Dateiname: `<tabellenname>.csv`)
- [ ] Alle CSV-Dateien werden als `.tar.gz` Archiv komprimiert (natives Node.js, keine extra Abhängigkeit)
- [ ] Das Archiv wird im aktuellen Verzeichnis abgelegt, aus dem das Script aufgerufen wird
- [ ] Der Archiv-Dateiname enthält einen Zeitstempel (Format: `backup_YYYY-MM-DD_HH-MM-SS.tar.gz`)
- [ ] Das Script gibt während der Ausführung Statusmeldungen aus (welche Tabelle gerade exportiert wird)
- [ ] Das Script bricht mit einer verständlichen Fehlermeldung ab, wenn `.env.local` nicht gefunden wird oder die Supabase-Verbindung fehlschlägt
- [ ] Temporäre CSV-Dateien werden nach der Komprimierung aufgeräumt (kein Datenrückstand)

## Edge Cases
- `.env.local` existiert nicht oder enthält keine Supabase-Variablen → Script bricht mit Fehlermeldung ab
- Supabase-Verbindung schlägt fehl (falscher Key, Netzwerkfehler) → Script bricht mit Fehlermeldung ab
- Datenbank enthält keine Tabellen im `public` Schema → Script erstellt leeres Archiv und gibt Hinweis aus
- Eine Tabelle hat mehr als 1000 Zeilen → Script paginiert automatisch (Supabase REST API Limit)
- Schreibrechte fehlen im Zielverzeichnis → Script bricht mit Fehlermeldung ab
- Backup wird auf einem anderen Rechner gestartet → Script funktioniert, solange `.env.local` im Projektverzeichnis liegt und `node` installiert ist

## Technical Requirements
- Implementierung: Node.js Script (`scripts/backup-db.js`)
- Abhängigkeiten: Nutzt bereits installiertes `@supabase/supabase-js` aus dem Projekt
- Komprimierung: `.tar.gz` via natives `node:zlib` + `node:tar` (keine extra Abhängigkeit)
- Env-Parsing: `dotenv` als devDependency
- Keine neue Env-Variable nötig — nutzt `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- Lauffähig unter macOS und Linux
- Aufruf aus dem Projektverzeichnis: `node scripts/backup-db.js`

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
