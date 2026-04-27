# PROJ-28: Team-Rangposition anzeigen

## Status: In Review
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
- [x] Auf der Läufe-Seite wird rechts neben den "Team BettercallPaul"-Karten ein neues Kästchen "Team-Position" angezeigt
- [x] Das Kästchen zeigt die aktuelle Rangposition (z.B. "Platz 15")
- [x] Die Position wird bei jedem Seitenaufruf live aktualisiert (kein Caching)
- [x] Bei Scraping-Fehlern wird "nicht verfügbar" angezeigt statt eines Fehler-Crash
- [x] Das Kästchen ist für alle eingeloggten Nutzer*innen (Läufer*innen und Admin) sichtbar
- [x] Der Team-Name "BettercallPaul" wird via Env-Variable `TEAM_NAME` konfiguriert (nicht hardcoded)
- [x] Das Design folgt dem BettercallXPaul CI (Montserrat, Schwarz/Weiß/Grün, Dark Mode kompatibel)
- [x] Team-Position wird auch auf der Rangliste-Seite angezeigt

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

**Tested:** 2026-04-27 (re-validated)
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: Neues Kaestchen "Team-Position" auf der Laeufe-Seite -- PASS
- [x] Kaestchen wird im StatsCard-Grid angezeigt (4. Karte rechts neben Team-Gesamt)
- [x] Grid-Layout: `grid-cols-1 md:grid-cols-2 xl:grid-cols-4`

#### AC-2: Rangposition wird angezeigt (z.B. "Platz 5") -- PASS
- [x] Anzeige "Platz X" bei Erfolg (fett, text-2xl)

#### AC-3: Gesamtzahl der Teams (z.B. "von 42 Teams") -- FAIL
- [ ] BUG-4: "von Y Teams" wird in der UI NICHT angezeigt. Die Komponente rendert nur "Platz X" ohne die Gesamtzahl. Obwohl die API `totalTeams` liefert und die Prop vorhanden ist, fehlt die Ausgabe "von Y Teams" im JSX komplett.

#### AC-4: Link "Zur kompletten Rangliste" -- FAIL
- [ ] BUG-5: Kein Link zur externen Rangliste im Team-Position-Kaestchen vorhanden. Die gesamte Link-Funktionalitaet fehlt in der `StatsCard`-Komponente. Weder "Zur kompletten Rangliste" noch "Zur Rangliste" existiert.

#### AC-5: Position wird bei jedem Seitenaufruf live aktualisiert -- PASS
- [x] Kein Caching -- API wird bei jedem goto('/runs') erneut aufgerufen

#### AC-6: Bei Scraping-Fehlern "Position nicht verfuegbar" anzeigen -- FAIL
- [ ] BUG-6: Bei Fehler zeigt die UI nur "nicht verfuegbar" (Zeile 100 in stats-card.tsx), nicht "Position nicht verfuegbar" wie im Akzeptanzkriterium gefordert. Das Wort "Position" fehlt.
- [x] Kein Crash der restlichen Seite (andere Stats bleiben sichtbar)

#### AC-7: Sichtbar fuer alle eingeloggten Nutzer*innen -- PASS
- [x] Authentifizierte Nutzer*innen sehen das Kaestchen
- [x] API ist nicht ohne Auth erreichbar (Middleware-Redirect zu /login)
- [x] API-Route prueft zusaetzlich Supabase-Session (defense-in-depth)

#### AC-8: Team-Name via Env-Variable TEAM_NAME -- PASS
- [x] process.env.TEAM_NAME wird server-seitig gelesen (nicht hardcoded)
- [x] TEAM_NAME in .env.local.example dokumentiert
- [x] Bei fehlender TEAM_NAME: Fehler 500 mit "TEAM_NAME nicht konfiguriert"

