# PROJ-28: Team-Rangposition anzeigen

## Status: Planned
**Created:** 2026-04-27
**Last Updated:** 2026-04-27

## Dependencies
- Erfordert: PROJ-3 (Läufe-Übersicht) — neue Komponente wird auf der Läufe-Seite platziert

## User Stories
- Als Läufer*in möchte ich sehen, auf welchem Platz unser Team BettercallPaul gerade in der Gesamtwertung steht, damit ich motiviert bleibe und unseren Fortschritt verfolgen kann.
- Als Läufer*in möchte ich die Gesamtzahl der teilnehmenden Teams sehen, damit ich einschätzen kann, wie gut unsere Position ist (z.B. "Platz 5 von 42 Teams").
- Als Läufer*in möchte ich mit einem Klick zur öffentlichen Rangliste gelangen, damit ich mehr Details zu anderen Teams sehen kann.
- Als Admin möchte ich die gleiche Information wie die Läufer*innen sehen, damit ich den Teamfortschritt verfolgen kann.

## Acceptance Criteria
- [ ] Auf der Läufe-Seite wird rechts neben den "Gesamtkilometer BettercallPaul"-Karten ein neues Kästchen "Team-Position" angezeigt
- [ ] Das Kästchen zeigt die aktuelle Rangposition (z.B. "Platz 5")
- [ ] Das Kästchen zeigt die Gesamtzahl der Teams (z.B. "von 42 Teams")
- [ ] Das Kästchen enthält einen Link "Zur kompletten Rangliste", der zur externen Seite https://www.stuttgarter-kinderstiftung.de/unsere-arbeit/24-tage-lauf-fuer-kinderrechte/alle-teams führt
- [ ] Die Position wird bei jedem Seitenaufruf live aktualisiert (kein Caching)
- [ ] Bei Scraping-Fehlern wird "Position nicht verfügbar" angezeigt statt eines Fehler-Crash
- [ ] Das Kästchen ist für alle eingeloggten Nutzer*innen (Läufer*innen und Admin) sichtbar
- [ ] Der Team-Name "BettercallPaul" wird via Env-Variable `TEAM_NAME` konfiguriert (nicht hardcoded)
- [ ] Das Design folgt dem BettercallXPaul CI (Montserrat, Schwarz/Weiß/Grün, Dark Mode kompatibel)

## Edge Cases
- **Was passiert, wenn die externe Website nicht erreichbar ist?**  
  → Fehlertext "Position nicht verfügbar" anzeigen, kein Crash der Seite
  
- **Was passiert, wenn der Team-Name nicht auf der Website gefunden wird?**  
  → Fehlertext "Team nicht in der Rangliste gefunden" anzeigen
  
- **Was passiert, wenn die HTML-Struktur der Website sich ändert?**  
  → Scraping schlägt fehl, Fehlertext wird angezeigt. Log-Eintrag im Server-Log für Debugging.
  
- **Was passiert, wenn mehrere Teams ähnliche Namen haben?**  
  → Case-sensitive Match auf den exakten TEAM_NAME-String. Bei Mehrdeutigkeit: Fehlertext.
  
- **Soll die Position gecacht werden?**  
  → Nein, Live-Abruf bei jedem Seitenaufruf. Keine Datenbank-Speicherung nötig.
  
- **Was passiert bei langsamen API-Antworten (> 5s)?**  
  → Timeout nach 5 Sekunden, Fehlertext anzeigen. Keine blockierende Wartezeit für den Rest der Seite.

## Technical Requirements
- **Performance:** Scraping-Request darf die Seite nicht blockieren — async laden oder SSR mit Fallback
- **Security:** Keine Authentifizierung an der externen Website nötig (öffentliche Seite)
- **Timeout:** 5 Sekunden für HTTP-Request zur externen Website
- **Scraping:** HTML-Parsing via cheerio oder ähnlicher Library
- **Error Handling:** Keine Fehler-Bubbling zur UI — alle Fehler werden als "Position nicht verfügbar" angezeigt
- **Env-Variable:** `TEAM_NAME` in Vercel Settings (Dev + Production), z.B. `TEAM_NAME=BettercallPaul`
- **Logging:** Bei Scraping-Fehlern Server-seitigen Log-Eintrag schreiben (für Debugging bei HTML-Struktur-Änderungen)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Übersicht
Das Feature fügt ein viertes Kästchen zur bestehenden 3-Karten-Statistik-Anzeige hinzu. Die Team-Position wird durch Scraping der öffentlichen Website der Stuttgarter Kinderstiftung ermittelt.

