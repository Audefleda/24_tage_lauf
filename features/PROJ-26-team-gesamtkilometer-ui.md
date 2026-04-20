# PROJ-26: Team-Gesamtkilometer in UI anzeigen

## Status: In Progress
**Created:** 2026-04-20
**Last Updated:** 2026-04-20

## Dependencies
- Requires: PROJ-3 (Läufe-Übersicht) — StatsCard-Komponente wird erweitert
- Requires: PROJ-24 (Firmen-Erstattungs-Cap) — Berechnungslogik für 100km-Cap pro Läufer*in muss wiederverwendet werden

## User Stories
- Als Läufer*in möchte ich auf meiner Läufe-Seite die Team-Gesamtkilometer sehen, damit ich weiß, wie viel das gesamte Team BettercallPaul bisher gelaufen ist.
- Als Läufer*in möchte ich die erstattungsfähige Summe sehen (mit 100km-Cap pro Läufer*in), damit ich verstehe, wie viel die Firma erstattet.
- Als Läufer*in möchte ich motiviert werden durch die Sichtbarkeit des Team-Fortschritts, damit ich mich als Teil eines gemeinsamen Ziels fühle.
- Als Admin möchte ich, dass alle Läufer*innen die gleiche Team-Summe sehen, damit Transparenz und Team-Geist gefördert werden.

## Acceptance Criteria
- [ ] **AC-1:** Auf der `/runs`-Seite wird eine neue StatsCard "Team-Gesamt BettercallPaul" angezeigt
- [ ] **AC-2:** Die Karte wird neben den bestehenden Stats ("Gesamtdistanz", "Lauftage") platziert — alle drei Karten in einer Zeile
- [ ] **AC-3:** Die angezeigte Summe berücksichtigt die 100km-Kappung pro Läufer*in (wie in PROJ-24 definiert)
- [ ] **AC-4:** Die Berechnung erfolgt serverseitig (API-Endpoint) — niemals im Browser
- [ ] **AC-5:** Alle eingeloggten Läufer*innen sehen die gleiche Team-Summe (unabhängig vom eigenen Runner-Status)
- [ ] **AC-6:** Die Karte zeigt nur die Summe — keine Liste von Läufer*innen, keine Angabe wer gekappt wurde
- [ ] **AC-7:** Beim Laden der Seite wird die Team-Summe parallel zu den persönlichen Stats geladen
- [ ] **AC-8:** Während des Ladens wird ein Skeleton-Placeholder angezeigt (wie bei den anderen Stats)
- [ ] **AC-9:** Bei Fehler (API nicht erreichbar) zeigt die Karte "--" statt einer Zahl
- [ ] **AC-10:** Die Team-Summe wird im gleichen Format dargestellt wie die persönliche Gesamtdistanz: "XXX,XX km"

## Edge Cases
- Was passiert wenn die TYPO3-API nicht erreichbar ist? → Karte zeigt "--" (konsistent mit anderen Stats)
- Was passiert wenn kein Läufer Kilometer hat (alle bei 0km)? → Karte zeigt "0,00 km"
- Was passiert wenn alle Läufer unter 100km bleiben? → Team-Summe ist identisch zur ungekappten Summe
- Was passiert wenn ein*e Läufer*in exakt 100km hat? → Wird mit 100,00 km gezählt (keine Abrundung)
- Was passiert auf schmalen Bildschirmen (Mobile)? → Karten stapeln sich vertikal (wie bereits in PROJ-3 implementiert via responsive Tailwind-Klassen)

## Technical Requirements
- **API-Endpoint:** Neuer GET-Endpoint `/api/team/stats` (oder ähnlich) liefert `{ totalKm: number }` (bereits gekappte Summe)
- **Berechnungslogik:** Wiederverwendung der Logik aus PROJ-24 (`Math.min(runner.totaldistance, 100)` pro Läufer)
- **Datenquelle:** TYPO3-API (`runnerget.json`) — lädt alle Läufer*innen und deren `totaldistance`
- **Authentifizierung:** Endpoint erfordert gültigen Supabase Auth Token (wie alle anderen Runner-APIs)
- **Caching:** Keine — Daten werden bei jedem Seitenaufruf frisch geladen (konsistent mit PROJ-3)
- **Performance:** API-Antwort < 2 Sekunden (abhängig von TYPO3-Antwortzeit)
- **Komponente:** Neue StatsCard in `src/app/runs/page.tsx` neben bestehenden Stats