#### AC-9: Design folgt BettercallXPaul CI -- PASS
- [x] Trophy-Icon (lucide-react) vorhanden
- [x] Icon-Hintergrund: bg-primary/10 (konsistent mit anderen Karten)
- [x] Dark Mode kompatibel (text-muted-foreground fuer Labels)
- [x] Montserrat-Schrift (wird vom globalen Theme vererbt)

### Edge Cases Status

#### EC-1: Externe Website nicht erreichbar -- PARTIAL PASS
- [x] Fehlertext wird angezeigt, kein Crash
- [ ] Fehlertext sagt "nicht verfuegbar" statt "Position nicht verfuegbar" (s. BUG-6)

#### EC-2: Team-Name nicht auf Website gefunden -- PARTIAL PASS
- [x] API gibt 404 mit "Team nicht in der Rangliste gefunden" zurueck
- [ ] UI zeigt nur "nicht verfuegbar" (generisch, aber unvollstaendig, s. BUG-6)

#### EC-3: HTML-Struktur der Website aendert sich -- PASS
- [x] Bei leerer Team-Liste: 503 mit "Position nicht verfuegbar"
- [x] Server-seitiger Log-Eintrag bei Scraping-Fehlern

#### EC-4: Case-sensitive Match -- PASS
- [x] "bettercallpaul" wird NICHT als "BettercallPaul" erkannt (case-sensitive, unit-getestet)

#### EC-5: Langsame API-Antwort (> 5s) -- PASS
- [x] AbortController mit 5-Sekunden-Timeout implementiert
- [x] Skeleton-Placeholder waehrend des Ladens

### Security Audit Results

- [x] Authentication: API-Endpunkt prueft Supabase-Session, Middleware schuetzt Route (nicht in PUBLIC_ROUTES)
- [x] Authorization: Alle eingeloggten Nutzer*innen duerfen Ranking sehen (kein Datenunterschied zwischen Nutzern)
- [x] Input Validation: Kein User-Input an den Endpunkt (GET ohne Parameter)
- [x] Rate Limiting: 30 Requests / 60 Sekunden pro IP (rate-limit key: "team-ranking:<ip>")
- [x] Exposed Secrets: TEAM_NAME ist kein Secret, aber wird korrekt nur server-seitig verwendet
- [x] SSRF: Die gescrapte URL ist hardcoded (RANKING_URL Konstante), nicht vom Client steuerbar
- [x] XSS: Externe HTML wird nur server-seitig geparst (cheerio), nie als Raw-HTML an den Client gesendet
- [x] External Link: N/A -- Link fehlt komplett (BUG-5), muss bei Implementierung rel="noopener noreferrer" haben
- [x] Error Information Leakage: Fehlermeldungen sind generisch, keine Stack-Traces oder interne Details an den Client

### Bugs Found

#### BUG-1: Tech Design sagt jsdom, Implementierung verwendet cheerio
- **Severity:** Low
- **Steps to Reproduce:**
  1. Lese Tech Design: "HTML-Parsing (jsdom)"
  2. Lese route.ts: `import * as cheerio from 'cheerio'`
  3. Expected: Uebereinstimmung zwischen Design und Implementierung
  4. Actual: Diskrepanz -- cheerio wird verwendet statt jsdom
- **Note:** Cheerio ist fuer diesen Use Case sogar besser geeignet (leichtgewichtiger als jsdom). Kein funktionaler Bug, nur Dokumentations-Diskrepanz.
- **Priority:** Nice to have

#### BUG-2: PROJ-26 Regression -- Label geaendert von "Team-Gesamt BettercallPaul" zu "Team BettercallPaul"
- **Severity:** High
- **Steps to Reproduce:**
  1. Lese `src/components/stats-card.tsx` Zeile 78: Label ist "Team BettercallPaul"
  2. Lese PROJ-26 Spec AC-1: Label soll "Team-Gesamt BettercallPaul" sein
  3. Fuehre `npx playwright test tests/team-stats.spec.ts` aus
  4. Alle Tests die nach "Team-Gesamt BettercallPaul" suchen schlagen fehl (12 von 22 Tests)
  5. Expected: Label bleibt "Team-Gesamt BettercallPaul" (PROJ-26 Spec)
  6. Actual: Label ist "Team BettercallPaul"