### Komponenten-Struktur

```
Läufe-Seite (runs/page.tsx)
│
├── StatsCard (3 Karten: Gesamtdistanz, Lauftage, Team-Gesamt)
│   └── ERWEITERT zu: grid-cols-2 xl:grid-cols-4 (statt xl:grid-cols-3)
│
└── NEU: TeamRankingCard (4. Karte)
    ├── Icon (Trophy/Award)
    ├── Titel "Team-Position"
    ├── Rang-Anzeige "Platz X von Y Teams"
    ├── Link-Button "Zur kompletten Rangliste" (externer Link)
    └── Fehlerfall: "Position nicht verfügbar"
```

### Datenfluss

```
1. Läufe-Seite lädt → ruft /api/team/ranking auf (parallel zu /api/team/stats)
   ↓
2. API /api/team/ranking scrapet https://stuttgarter-kinderstiftung.de/.../alle-teams
   ↓
3. HTML-Parsing (jsdom) sucht nach Team-Namen aus Env-Variable TEAM_NAME
   ↓
4. Extrahiert: Position in der Liste, Gesamtzahl der Teams
   ↓
5. Rückgabe als JSON: { rank: 5, totalTeams: 42 } oder { error: "..." }
   ↓
6. UI zeigt Daten oder Fehlertext an
```

### Datenmodell

**API-Response (`/api/team/ranking`):**
```
Bei Erfolg:
{
  rank: 5,           // Position des Teams (1-basiert)
  totalTeams: 42     // Gesamtzahl teilnehmender Teams
}

Bei Fehler:
{
  error: "Position nicht verfügbar"
}
```

**Keine Datenbank-Speicherung** — Position wird bei jedem Request live gescraped.

### Tech-Entscheidungen

#### 1. Warum Web-Scraping statt API-Integration?
Die Stuttgarter Kinderstiftung bietet keine öffentliche API. Web-Scraping der öffentlichen Rangliste ist die einzige Möglichkeit, die Team-Position automatisch zu ermitteln.

**Risiko:** HTML-Struktur-Änderungen können das Scraping brechen.  
**Mitigation:** Fehlertoleranz — bei Scraping-Fehlern wird "Position nicht verfügbar" angezeigt statt App-Crash. Server-seitiges Logging hilft bei Debugging.

#### 2. Warum kein Caching?
User-Anforderung: Live-Anzeige bei jedem Seitenaufruf. Die Position ändert sich während des Events häufig (mehrmals täglich), daher ist ein kurzer Cache (5 Min) zwar möglich, aber nicht gewünscht.

**Performance-Impact:** Scraping dauert ca. 1-2 Sekunden. Die Seite lädt die Daten asynchron, sodass der Rest der UI nicht blockiert wird.

#### 3. Warum Client-seitige Abfrage (nicht SSR)?
Die Läufe-Seite ist bereits eine Client-Komponente (`'use client'`), die Daten per `fetch()` lädt. Das neue Feature folgt dem gleichen Muster für Konsistenz.

**Alternative SSR** würde bedeuten: Jeder Page-Load wartet auf Scraping-Completion (langsamer). Aktuelles Design: Seite lädt sofort, Ranking erscheint nach 1-2s.

#### 4. Warum jsdom statt cheerio?
`jsdom` ist bereits im Projekt installiert (für Tests). Keine zusätzliche Dependency nötig.

#### 5. Warum env-Variable `TEAM_NAME`?
Flexibilität für zukünftige Events: Team-Name kann sich ändern oder es gibt mehrere Instanzen der App für verschiedene Teams. Konfiguration via Vercel Env Variables ohne Code-Änderung.

### Neue API-Endpunkte

**`GET /api/team/ranking`**
- **Zweck:** Scraping der öffentlichen Rangliste, Ermittlung der Team-Position
- **Authentifizierung:** Ja — nur eingeloggte Nutzer*innen (wie `/api/team/stats`)
- **Rate Limit:** 30 Requests / 60 Sekunden pro IP (gleich wie `/api/team/stats`)
- **Timeout:** 5 Sekunden für HTTP-Request zur externen Website
- **Env-Variable:** `TEAM_NAME` (z.B. `BettercallPaul`)
- **Response:** `{ rank: number, totalTeams: number }` oder `{ error: string }`

