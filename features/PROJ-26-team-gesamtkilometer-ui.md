# PROJ-26: Team-Gesamtkilometer in UI anzeigen

## Status: Planned
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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
