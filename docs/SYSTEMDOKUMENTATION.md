# Systemdokumentation — 24-Tage-Lauf

> Fachliche Gesamtübersicht des Systems. Beschreibt die Architektur, Kernfunktionen und Datenverwaltung aus fachlicher Sicht ohne technische Implementierungsdetails.

**Stand:** 2026-04-17  
**Version:** 1.0

---

## Überblick

24-Tage-Lauf ist ein alternatives Frontend für eine bestehende TYPO3-basierte Lauf-Event-Website. Die Anwendung ermöglicht einer kleinen Gruppe von Läufer*innen (5–30 Personen), sich mit eigenem Account anzumelden und ihre Läufe komfortabel zu verwalten.

### Kern-Prinzip

Das System fungiert als moderne Benutzeroberfläche vor einer Legacy-Backend-Struktur:
- **Datenspeicher für Läufe:** TYPO3-Website (bestehend, wird nicht ersetzt)
- **Benutzerverwaltung & Authentifizierung:** Supabase (neu, ermöglicht individuelle Accounts)
- **Automatisierung:** Strava-Integration synchronisiert Läufe automatisch

### Nutzergruppen

1. **Läufer*innen** — Tragen ihre Läufe ein, sehen nur ihre eigenen Daten
2. **Administrator*innen** — Verwalten Benutzer-Accounts und Läufer-Zuordnungen

---

## Systemarchitektur (fachlich)

### Drei-Schichten-Modell

```
┌─────────────────────────────────────────┐
│   Browser (Läufer & Admin)              │
│   - Läufe anzeigen & bearbeiten         │
│   - Strava verbinden                    │
│   - Admin: Benutzerverwaltung           │
└─────────────────────────────────────────┘
                  ↕
┌─────────────────────────────────────────┐
│   24-Tage-Lauf App (Next.js)            │
│   - Authentifizierung (Supabase Auth)   │
│   - Session-Verwaltung                  │
│   - TYPO3-Kommunikation (Server-side)   │
└─────────────────────────────────────────┘
         ↕                        ↕
┌───────────────────┐   ┌────────────────────┐
│  Supabase         │   │  TYPO3-Website     │
│  (Benutzerdaten)  │   │  (Laufdaten)       │
└───────────────────┘   └────────────────────┘
         ↕
┌───────────────────┐
│  Strava API       │
│  (Webhook-Events) │
└───────────────────┘
```

### Datenverteilung

| Was wird wo gespeichert? | System | Grund |
|--------------------------|--------|-------|
| Läufe (Datum + Distanz) | TYPO3 | Bestehende Ziel-Website, unveränderbar |
| Benutzer-Accounts | Supabase Auth | Ermöglicht individuelle Logins |
| Läufer-Zuordnung (User → TYPO3-UID) | Supabase DB | Verknüpfung zwischen Account und TYPO3-Läufer |
| Strava-Verbindungen | Supabase DB | OAuth-Tokens pro Benutzer |
| Webhook-Token | Supabase DB | Externe Automatisierung (z.B. Make.com) |
| TYPO3-API-Logs | Supabase DB | Monitoring & Debugging |

---

## Kernfunktionen

### 1. Anmeldung & Zugangsverwaltung

#### Für Läufer*innen
- **Login:** E-Mail + Passwort (Supabase Auth)
- **Passwort vergessen:** Selbstbedienungs-Reset via E-Mail-Link
- **Erstanmeldung:** Temporäres Passwort per E-Mail, erzwingt Passwortänderung beim ersten Login
- **Läufer-Selbstzuordnung:** Beim ersten Login wählt der/die Benutzer*in aus einer Liste, welcher TYPO3-Läufer er/sie ist
- **Session:** Bleibt über Seiten-Reloads erhalten (persistente Cookies)