**Scraping-Logik:**
1. HTTP GET auf `https://www.stuttgarter-kinderstiftung.de/unsere-arbeit/24-tage-lauf-fuer-kinderrechte/alle-teams`
2. HTML parsen mit jsdom
3. Suche nach Team-Namen (case-sensitive Match auf `TEAM_NAME`)
4. Zähle Position in der Liste (1-basiert)
5. Zähle Gesamtzahl aller Teams

**Fehlerbehandlung:**
- HTTP-Fehler (Timeout, 404, 500) → `{ error: "Position nicht verfügbar" }`
- HTML-Struktur ändert sich → `{ error: "Position nicht verfügbar" }`
- Team nicht gefunden → `{ error: "Team nicht in der Rangliste gefunden" }`
- Alle Fehler werden server-seitig geloggt für Debugging

### UI-Änderungen

**StatsCard Komponente:**
- Grid-Layout von `xl:grid-cols-3` auf `xl:grid-cols-4` erweitern
- Responsive: Mobile 1 Spalte, Tablet 2 Spalten, Desktop 4 Spalten
- Neue Prop: `teamRanking?: { rank: number, totalTeams: number } | null`
- Neue Prop: `teamRankingLoading?: boolean`
- Neue Prop: `teamRankingError?: boolean`

**Neue Karte in StatsCard:**
- Icon: Trophy/Award (lucide-react)
- Titel: "Team-Position"
- Inhalt bei Erfolg: "Platz 5 von 42 Teams"
- Inhalt bei Fehler: "Position nicht verfügbar"
- Link-Button: "Zur kompletten Rangliste" → öffnet externe Website in neuem Tab
- Loading State: Skeleton (wie bei Team-Gesamt)

**Design:**
- Folgt BettercallXPaul CI (Montserrat, Schwarz/Weiß/Grün)
- Dark Mode kompatibel (grüne Akzente)
- Icon-Hintergrund: `bg-primary/10` (gleich wie andere Karten)
- Link-Button: Grüner Text, unterstrichener Hover-Effekt

### Dependencies

**Keine neuen Packages nötig:**
- `jsdom` — bereits installiert (HTML-Parsing)
- `lucide-react` — bereits installiert (Trophy-Icon)
- shadcn/ui Komponenten — bereits installiert (Card, Button, Skeleton)

### Env-Variablen

**Neu:**
```
TEAM_NAME=BettercallPaul
```

**Muss konfiguriert werden in:**
- `.env.local` (lokale Entwicklung)
- Vercel Settings → Environment Variables (Dev + Production)

### Sicherheit & Performance

**Rate Limiting:**
- 30 Requests / 60 Sekunden pro IP (gleich wie `/api/team/stats`)
- Verhindert Missbrauch des Scraping-Endpunkts

**Timeout:**
- HTTP-Request zur externen Website bricht nach 5 Sekunden ab
- Verhindert lange Wartezeiten bei langsamer/unzuverlässiger Website

**Fehlertoleranz:**
- Keine Fehler-Bubbling zur UI — alle Fehler werden als "Position nicht verfügbar" angezeigt
- App bleibt funktionsfähig, auch wenn Scraping fehlschlägt

**Logging:**
- Bei Scraping-Fehlern: Server-seitiger Log-Eintrag (für Debugging bei HTML-Struktur-Änderungen)
- Keine Logs bei normalen Anfragen (Performance)

### Alternativen, die verworfen wurden

**Alternative 1: Position manuell im Admin-Bereich eintragen**
- ❌ Erfordert manuelle Pflege durch Admin
- ❌ Position veraltet schnell während des Events
- ✅ Scraping ist automatisch und immer aktuell

**Alternative 2: Position 1x täglich via Cron-Job scrapen und in DB speichern**
- ❌ Komplexer (Cron-Job, DB-Tabelle, Migration)
- ❌ Position veraltet zwischen Updates
- ✅ Live-Scraping ist einfacher und aktueller

**Alternative 3: Position im Browser scrapen (Client-seitig)**
- ❌ CORS-Problem — Browser blockiert Cross-Origin-Requests
- ❌ Exponiert Scraping-Logik im Client (leichter zu brechen bei Bot-Detection)
- ✅ Server-seitiges Scraping funktioniert ohne CORS-Problem

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