- **Root Cause:** Commit `0aef07f` hat das Label absichtlich vereinheitlicht. Die Aenderung war intentional, aber die PROJ-26 Tests und Spec wurden nicht aktualisiert.
- **Affected File:** `src/components/stats-card.tsx` Zeile 78, `tests/team-stats.spec.ts`
- **Priority:** Fix before deployment -- Tests und PROJ-26 Spec muessen an die neue Label-Konvention angepasst werden

#### BUG-3: PROJ-26 E2E-Tests gebrochen durch Grid-Aenderung und fehlenden Mock
- **Severity:** High
- **Steps to Reproduce:**
  1. Fuehre `npx playwright test tests/team-stats.spec.ts` aus
  2. AC-2 Test sucht nach `.xl\:grid-cols-3` (alt) -- jetzt `.xl\:grid-cols-4`
  3. `mockAllApis()` in team-stats.spec.ts mockt `/api/team/ranking` nicht -- Seite haengt beim Laden
  4. Expected: Alle PROJ-26 Tests bestehen weiterhin
  5. Actual: 12 von 22 Tests schlagen fehl
- **Root Cause:** Grid wurde von 3 auf 4 Spalten erweitert und neuer API-Endpunkt wurde eingefuehrt, aber PROJ-26 Tests nicht aktualisiert.
- **Affected File:** `tests/team-stats.spec.ts`
- **Priority:** Fix before deployment

#### BUG-4: "von Y Teams" fehlt in der UI (AC-3 nicht implementiert)
- **Severity:** High (Spec-Implementierung-Diskrepanz)
- **Steps to Reproduce:**
  1. Gehe zu /runs (eingeloggt)
  2. Schaue das Team-Position-Kaestchen an
  3. Expected (laut Spec AC-3): Anzeige "Platz 5 von 42 Teams" (oder "Platz 5" + "von 42 Teams")
  4. Actual: Nur "Platz 5" wird angezeigt, "von 42 Teams" fehlt komplett
- **Root Cause:** Commit `24d8293` hat "von X Teams" absichtlich entfernt ("Team-Position vereinfachen"). Die `totalTeams`-Property wird per API geliefert, aber im JSX nicht ausgegeben.
- **Affected File:** `src/components/stats-card.tsx` Zeile 102
- **Decision needed:** Entweder AC-3 im Spec streichen (wenn Vereinfachung gewuenscht) oder "von Y Teams" wieder einbauen. E2E-Tests muessen an die Entscheidung angepasst werden.

#### BUG-5: Link "Zur kompletten Rangliste" fehlt komplett (AC-4 nicht implementiert)
- **Severity:** High (Spec-Implementierung-Diskrepanz)
- **Steps to Reproduce:**
  1. Gehe zu /runs (eingeloggt)
  2. Schaue das Team-Position-Kaestchen an
  3. Expected (laut Spec AC-4): Ein klickbarer Link "Zur kompletten Rangliste" der zu https://www.stuttgarter-kinderstiftung.de/unsere-arbeit/24-tage-lauf-fuer-kinderrechte/alle-teams fuehrt (target="_blank", rel="noopener noreferrer")
  4. Actual: Kein Link vorhanden. Die gesamte Link-Funktionalitaet fehlt im `StatsCard`-Komponente.
- **Root Cause:** Commit `24d8293` hat den Link absichtlich entfernt ("Team-Position vereinfachen"). Die StatsCard-Komponente hat kein `<a>`-Element fuer die externe Rangliste.
- **Affected File:** `src/components/stats-card.tsx` Zeilen 90-106
- **Decision needed:** Entweder AC-4 im Spec streichen (wenn Vereinfachung gewuenscht) oder den Link wieder einbauen. E2E-Tests muessen an die Entscheidung angepasst werden.