#### Für Administrator*innen
- **Accounts anlegen:** Im Supabase Dashboard (kein Self-Service-Registrierung)
- **Admin-Rolle:** Wird in geschützten Metadaten (`app_metadata`) gesetzt — Läufer*innen können sich nicht selbst zu Admins machen
- **Läufer-Zuordnung ändern:** Admin kann nachträglich die Zuordnung korrigieren, falls beim ersten Login ein Fehler passiert ist

### 2. Läufe-Verwaltung

#### Übersicht
- **Event-Zeitraum:** 20.04.2026 bis 14.05.2026 (25 Tage)
- **Wochenweise Darstellung:** Jede Woche als separate Karte (4 Wochen + 4 Tage)
- **Statistiken:** Gesamtdistanz, Lauftage, Team-Gesamtkilometer BettercallPaul
- **Team-Gesamtkilometer:** Zeigt die erstattungsfähige Summe aller Läufer*innen (mit 100km-Cap pro Person) — sichtbar für alle eingeloggten Nutzer*innen
- **Firmen-Erstattungs-Cap:** Visuelle Anzeige, welche Läufe die ersten 100 km abdecken (werden vom Arbeitgeber erstattet)

#### Eintragen & Bearbeiten
- **Inline-Editing:** Distanzen werden direkt in der Tabelle bearbeitet — kein separater Edit-Screen
- **Auto-Save:** Beim Verlassen eines Eingabefeldes wird automatisch gespeichert
- **Visuelles Feedback:** Jede Zeile zeigt Lade-Spinner (während Speichern), grüner Haken (Erfolg), roter Fehler-Icon (Fehler)
- **Validierung:** Positive Dezimalzahlen mit max. 3 Nachkommastellen, Komma-Eingabe wird automatisch erkannt
- **Löschen:** Leer-Eintrag oder 0 entfernt den Lauf — kein separater Löschen-Button

#### TYPO3-API-Besonderheit
Die TYPO3-API kennt **keine einzelnen Updates** — beim Speichern wird immer die **komplette Laufliste** des Läufers ersetzt. Dies bedeutet:
- Jede Änderung lädt alle Läufe, modifiziert das Array lokal und schickt alles zurück
- Läufe außerhalb des Event-Zeitraums werden automatisch mit übertragen (kein Datenverlust)

### 3. Strava-Integration (optional)

#### Für Läufer*innen
- **Verbinden:** OAuth-Flow startet über "Strava verbinden"-Button auf der Läufe-Seite
- **Status:** Sichtbar, ob Strava verbunden ist und wann der letzte Lauf automatisch eingetragen wurde
- **Trennen:** Verbindung kann jederzeit wieder gelöst werden
- **Sichtbarkeit steuern:** Admin kann entscheiden, ob Strava-Bereich überhaupt angezeigt wird (PROJ-25)

#### Automatische Synchronisierung
- **Strava-Webhook:** Benachrichtigt die App bei jedem neuen Lauf
- **Erlaubte Aktivitätstypen:** Run, TrailRun, VirtualRun, Hike, Walk
- **Automatischer Eintrag:** Datum und Distanz werden extrahiert und wie ein manueller Lauf eingetragen
- **Token-Refresh:** Abgelaufene Access-Tokens werden automatisch erneuert

#### Für Administrator*innen
- **Globaler Webhook:** Einmalig bei Strava registriert (gilt für alle verbundenen Läufer*innen)
- **De-Registrierung:** Admin kann den Webhook wieder entfernen
- **UI-Sichtbarkeit:** Admin kann Strava-Funktionen in der Läufer-Oberfläche ein-/ausblenden

### 4. Benutzerverwaltung (Admin)

#### Nutzer-Übersicht
- **Liste aller Accounts:** E-Mail, zugeordneter Läufer (Name + Startnummer), Erstellungsdatum
- **Zuordnung bearbeiten:** Inline-Dropdown zur Auswahl aus TYPO3-Läuferliste
- **Bereits vergebene Läufer:** Im Dropdown als "(vergeben)" markiert und deaktiviert
- **Zuordnung entfernen:** "Keine Zuordnung" wählbar — löscht die Verknüpfung
- **Automatisches Speichern:** Keine separate Speichern-Schaltfläche — Änderung wird sofort übernommen

