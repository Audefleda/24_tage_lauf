# Product Requirements Document

## Vision
24-Tage-Lauf ist ein alternatives Frontend für eine bestehende Lauf-Event-Website. Die App ermöglicht einer kleinen Gruppe von Läufern (5–30 Personen), sich mit eigenem Account anzumelden und ihre Läufe komfortabel einzutragen und zu verwalten. Die Kommunikation mit der Ziel-Website läuft über die TYPO3-API (authentifiziert durch einen zentralen Superuser). Supabase verwaltet Benutzer-Authentifizierung, Runner-Profile und spätere Strava-Integrationen.

## Target Users
**Läufer eines Events (5–30 Personen)**
- Haben einen eigenen Account (E-Mail + Passwort via Supabase Auth)
- Möchten Läufe schnell und einfach eintragen
- Sehen nur ihre eigenen Läufe
- Wollen ggf. Läufe automatisch via Strava synchronisieren

**Administrator**
- Legt Benutzeraccounts an und verknüpft sie mit TYPO3-Läufer-IDs
- Verwaltet Superuser-Credentials als Env-Variablen
- Betreibt die App auf Vercel

## Core Features (Roadmap)

| Priority | Feature | Status |
|----------|---------|--------|
| P0 (MVP) | API-Konfiguration & Superuser-Authentifizierung | In Review |
| P0 (MVP) | Anmeldung (Supabase Auth Login) | In Progress |
| P0 (MVP) | Läufe-Übersicht | In Progress |
| P0 (MVP) | Läufe-Verwaltung (CRUD) | In Progress |
| P1 | Benutzerverwaltung (Admin) | Planned |
| P1 | TYPO3 Request Log (Admin) | Planned |
| P1 | Läufer-Selbstzuordnung beim ersten Login | Planned |
| P1 | Erstanmeldung — Initiales Passwort setzen | Planned |
| P1 | Firmen-Erstattungs-Cap (100km pro Läufer) | Planned |
| P2 | Strava-Webhook-Integration (OAuth + automatischer Lauf-Eintrag via Webhook) | Planned |
| P2 | Strava UI-Sichtbarkeit Toggle (Admin) | Planned |
| P2 | Datenbank-Backup (Shell-Script, CSV-Export, komprimiert) | Planned |
| P2 | Debug-Logging (LOG_LEVEL=debug via Vercel Env, maskierte Tokens) | Planned |
| P2 | Sprache — Umlaute & gendergerechte Formulierungen (Genderstern) | Planned |
| P2 | Dev/Prod Datenbank-Trennung (Supabase CLI + GitHub Actions) | Planned |
| P2 | Externer Webhook-Token (Make.com / Zapier Alternative zu Strava-App) | Planned |
| P2 | Team-Gesamtkilometer in UI anzeigen (mit 100km-Cap) | Planned |
| P2 | Rangliste (Admin) — Sortierte Übersicht aller Läufer*innen nach Gesamtkilometern | Planned |
| P2 | Team-Rangposition anzeigen — Platzierung von BettercallPaul in der öffentlichen Gesamtwertung | Planned |

## Success Metrics
- Alle Läufer können sich anmelden und ihre eigenen Läufe eintragen
- Kein Läufer kann die Läufe eines anderen sehen oder verändern
- Admin kann neue Accounts anlegen und Runner-Zuordnungen verwalten
- Strava-Webhook kann pro Läufer aktiviert und deaktiviert werden (P2)

## Constraints
- Team: 1 Entwickler
- Deployment: Vercel (kostenloser Tier)
- Supabase: kostenloser Tier (ausreichend für 5–30 Nutzer)
- TYPO3-API: `updateruns` ersetzt immer alle Läufe — kein per-Lauf CRUD

## Non-Goals
- Keine eigene Datenbank für Läufe (Läufe bleiben in TYPO3)
- Keine Verwaltung der TYPO3-Website über die App
- Keine Mobile App (nur Web)
- Kein Self-Service-Registrierung — Accounts werden im Supabase Dashboard angelegt
- Kein User-Anlegen innerhalb der App