#### BUG-6: Fehlertext "nicht verfuegbar" statt "Position nicht verfuegbar" (AC-6 unvollstaendig)
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Simuliere einen API-Fehler fuer `/api/team/ranking` (z.B. 503)
  2. Gehe zu /runs (eingeloggt)
  3. Expected: Text "Position nicht verfuegbar" im Team-Position-Kaestchen
  4. Actual: Text "nicht verfuegbar" (ohne "Position")
- **Root Cause:** `src/components/stats-card.tsx` Zeile 100: `<p>nicht verfuegbar</p>` statt `<p>Position nicht verfuegbar</p>`
- **Affected File:** `src/components/stats-card.tsx` Zeile 100
- **Priority:** Fix before deployment

#### BUG-7: PROJ-28 E2E Tests schlagen fehl (16 von 34 Tests)
- **Severity:** High
- **Steps to Reproduce:**
  1. Fuehre `npx playwright test tests/team-ranking.spec.ts` aus
  2. Expected: Alle Tests bestehen
  3. Actual: 16 von 34 Tests schlagen fehl
- **Root Cause:** Die Tests pruefen AC-3, AC-4, AC-6 korrekt, aber die Implementierung erfuellt diese Kriterien nicht. Die Tests sind korrekt geschrieben -- die Implementierung ist unvollstaendig.
- **Failing Tests (pro Browser, jeweils Chromium + Mobile Safari):**
  - AC-3: "von 42 Teams" nicht sichtbar (BUG-4)
  - AC-4: Kein Link zur externen Rangliste (BUG-5)
  - AC-6: "Position nicht verfuegbar" nicht exakt (BUG-6)
  - EC-1: Fehlertext-Mismatch (BUG-6)
  - EC-2: Fehlertext-Mismatch (BUG-6)
  - Ranglisten-Link rel-Check: Kein Link vorhanden (BUG-5)
  - "Zeigt Platz 1 korrekt an": Prueft "von 10 Teams" (BUG-4)
  - "Zeigt letzten Platz korrekt an": Prueft "von 100 Teams" (BUG-4)
- **Priority:** Wird automatisch geloest wenn BUG-4, BUG-5, BUG-6 gefixt werden

### Test Files

- **E2E Tests:** `tests/team-ranking.spec.ts` -- 17 Tests x 2 Browser = 34 Testlaeufe (18 bestehen, 16 schlagen fehl)
- **Unit Tests:** `src/app/api/team/ranking/route.test.ts` -- 16 Tests (alle bestehen)

### Summary
- **Acceptance Criteria:** 5/9 passed (AC-3, AC-4, AC-6 FAIL, plus Regression auf PROJ-26)
- **Bugs Found:** 7 total (0 critical, 4 high, 1 medium, 2 low)
- **Security:** PASS -- keine Sicherheitsprobleme gefunden. API korrekt geschuetzt, kein SSRF, kein XSS, Rate Limiting aktiv.
- **Unit Tests:** 226/226 PASS (alle Projekte)
- **E2E Tests PROJ-28:** 18/34 PASS, 16/34 FAIL
- **E2E Tests PROJ-26 (Regression):** 10/22 PASS, 12/22 FAIL
- **Production Ready:** NO
- **Blocking Issues (must fix):**
  - BUG-2: PROJ-26 Label-Regression -- "Team BettercallPaul" muss zurueck zu "Team-Gesamt BettercallPaul"
  - BUG-3: PROJ-26 Tests muessen aktualisiert werden (Grid-Cols, fehlender Ranking-Mock)
  - BUG-4: "von Y Teams" muss in die StatsCard-Komponente eingefuegt werden
  - BUG-5: Link "Zur kompletten Rangliste" muss implementiert werden (target="_blank", rel="noopener noreferrer")
  - BUG-6: Fehlertext muss "Position nicht verfuegbar" lauten (nicht nur "nicht verfuegbar")

## Deployment
_To be added by /deploy_