#### Datenschutz-Prinzip
- **Datenisolation:** Jede*r Läufer*in sieht nur seine/ihre eigenen Läufe — niemals die Daten anderer
- **Server-seitige Zuordnung:** Die TYPO3-Läufer-UID wird ausschließlich serverseitig aus dem Supabase-Profil gelesen — der Browser kann keine fremde UID vorgeben

### 5. Läufer-Profil (Selbstbedienung)

- **Name bearbeiten:** Läufer*innen können ihren eigenen Namen ändern
- **Alter bearbeiten:** Läufer*innen können ihr Alter aktualisieren
- **Änderungen werden live an TYPO3 übertragen** — erscheinen sofort auf der Ziel-Website

### 6. Benachrichtigungen (Microsoft Teams)

#### Automatische Benachrichtigung
- **Auslöser:** Nach jedem manuell oder automatisch (Strava) eingetragenen Lauf
- **Inhalt:** Name des/der Läufer*in, Distanz, Datum, Gesamtdistanz bisher
- **Webhook-Ziel:** Microsoft Teams Channel (konfigurierbar via Env-Variable)

#### Opt-out
- **Benutzer-Einstellung:** Checkbox auf der Läufe-Seite "Benachrichtigungen aktivieren"
- **Standard:** Aktiviert — Läufer*innen müssen aktiv deaktivieren

### 7. Externe Webhook-Token (Make.com / Zapier)

**Zweck:** Alternative zur offiziellen Strava-Webhook-Integration für externe Automatisierungstools.

#### Funktionsweise
- **Token generieren:** Admin-Seite zeigt vorhandenes Token oder ermöglicht Generierung eines neuen
- **Webhook-URL:** `https://app.vercel.app/api/webhook/runs?token=<TOKEN>`
- **Externe Tools:** Make.com, Zapier oder eigene Scripts können Läufe via POST an diese URL senden
- **Format:** JSON-Body mit `{ "date": "YYYY-MM-DD", "distance": 5.5 }`
- **Authentifizierung:** Token im Query-Parameter statt OAuth

---

## Monitoring & Wartung

### 1. TYPO3 Request Log (Admin)

- **Alle Anfragen an TYPO3 werden protokolliert:** Zeitstempel, Endpunkt, HTTP-Status, Antwortzeit
- **Fehler-Details:** Vollständiger TYPO3-Antwort-Body bei Fehlern
- **Filter:** Nach Benutzer, Zeitraum, Status (Erfolg/Fehler)
- **Zweck:** Nachvollziehen, wer wann welche Änderungen vorgenommen hat und ob Probleme aufgetreten sind

### 2. Debug-Logging

- **Aktivierung:** Env-Variable `LOG_LEVEL=debug`
- **Maskierung:** Sensitive Daten (Passwörter, Tokens) werden nie vollständig geloggt
- **Wo:** Alle TYPO3-API-Aufrufe, Strava-OAuth, Webhook-Events
- **Zweck:** Fehlersuche bei Integrationsproblemen

### 3. Datenbank-Backup

- **Script:** `node scripts/backup-db.js [zielverzeichnis]`
- **Inhalt:** Alle Supabase-Tabellen als CSV-Dateien, komprimiert als `.tar.gz`
- **Zeitstempel:** Dateiname enthält Datum & Uhrzeit
- **Automatische Paginierung:** Tabellen mit mehr als 1000 Zeilen werden in Batches exportiert
- **Verwendung:** Lokale Archivierung, kein Cloud-Backup

---

## Umgebungsverwaltung

### Zwei Supabase-Instanzen

| Umgebung | Supabase-Instanz | Genutzt von |
|----------|------------------|-------------|
| **Development** | `24-tage-lauf-dev` | Lokale Entwicklung, Vercel Preview Deployments |
| **Production** | `24-tage-lauf-prod` | Vercel Production (`main`-Branch) |