## Scope Abgrenzung
**Was wird gebaut:**
- Neue StatsCard "Team-Gesamt BettercallPaul" auf `/runs`-Seite
- Neuer API-Endpoint für serverseitige Berechnung der gekappten Team-Summe
- Integration in bestehende Stats-Darstellung (responsive Grid-Layout)

**Was wird NICHT gebaut:**
- Keine Detail-Ansicht mit individuellen Läufer*innen-Kilometern
- Keine Markierung/Hervorhebung von gekappten Läufer*innen
- Keine Unterscheidung zwischen gekappter und ungekappter Summe
- Keine separate Admin-Ansicht (alle sehen die gleiche Zahl)
- Keine historische Verlaufs-Darstellung (nur aktueller Stand)

## UI-Darstellung

### Desktop (3 Karten nebeneinander)
```
┌─────────────────────────────────────────────────────────┐
│  Gesamtdistanz     Lauftage     Team-Gesamt BettercallPaul │
│  125,50 km         18           332,00 km                │
└─────────────────────────────────────────────────────────┘
```

### Mobile (Karten gestapelt)
```
┌────────────────────┐
│  Gesamtdistanz     │
│  125,50 km         │
└────────────────────┘
┌────────────────────┐
│  Lauftage          │
│  18                │
└────────────────────┘
┌────────────────────┐
│  Team-Gesamt       │
│  BettercallPaul    │
│  332,00 km         │
└────────────────────┘
```

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick

Dieses Feature erweitert die `/runs`-Seite um eine dritte Statistik-Karte, die **Team-Gesamtkilometer** anzeigt. Die Berechnung erfolgt serverseitig und berücksichtigt die 100km-Kappung pro Läufer*in (wie in PROJ-24 definiert).

**Warum diese Änderung?**
- Motivation durch Team-Transparenz — Läufer*innen sehen nicht nur ihre eigenen, sondern auch die Team-Leistung
- Erstattungs-Übersicht — die angezeigte Summe entspricht dem, was die Firma tatsächlich erstattet
- Kein Admin-exklusiver Bereich — alle Läufer*innen sehen die gleiche Team-Summe

### Komponenten-Struktur

```
/runs (Läufe-Übersicht-Seite)
├── PageHeader (bestehendes Element)
├── Stats-Bereich (erweiterter Bereich)
│   ├── StatsCard "Gesamtdistanz" (persönlich, bereits vorhanden)
│   ├── StatsCard "Lauftage" (persönlich, bereits vorhanden)
│   └── StatsCard "Team-Gesamt BettercallPaul" (NEU)
│       └── Inhalt: "332,00 km" (mit Skeleton-Loader während API-Aufruf)
├── RunsTable (bestehendes Element)
└── Strava/Webhook-Bereiche (bestehende Elemente)
```

**Änderungen an bestehenden Komponenten:**
- `src/app/runs/page.tsx`: Neue State-Variable für Team-Stats, neuer API-Aufruf, neue StatsCard
- `src/components/stats-card.tsx`: KEINE Änderung nötig — wird wiederverwendet wie bisher

### Datenmodell

**Neue API-Response:**
```
GET /api/team/stats

Response:
{
  totalKm: 332.00  (Zahl mit 2 Dezimalstellen)
}
```

**Datenquelle:**
- Alle Läufer*innen werden von TYPO3 geladen (wie bereits in PROJ-19 für Teams-Notifications)
- Pro Läufer*in: `totaldistance`-Feld (Summe aller Läufe)
- Berechnung: `sum(min(läufer.totaldistance, 100) for alle läufer)`

