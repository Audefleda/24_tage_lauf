# PROJ-24: Firmen-Erstattungs-Cap (100km pro Läufer)

## Status: In Progress
**Created:** 2026-04-15
**Last Updated:** 2026-04-15

## Dependencies
- Requires: PROJ-19 (Teams-Benachrichtigung) — Team-Gesamtkilometer-Berechnung muss angepasst werden

## User Stories
- Als Arbeitgeber möchte ich maximal 100km pro Läufer*in erstatten, damit die Kosten im Rahmen bleiben.
- Als Läufer*in möchte ich weiterhin meine vollen gelaufenen Kilometer sehen (auch über 100km), damit ich meinen persönlichen Fortschritt verfolgen kann.
- Als Teammitglied möchte ich in der Teams-Benachrichtigung die firmen-relevante Gesamtsumme sehen (mit 100km-Cap pro Person), damit ich nachvollziehen kann, wie viel das Unternehmen erstattet.
- Als Admin möchte ich sowohl die vollen als auch die gekappten Gesamtkilometer einsehen können, damit ich die Erstattung korrekt abrechnen kann.

## Acceptance Criteria
- [ ] **AC-1:** In Teams-Benachrichtigungen (PROJ-19) wird die Team-Gesamtsumme mit 100km-Cap pro Läufer*in berechnet und angezeigt
- [ ] **AC-2:** Die individuelle Läufer*innen-Statistik "Kilometer gesamt {name}" in der Teams-Benachrichtigung zeigt die **volle** Kilometeranzahl (ungekappte Summe)
- [ ] **AC-3:** Auf der persönlichen Läufe-Übersicht (`/runs`) wird die volle Kilometeranzahl angezeigt (keine Kappung)
- [ ] **AC-4:** Im Admin-Bereich (`/admin`) wird bei jeder Läufer*in die volle Kilometeranzahl angezeigt
- [ ] **AC-5:** Die Kappung ist unsichtbar — es gibt keinen Hinweis in der Teams-Nachricht, dass ein Läufer gekappt wurde
- [ ] **AC-6:** Die Berechnungslogik für die Team-Summe ist: `sum(min(läufer.totaldistance, 100) for läufer in alle_läufer)`
- [ ] **AC-7:** Läufer*innen die unter 100km bleiben, werden mit ihrer vollen Distanz gezählt (z.B. 87,5 km bleibt 87,5 km)
- [ ] **AC-8:** Läufer*innen die über 100km kommen, werden mit exakt 100km gezählt (z.B. 125 km wird zu 100 km in der Team-Summe)

## Edge Cases
- Was passiert wenn alle Läufer*innen unter 100km bleiben? → Team-Summe ist identisch zur ungekappten Summe (normale Addition)
- Was passiert wenn ein*e Läufer*in exakt 100km läuft? → Wird mit 100km gezählt (keine Abrundung)
- Was passiert wenn ein*e Läufer*in 0km läuft? → Wird mit 0km gezählt (bleibt bei 0)
- Was passiert wenn die TYPO3-Daten nicht geladen werden können? → Fallback-Wert "--" wird angezeigt (wie bisher)
- Was passiert wenn ein*e Admin die vollen Kilometer sehen möchte? → Admin-Bereich zeigt immer die vollen Kilometer (keine Kappung)

## Technical Requirements
- **Keine UI-Änderungen nötig** — reine Backend-Logik-Anpassung
- Anpassung in `src/lib/teams-notification.ts`:
  - Neue Funktion `calculateCappedTeamTotal(runners)` die das 100km-Cap pro Läufer anwendet
  - Bestehende `teamTotalKm`-Berechnung wird durch gekappte Version ersetzt
- Die individuelle `runner.totaldistance` bleibt unverändert (wird weiterhin ungekappte angezeigt)
- Keine neuen Datenbank-Felder nötig
- Keine neuen API-Endpoints nötig
- Keine neuen Umgebungsvariablen nötig

## Scope Abgrenzung
**Betroffen (mit 100km-Cap):**
- Teams-Benachrichtigungen: "Kilometer gesamt BettercallPaul" (Team-Summe)

**NICHT betroffen (volle Kilometer):**
- Teams-Benachrichtigungen: "Kilometer gesamt {name}" (individuelle Läufer*innen-Statistik)
- Persönliche Läufe-Übersicht (`/runs`): StatsCard "Gesamtdistanz"
- Admin-Bereich (`/admin`): Benutzerverwaltung
- Läufer-Profil (falls vorhanden)
- Alle anderen Statistiken oder Berichte

## Beispiel-Rechnung

### Szenario 1: Niemand überschreitet 100km
| Läufer*in | Tatsächliche km | In Team-Summe gezählt |
|-----------|-----------------|----------------------|
| Alice | 45,5 | 45,5 |
| Bob | 87,0 | 87,0 |
| Carol | 23,2 | 23,2 |
| **Team-Summe** | **155,7 km** | **155,7 km** |

→ Keine Änderung zur bisherigen Berechnung

### Szenario 2: Einige überschreiten 100km
| Läufer*in | Tatsächliche km | In Team-Summe gezählt |
|-----------|-----------------|----------------------|
| Alice | 125,5 | **100,0** (gekappt) |
| Bob | 87,0 | 87,0 |
| Carol | 110,3 | **100,0** (gekappt) |
| Dave | 45,0 | 45,0 |
| **Team-Summe** | **367,8 km** | **332,0 km** |

→ Firma erstattet 332 km statt 367,8 km

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick

Dies ist eine **reine Backend-Änderung** ohne UI-Anpassungen. Es wird nur die Berechnungslogik für die Team-Gesamtkilometer in Teams-Benachrichtigungen angepasst.