### Datenbankmigrationen

- **Versioniert:** Alle Schema-Änderungen als SQL-Dateien im Repository (`supabase/migrations/`)
- **Lokal testen:** `supabase db push --db-url <DEV_URL>` wendet Migrationen auf Dev-Instanz an
- **Automatisch auf Production:** GitHub Action bei Push auf `main` — führt Migrationen automatisch aus
- **Kein manuelles SQL:** Kein direktes Ausführen von SQL im Dashboard nötig

### Umgebungsanzeige

- **Farbcodiert:** Oranger Banner auf Dev-Instanz, grüner Banner auf Production
- **Sichtbar für alle:** Läufer*innen und Admin sehen, in welcher Umgebung sie arbeiten

---

## Benutzeroberfläche & Design

### Corporate Identity (BettercallXPaul)

- **Primärfarben:** Schwarz, Weiß, Grün (Akzentfarbe)
- **Schriftart:** Montserrat (Google Fonts)
- **Stil:** Minimalistisch, klare Linien, hoher Kontrast

### Dark Mode

- **Systemgesteuert:** Folgt automatisch den Systemeinstellungen des Browsers/OS
- **Kein manueller Toggle:** Nutzer*innen müssen kein UI-Element bedienen
- **CI-konform:** Alle Farben wurden für Dark Mode angepasst (grüne Akzente bleiben erkennbar)

### Sprache

- **Vollständig auf Deutsch:** Alle UI-Texte, Fehlermeldungen, Benachrichtigungen
- **Gendergerechte Formulierungen:** Genderstern (*) für geschlechtsneutrale Ansprache
- **Umlaute:** Keine ASCII-Transliterationen — "für" statt "fuer", "Läufer*innen" statt "Laeufer"

---

## Sicherheit & Datenschutz

### Authentifizierung & Autorisierung

- **Supabase Auth:** E-Mail + Passwort, keine Drittanbieter-Logins
- **Session-Cookies:** HttpOnly, Secure, SameSite — nicht von JavaScript auslesbar
- **Middleware:** Alle Routen außer `/login` sind geschützt — nicht angemeldete Nutzer*innen werden automatisch zur Login-Seite weitergeleitet
- **Admin-Rolle:** In geschützten Metadaten (`app_metadata`) gespeichert — nur über Service Role Key setzbar

### Datenisolation

- **Row Level Security (RLS):** Supabase-Tabellen sind so konfiguriert, dass Nutzer*innen nur ihre eigenen Daten sehen
- **Server-seitige UID-Ermittlung:** Die TYPO3-Läufer-UID wird niemals vom Client übernommen — immer nur serverseitig aus dem Supabase-Profil gelesen
- **TYPO3-Credentials:** Bleiben server-only — niemals im Browser sichtbar

### Input-Validierung

- **Zod-Schemas:** Alle API-Endpunkte validieren Eingaben mit Zod
- **Client + Server:** Doppelte Validierung — Client-Validierung für UX, Server-Validierung für Sicherheit
- **SQL-Injection-Schutz:** Alle Datenbankzugriffe über Supabase Client (parametrisierte Queries)

### Rate Limiting

- **In-Memory Rate Limiter:** Pro IP-Adresse, unterschiedliche Limits je Endpunkt
- **Beispiele:** 30 Requests/Minute für Läufer-Endpunkte, 10 Requests/Minute für Admin-Endpunkte

### Security Headers

- **HSTS:** Strict-Transport-Security mit `includeSubDomains`
- **X-Frame-Options:** `DENY` (keine Einbettung in iframes)
- **X-Content-Type-Options:** `nosniff`
- **Referrer-Policy:** `strict-origin-when-cross-origin`
- **Permissions-Policy:** Kamera, Mikrofon, Geolocation deaktiviert

---

## Technischer Betrieb (für Administrator*innen)

### Hosting & Deployment