**Wo die Daten herkommen:**
- TYPO3-API (`runnerget.json`) liefert alle Läufer*innen mit `totaldistance`-Feld
- Kein neues Datenbank-Feld in Supabase nötig
- Keine Caching-Logik — frische Berechnung bei jedem Seitenaufruf

### Backend-Architektur

**Neuer API-Endpoint:**
- Pfad: `/api/team/stats`
- Methode: `GET`
- Authentifizierung: Supabase Auth Token erforderlich (wie alle Runner-Endpoints)
- Zugriff: Alle eingeloggten Läufer*innen (nicht Admin-exklusiv)

**Ablauf im Endpoint:**
1. Supabase Auth Session prüfen → 401 wenn nicht eingeloggt
2. TYPO3 Superuser-Authentifizierung durchführen
3. Alle Läufer*innen von TYPO3 laden (`runnerget.json`)
4. Pro Läufer: `totaldistance` auf maximal 100km begrenzen
5. Summe aller gekappten Werte berechnen
6. Rückgabe als JSON: `{ totalKm: 332.00 }`

**Fehlerbehandlung:**
- TYPO3 nicht erreichbar → HTTP 503 + Fehlermeldung
- Authentifizierung fehlgeschlagen → HTTP 401
- Parsing-Fehler → HTTP 500 + Log-Eintrag

### Frontend-Architektur

**Änderungen in `/runs/page.tsx`:**

**Neuer State:**
- `teamTotalKm: number | null` (null = noch nicht geladen)
- `teamStatsLoading: boolean` (true während API-Aufruf)
- `teamStatsError: string | null` (Fehlermeldung falls API fehlschlägt)

**Neuer API-Aufruf:**
- Parallel zum bestehenden `/api/runner`-Aufruf
- Beim Laden der Seite (useEffect)
- Nach erfolgreicher Lauf-Änderung (Refresh nach Save)

**Neue StatsCard:**
- Titel: "Team-Gesamt BettercallPaul"
- Wert: `formatDistanceDE(teamTotalKm)` → "332,00 km"
- Ladezustand: Skeleton-Placeholder (wie bei anderen Stats)
- Fehlerfall: "--" statt Zahl (konsistent mit bestehenden Stats)

**Responsive Verhalten:**
- Desktop (xl): 3 Karten nebeneinander (`grid-cols-3`)
- Tablet (md): 2 Karten oben, 1 Karte unten (`grid-cols-2`)
- Mobile (<md): 3 Karten untereinander (`grid-cols-1`)

### Datenfluss

```
Browser (Läufer*in öffnet /runs)
        ↓
Seite lädt → 2 parallele API-Aufrufe:
   1. GET /api/runner (bestehend — persönliche Läufe)
   2. GET /api/team/stats (NEU — Team-Gesamtkilometer)
        ↓
/api/team/stats (Server):
   1. Auth-Check (Supabase Session)
   2. TYPO3-Login (Superuser)
   3. Alle Läufer laden (runnerget.json)
   4. Pro Läufer: min(totaldistance, 100)
   5. Summe berechnen
        ↓
Response: { totalKm: 332.00 }
        ↓
Browser: StatsCard zeigt "332,00 km"
```

### Wiederverwendung von PROJ-24

Die Berechnungslogik aus PROJ-24 wird **wiederverwendet**, nicht dupliziert:
- PROJ-24: Teams-Notifications verwenden gekappte Summe in `teams-notification.ts`
- PROJ-26: Neuer API-Endpoint verwendet **dieselbe Berechnungsformel**

**Option 1 (empfohlen):** Logik in beide Dateien inline schreiben (jeweils 2 Zeilen, keine Abstraktion nötig)
**Option 2:** Gemeinsame Hilfsfunktion `calculateCappedTeamTotal()` in `src/lib/team-utils.ts`

Für diese simple Berechnung ist Option 1 ausreichend — keine vorzeitige Abstraktion.

