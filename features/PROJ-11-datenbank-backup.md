# PROJ-11: Datenbank-Backup

## Status: Deployed
**Created:** 2026-03-23
**Last Updated:** 2026-03-23

## Dependencies
- None (unabhängig vom restlichen System)

## User Stories
- Als Administrator möchte ich ein einfaches Script aufrufen können, das die aktuelle Datenbank sichert, damit ich bei Bedarf Daten wiederherstellen kann.
- Als Administrator möchte ich, dass jede Tabelle als CSV exportiert wird, damit ich die Daten ohne spezielle Tools lesen und importieren kann.
- Als Administrator möchte ich, dass das Backup komprimiert lokal gespeichert wird, damit es wenig Speicherplatz belegt und einfach archiviert werden kann.
- Als Administrator möchte ich, dass das Script die Credentials aus der bestehenden `.env.local` Datei liest, damit ich keine Zugangsdaten manuell eingeben muss.
- Als Administrator möchte ich das Zielverzeichnis für das Backup-Archiv als optionales Argument angeben können, damit ich Backups direkt in ein bestimmtes Verzeichnis (z. B. externe Festplatte, NAS) schreiben kann.

## Acceptance Criteria
- [ ] Das Script `scripts/backup-db.js` ist per `node scripts/backup-db.js` ausführbar
- [ ] Das Script liest `NEXT_PUBLIC_SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` aus `.env.local`
- [ ] Alle Tabellen des `public` Schemas werden automatisch ermittelt und exportiert (interne Supabase-Hilfstabellen werden gefiltert)
- [ ] Jede Tabelle wird als eigene `.csv` Datei exportiert (Dateiname: `<tabellenname>.csv`)
- [ ] Tabellen mit mehr als 1000 Zeilen werden automatisch paginiert (1000er-Batches via `.range()`)
- [ ] Alle CSV-Dateien werden als `.tar.gz` Archiv komprimiert (`tar` + `dotenv` als devDependencies)
- [ ] Das Zielverzeichnis kann als optionales Argument übergeben werden: `node scripts/backup-db.js [output-dir]`
- [ ] Wird kein Argument übergeben, wird das Archiv im aktuellen Verzeichnis abgelegt (bisheriges Verhalten bleibt erhalten)
- [ ] Existiert das angegebene Zielverzeichnis noch nicht, wird es automatisch erstellt (inkl. verschachtelte Pfade)
- [ ] Das Script gibt zu Beginn aus, in welches Verzeichnis das Backup geschrieben wird
- [ ] Der Archiv-Dateiname enthält einen Zeitstempel (Format: `backup_YYYY-MM-DD_HH-MM-SS.tar.gz`)
- [ ] Das Script gibt während der Ausführung Statusmeldungen aus (welche Tabelle gerade exportiert wird)
- [ ] Das Script bricht mit einer verständlichen Fehlermeldung ab, wenn `.env.local` nicht gefunden wird oder die Supabase-Verbindung fehlschlägt
- [ ] Temporäre CSV-Dateien werden nach der Komprimierung aufgeräumt (kein Datenrückstand)

## Edge Cases
- `.env.local` existiert nicht oder enthält keine Supabase-Variablen → Script bricht mit Fehlermeldung ab
- Supabase-Verbindung schlägt fehl (falscher Key, Netzwerkfehler) → Script bricht mit Fehlermeldung ab
- Datenbank enthält keine Tabellen im `public` Schema → Script erstellt leeres Archiv und gibt Hinweis aus
- Eine Tabelle hat mehr als 1000 Zeilen → Script paginiert automatisch (Supabase REST API Limit)
- Angegebenes Zielverzeichnis existiert nicht → Script erstellt es automatisch (inklusive übergeordneter Verzeichnisse)
- Schreibrechte fehlen im Zielverzeichnis → Script bricht mit Fehlermeldung ab
- Backup wird auf einem anderen Rechner gestartet → Script funktioniert, solange `.env.local` im Projektverzeichnis liegt und `node` installiert ist

## Technical Requirements
- Implementierung: Node.js Script (`scripts/backup-db.js`)
- Abhängigkeiten: Nutzt bereits installiertes `@supabase/supabase-js` aus dem Projekt
- Komprimierung: `.tar.gz` via `tar` npm-Paket (devDependency) + natives `node:zlib`
- Env-Parsing: `dotenv` als devDependency
- Keine neue Env-Variable nötig — nutzt `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- Lauffähig unter macOS und Linux
- Aufruf: `node scripts/backup-db.js` (Archiv im CWD) oder `node scripts/backup-db.js /pfad/zum/verzeichnis`
- Zielverzeichnis-Argument via `process.argv[2]`, Fallback auf `process.cwd()`
- Verzeichnis-Erstellung via `fs.mkdirSync(dir, { recursive: true })`

---
<!-- Sections below are added by subsequent skills -->

## Implementation Notes
- `scripts/backup-db.js` — CommonJS Node.js script, callable via `node scripts/backup-db.js [output-dir]`
- Tabellen-Discovery via OpenAPI-Spec am Supabase REST-Root-Endpoint (`/rest/v1/`)
- Paginierung in 1000er-Batches via `.range(from, from+999)`
- CSV-Generierung ohne externe Abhängigkeit (internes `toCSV()`-Helper)
- Komprimierung via `tar` npm-Paket (`tar.create({ gzip: true, ... })`)
- Temp-Verzeichnis via `os.tmpdir()` + automatisches Cleanup im `finally`-Block
- `dotenv` und `tar` als devDependencies in package.json hinzugefügt (v16 / v7)
- Optionales Zielverzeichnis via `process.argv[2]`, Fallback auf `process.cwd()`
- Zielverzeichnis wird bei Bedarf automatisch erstellt (`fs.mkdirSync` mit `recursive: true`)
- Schreibrechte werden vor dem Backup durch einen Testdatei-Schreibversuch geprüft
- Statusmeldung zu Beginn zeigt das Zielverzeichnis an

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