- **Plattform:** Vercel (Free Tier ausreichend für 5-30 Nutzer*innen)
- **Automatisches Deployment:** Jeder Push auf `main` löst automatisch ein Production-Deployment aus
- **Preview Deployments:** Pull Requests erhalten automatisch Preview-URLs (nutzen Dev-Datenbank)

### Umgebungsvariablen

Werden in Vercel konfiguriert (keine manuelle Datei-Verwaltung im Production-Betrieb):

| Variable | Zweck |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-Projekt-URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Öffentlicher Supabase-Key (RLS schützt Daten) |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin-Key für server-seitige Operationen |
| `TYPO3_BASE_URL` | Basis-URL der TYPO3-Website |
| `TYPO3_LOGIN_PATH` | Pfad zur Login-Seite auf TYPO3 |
| `TYPO3_EMAIL` | Superuser-E-Mail für TYPO3-Login |
| `TYPO3_PASSWORD` | Superuser-Passwort für TYPO3 |
| `STRAVA_CLIENT_ID` | Strava App Client ID |
| `STRAVA_CLIENT_SECRET` | Strava App Secret |
| `STRAVA_VERIFY_TOKEN` | Selbst gewählter String zur Webhook-Verifizierung |
| `TEAMS_WEBHOOK_URL` | Microsoft Teams Channel Webhook-URL |

### Häufige Admin-Aufgaben

#### Neuen Benutzer anlegen
1. Supabase Dashboard öffnen
2. Authentication → Users → "Add user"
3. E-Mail + temporäres Passwort eingeben
4. "Send confirmation email" deaktivieren
5. "Set password" aktivieren und "Require password change" aktivieren
6. User erhält E-Mail mit temporärem Passwort
7. Beim ersten Login: Läufer-Selbstzuordnung erscheint automatisch

#### Admin-Rolle vergeben
1. Supabase Dashboard → Authentication → Users
2. Nutzer*in auswählen → "Raw User Meta Data" öffnen
3. In `app_metadata` ergänzen: `{ "role": "admin" }`
4. Speichern — beim nächsten Login erscheint der Admin-Bereich

#### Strava-Webhook registrieren
1. Als Admin anmelden
2. Admin-Bereich → Strava-Webhook-Setup
3. "Webhook bei Strava registrieren" klicken
4. Erfolg wird angezeigt — alle verbundenen Läufer*innen erhalten ab sofort automatisch Läufe

---

## Besonderheiten & Einschränkungen

### TYPO3-API Einschränkungen

- **Kein echtes REST CRUD:** Es gibt nur einen Endpunkt `updateruns`, der immer die komplette Laufliste ersetzt
- **Keine einzelnen Lauf-IDs:** Läufe werden als Array ohne persistente IDs übertragen
- **HTML-Parsing:** Login-Flow parst HTML statt JSON (TYPO3 hat keine native JSON REST API)

### Funktionale Einschränkungen

- **Keine Mehrfach-Zuordnung:** Ein TYPO3-Läufer kann nur einem Benutzer-Account zugeordnet sein
- **Keine Self-Service-Registrierung:** Accounts können nur von Admins angelegt werden
- **Keine Verwaltung der TYPO3-Website:** Die App ist nur ein alternatives Frontend — die TYPO3-Website bleibt unveränderbar
- **Kein Benutzer-Anlegen in der App:** Muss immer im Supabase Dashboard erfolgen

### Skalierungsgrenzen (aktueller Vercel Free Tier)

- **5-30 Nutzer*innen:** Optimal
- **30-100 Nutzer*innen:** Funktioniert, aber Rate Limits könnten angepasst werden müssen
- **Über 100 Nutzer*innen:** Vercel Paid Plan empfohlen

---

## Änderungshistorie

| Datum | Version | Änderung |
|-------|---------|----------|
| 2026-04-17 | 1.0 | Initiale Erstellung — 25 Features dokumentiert |
| 2026-04-20 | 1.1 | PROJ-26: Team-Gesamtkilometer BettercallPaul in Läufe-Übersicht hinzugefügt |