### Tech-Entscheidungen (Begründungen)

| Entscheidung | Begründung |
|--------------|------------|
| **Serverseitige Berechnung** | Sicherheit — Browser könnte andere Läufer*innen-Daten nicht sehen (RLS). Außerdem: TYPO3-Credentials bleiben server-only. |
| **Kein Caching** | Konsistenz mit PROJ-3 — Läufe-Seite lädt immer frische Daten. Event dauert nur 25 Tage, Traffic ist gering. |
| **Paralleler API-Aufruf** | Performance — Läufer*in muss nicht warten bis persönliche Stats geladen sind, bevor Team-Stats geladen werden. |
| **Keine Detail-Ansicht** | PROJ-24 AC-5: "Kappung bleibt unsichtbar". Kein Hinweis wer gekappt wurde, nur die Summe. |
| **Alle Läufer*innen sehen es** | Team-Motivation — nicht nur Admin. Transparenz fördert Team-Geist. |
| **StatsCard wiederverwenden** | Bestehende Komponente ist generisch genug. Kein Custom-Layout nötig. |

### Was bleibt unverändert

- Persönliche Stats ("Gesamtdistanz", "Lauftage") bleiben wie bisher
- StatsCard-Komponente braucht keine Änderungen
- TYPO3-API bleibt unverändert (kein neuer Endpoint nötig)
- Supabase-Schema bleibt unverändert (kein neues Feld)
- Teams-Notifications (PROJ-19) bleiben unverändert

### Neue Dependencies

**Keine neuen NPM-Packages nötig.**
Alle Tools bereits vorhanden:
- TYPO3-Client (aus PROJ-1)
- Supabase Auth (aus PROJ-2)
- formatDistanceDE() (aus PROJ-3)
- Skeleton-Komponente (aus shadcn/ui)

### Was wird NICHT gebaut

- Keine Admin-exklusive Ansicht (alle Läufer*innen sehen die gleiche Summe)
- Keine Unterscheidung zwischen gekappter und ungekappter Summe
- Kein Tooltip/Modal mit Läufer*innen-Details
- Keine Markierung von gekappten Läufer*innen
- Keine historische Verlaufs-Darstellung (z.B. "gestern waren es 300km")
- Keine manuelle Refresh-Button (Seite lädt automatisch beim Öffnen)

### Edge Cases (technische Perspektive)

| Szenario | Verhalten |
|----------|-----------|
| TYPO3-API nicht erreichbar | API gibt HTTP 503 zurück → StatsCard zeigt "--" |
| Alle Läufer haben 0km | API gibt `{ totalKm: 0.00 }` zurück → StatsCard zeigt "0,00 km" |
| Läufer*in hat exakt 100km | Wird mit 100,00 gezählt (keine Abrundung) |
| Läufer*in hat 125,3km | Wird mit 100,00 gezählt (Cap greift) |
| Läufer*in nicht eingeloggt | Middleware leitet zu `/login` weiter (wie bisher) |
| Paralleler API-Aufruf langsam | Skeleton-Placeholder bleibt sichtbar bis Response kommt |

### Deployment-Hinweise

- Keine Datenbank-Migration nötig
- Keine Umgebungsvariablen-Änderungen
- Keine Breaking Changes — reine Feature-Ergänzung
- Abwärtskompatibel: Falls API-Aufruf fehlschlägt, bleiben persönliche Stats sichtbar

### Performance-Überlegungen

- **API-Antwortzeit:** < 2 Sekunden (abhängig von TYPO3-Antwortzeit für `runnerget.json`)
- **Parallele Aufrufe:** Persönliche Stats + Team-Stats laden gleichzeitig (kein serieller Waterfall)
- **Netzwerk-Traffic:** Ein zusätzlicher API-Aufruf pro Seitenaufruf (vernachlässigbar für 5-30 Nutzer*innen)
- **TYPO3-Last:** Ein zusätzlicher `runnerget.json`-Aufruf pro Seitenaufruf (kein Problem für TYPO3-Backend)

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