**Warum diese Änderung?**
Die Firma erstattet pro Läufer*in maximal 100km. Läufer*innen die mehr laufen, sollen aber trotzdem ihre vollen Kilometer sehen können (Motivation!). Nur bei der Team-Gesamtsumme in den Teams-Nachrichten wird die Erstattungsgrenze berücksichtigt.

### Betroffene Datei

**`src/lib/teams-notification.ts`** (PROJ-19)
- Diese Datei ist zuständig für das Versenden von Teams-Benachrichtigungen nach jedem Lauf-Eintrag
- Lädt alle Läufer*innen-Daten von TYPO3
- Berechnet aktuell die Team-Summe durch einfache Addition aller Läufer-Kilometer
- **Änderung:** Vor der Summierung wird jeder Läufer auf maximal 100km begrenzt

### Berechnungslogik (konzeptionell)

**Bisher:**
```
Team-Summe = Läufer A (125 km) + Läufer B (87 km) + Läufer C (110 km) = 322 km
```

**Neu (mit Cap):**
```
Team-Summe = min(125, 100) + min(87, 100) + min(110, 100)
           = 100 km + 87 km + 100 km
           = 287 km
```

**Implementierungs-Strategie:**
1. Neue Hilfsfunktion `calculateCappedTeamTotal()` anlegen
2. Diese Funktion durchläuft alle Läufer und wendet das 100km-Cap an
3. Bestehende Team-Summen-Berechnung wird durch den Aufruf dieser Funktion ersetzt
4. Die individuellen Läufer-Statistiken bleiben unverändert (nutzen weiterhin das ungekappt `totaldistance`-Feld)

### Was bleibt unverändert

**Individuelle Läufer-Statistiken:**
- "Kilometer gesamt {name}" in Teams-Benachrichtigungen → zeigt volle km (z.B. 125 km)
- Persönliche Läufe-Übersicht (`/runs`) → zeigt volle km
- Admin-Bereich (`/admin`) → zeigt volle km
- Läufer-Profil → zeigt volle km

**Datenquellen:**
- TYPO3 bleibt die Single Source of Truth für alle Läufer-Daten
- `totaldistance`-Feld wird nicht verändert, nur bei der Berechnung gecappt

**Keine UI-Änderungen:**
- Keine neue Seiten oder Komponenten
- Keine neuen Formularfelder
- Keine neuen Admin-Controls

### Datenfluss

```
Lauf wird eingetragen (UI oder Strava)
        ↓
Teams-Benachrichtigung wird ausgelöst
        ↓
Alle Läufer*innen-Daten werden von TYPO3 geladen
        ↓
Für jeden Läufer:
  - Individuelle Statistik: volle km verwenden (totaldistance)
  - Team-Summe: auf 100km begrenzen (min(totaldistance, 100))
        ↓
Adaptive Card mit beiden Werten wird an Teams gesendet
```

### Edge Cases (technische Perspektive)

| Szenario | Verhalten |
|----------|-----------|
| Läufer hat 0 km | Wird mit 0 gezählt (keine Änderung) |
| Läufer hat 87,5 km | Wird mit 87,5 gezählt (unter Cap) |
| Läufer hat genau 100 km | Wird mit 100 gezählt (am Cap) |
| Läufer hat 125,3 km | Wird mit 100 gezählt (über Cap) |
| TYPO3-API fehlgeschlagen | Fallback-Wert "--" wie bisher |

### Neue Dependencies

**Keine neuen Packages nötig.**
Alle benötigten Werkzeuge (Supabase-Client, TYPO3-Client, Logger) sind bereits vorhanden.

### Was wird NICHT gebaut

- Kein UI-Toggle "Cap aktivieren/deaktivieren"
- Keine Anzeige "X Läufer wurden gekappt"
- Kein Hinweis in der Nachricht über die Kappung
- Keine Admin-Übersicht mit gekappten vs. ungekappten Werten
- Keine Datenbank-Felder für die Cap-Grenze (hardcoded 100km)

**Begründung:** Die Anforderung ist eindeutig — die Kappung soll unsichtbar bleiben (AC-5). Es geht nur um die korrekte Berechnung der Erstattungssumme.

### Deployment-Hinweise

- Keine Datenbank-Migration nötig
- Keine Umgebungsvariablen-Änderungen
- Keine Breaking Changes — reine Logik-Anpassung
- Abwärtskompatibel: Falls TYPO3-Daten fehlen, greift der bestehende Fallback

## Implementation Notes (Backend)

**Implemented:** 2026-04-15

**Files modified:**
- `src/lib/teams-notification.ts` (Zeilen 240-245)

**Änderungen:**
Die Team-Gesamtkilometer-Berechnung wurde angepasst. Statt einer separaten Hilfsfunktion wurde die Logik direkt in die `reduce()`-Operation integriert:

```
// Vorher:
const teamTotalKm = runners.reduce((sum, r) => sum + (parseFloat(r.totaldistance) || 0), 0)

// Nachher:
const teamTotalKm = runners.reduce((sum, r) => {
  const runnerKm = parseFloat(r.totaldistance) || 0
  return sum + Math.min(runnerKm, 100)
}, 0)
```

**Verhalten:**
- Läufer mit 0-100km: werden mit ihrer vollen Distanz gezählt
- Läufer mit >100km: werden mit exakt 100km gezählt (Math.min)
- Individuelle Läufer-Statistik ("Kilometer gesamt {name}"): bleibt unverändert, nutzt weiterhin `runner.totaldistance` ohne Kappung (Zeile 238)

**Keine weiteren Änderungen nötig:**
- UI bleibt unverändert
- API-Endpoints bleiben unverändert
- Datenbankschema bleibt unverändert
