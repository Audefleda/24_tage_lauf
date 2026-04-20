# PROJ-27: Rangliste (Admin)

## Status: In Progress
**Created:** 2026-04-20
**Last Updated:** 2026-04-20

## Dependencies
- Requires: PROJ-2 (Anmeldung) - für Admin-Authentifizierung
- Requires: PROJ-3 (Läufe-Übersicht) - für TYPO3-Läufe-Daten-Abruf

## User Stories
- Als Administrator*in möchte ich eine Rangliste aller Läufer*innen nach Gesamtkilometern sehen, um einen schnellen Überblick über die Leistungen aller Teilnehmer*innen zu erhalten
- Als Administrator*in möchte ich zusätzlich zur Gesamtdistanz auch die Anzahl der Läufe sehen, um zu erkennen, wer regelmäßig läuft
- Als Administrator*in möchte ich auch Läufer*innen ohne Läufe in der Liste sehen, um zu erkennen, wer noch keinen Lauf eingetragen hat

## Acceptance Criteria
- [ ] Neue Seite `/rangliste` existiert und ist im Navigationsmenü zwischen "Läufe" und "Admin" sichtbar
- [ ] Die Seite ist nur für Admins zugänglich (Nicht-Admins werden auf die Startseite weitergeleitet)
- [ ] Alle TYPO3-Läufer*innen werden in einer Tabelle angezeigt
- [ ] Die Liste ist nach tatsächlich gelaufenen Gesamtkilometern absteigend sortiert (höchste Distanz zuerst)
- [ ] Angezeigt werden: Rang, Name, Gesamtkilometer, Anzahl Läufe
- [ ] Auch Läufer*innen mit 0 km werden am Ende der Liste angezeigt
- [ ] Der Rang wird automatisch basierend auf der Sortierung vergeben (1., 2., 3., ...)
- [ ] Bei gleicher Kilometeranzahl wird die Anzahl der Läufe als zweites Sortierkriterium verwendet (mehr Läufe = höherer Rang)
- [ ] Die Seite verwendet das CI-konforme Design (BettercallXPaul) und ist Dark-Mode-kompatibel
- [ ] Ladezeiten: Initiales Laden < 2 Sekunden

## Edge Cases
- Was passiert, wenn mehrere Läufer*innen exakt die gleiche Distanz UND Anzahl Läufe haben?
  → Alphabetische Sortierung nach Name als drittes Kriterium
- Was passiert, wenn kein einziger Läufer Läufe eingetragen hat?
  → Alle Läufer*innen werden mit 0 km und 0 Läufen angezeigt
- Was passiert, wenn ein Nicht-Admin versucht, die Seite direkt über die URL aufzurufen?
  → Middleware leitet zur Startseite weiter
- Was passiert, wenn die TYPO3-API nicht erreichbar ist?
  → Fehlermeldung wird angezeigt: "Rangliste konnte nicht geladen werden. Bitte versuche es später erneut."
- Wie wird die Gesamtdistanz berechnet?
  → Summe aller Läufe im Event-Zeitraum (20.04.2026 - 14.05.2026) — Läufe außerhalb des Zeitraums werden nicht gezählt

## Technical Requirements
- **Authentication:** Admin-Rolle erforderlich (app_metadata.role === 'admin')
- **Data Source:** TYPO3-API (alle Läufer*innen, alle Läufe)
- **Performance:** < 2 Sekunden Ladezeit
- **Browser Support:** Chrome, Firefox, Safari (aktuelle Versionen)
- **Responsive:** Funktioniert auf Desktop und Tablet (Mobile optional, da Admin-Funktion)

## Out of Scope
- Keine Filterfunktionen (z.B. nach Woche, Team)
- Keine Export-Funktion (CSV/PDF)
- Keine Live-Aktualisierung (User muss Seite manuell neu laden)
- Keine Detailansicht pro Läufer*in (dafür gibt es die Benutzerverwaltung)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
Diese Admin-Seite zeigt eine sortierte Rangliste aller Läufer*innen basierend auf TYPO3-Daten. Sie nutzt die bestehende API-Infrastruktur und ergänzt eine neue Seite mit Tabellen-Darstellung.

### Komponenten-Struktur
```
/rangliste (neue Seite, Admin-only)
+-- PageHeader
|   +-- Titel: "Rangliste"
|   +-- Beschreibung: "Alle Läufer*innen sortiert nach Gesamtkilometern"
+-- Card (shadcn/ui)
    +-- CardHeader (Zusammenfassung)
    |   +-- Anzahl Läufer*innen gesamt
    |   +-- Anzahl aktive Läufer*innen (mit Läufen)
    +-- CardContent
        +-- Table (shadcn/ui)
            +-- TableHeader
            |   +-- Rang | Name | Gesamtkm | Anzahl Läufe
            +-- TableBody
                +-- TableRow (für jeden Läufer)
                    +-- Rang-Badge (1., 2., 3., ...)
                    +-- Name + Startnummer
                    +-- Gesamtkilometer (formatiert)
                    +-- Anzahl Läufe
+-- Loading State (Skeleton)
+-- Error State (Alert mit Fehlermeldung)
+-- Empty State (wenn keine Daten vorhanden)
```

### Datenmodell

**Quelle:** TYPO3-API über bestehenden Endpoint `/api/admin/runners`

**Was wird abgerufen:**
- Alle Läufer*innen mit ihren Läufen
- Für jeden Läufer: `uid`, `nr` (Startnummer), `name`, `runs` (Array)

**Client-seitige Berechnung:**
- Gesamtkilometer: Summe aller `runs[].distance` im Event-Zeitraum (20.04. - 14.05.2026)
- Anzahl Läufe: Anzahl der Einträge in `runs[]` im Event-Zeitraum
- Sortierung:
  1. Gesamtkilometer (absteigend)
  2. Anzahl Läufe (absteigend, bei gleichen km)
  3. Name (alphabetisch, bei gleichen km + Läufen)
- Rang: Fortlaufende Nummerierung nach Sortierung (1., 2., 3., ...)

**Warum client-seitig?**
Die TYPO3-API liefert bereits alle Läufer-Daten. Eine neue Backend-Route würde nur die gleichen Daten erneut verarbeiten. Client-seitige Berechnung ist hier effizienter und reduziert Server-Last.

### Navigation

**Erweiterung in `app-header.tsx`:**
- Neuer Link "RANGLISTE" zwischen "LÄUFE" und "ADMIN"
- Sichtbar nur für Admins (`user.app_metadata?.role === 'admin'`)
- Active-State-Highlighting wie bei bestehenden Links

### Technische Entscheidungen

#### 1. Keine neue API-Route
**Entscheidung:** Bestehender Endpoint `/api/admin/runners` wird wiederverwendet

**Begründung:**
- Der Endpoint liefert bereits alle benötigten Daten (Läufer + Läufe)
- Sortierung und Aggregation sind auf Client-Seite einfach und schnell
- Vermeidet Code-Duplizierung
- Reduziert Server-Last (keine zusätzliche TYPO3-Anfrage)

#### 2. shadcn/ui Table-Komponente
**Entscheidung:** Verwendung der bestehenden `Table`-Komponente aus `src/components/ui/table.tsx`

**Begründung:**
- Bereits installiert und CI-konform gestylt
- Dark-Mode-kompatibel
- Responsive Design out-of-the-box
- Konsistent mit anderen Tabellen in der App (z.B. Benutzerverwaltung)

#### 3. Client-seitige Sortierung
**Entscheidung:** Daten werden im Browser sortiert, nicht serverseitig

**Begründung:**
- Datenmenge ist klein (5-30 Läufer*innen)
- Event-Zeitraum-Filter muss sowieso client-seitig angewendet werden
- Flexibilität für zukünftige Filter-Funktionen (z.B. nach Woche)
- Kein zusätzlicher API-Call nötig

#### 4. Admin-Only Access
**Entscheidung:** Zugriff nur für Admins, andere werden auf `/` weitergeleitet

**Begründung:**
- Rangliste zeigt Daten aller Läufer*innen → Datenschutz
- Nutzer*innen sollen nur ihre eigenen Daten sehen (bestehendes Prinzip)
- Middleware prüft `app_metadata.role === 'admin'` (bereits etabliert)

#### 5. Keine Live-Aktualisierung
**Entscheidung:** Statische Datendarstellung, manuelle Aktualisierung via Browser-Reload

**Begründung:**
- Admin-Funktion, keine Echtzeit-Anforderung
- Event-Zeitraum ist begrenzt (25 Tage), Daten ändern sich nicht sekündlich
- Vermeidet unnötige API-Calls
- Konsistent mit anderen Admin-Seiten

### Abhängigkeiten (npm packages)

**Keine neuen Abhängigkeiten nötig** — alle benötigten Komponenten existieren bereits:
- `@/components/ui/table` (shadcn/ui)
- `@/components/ui/card` (shadcn/ui)
- `@/components/ui/badge` (shadcn/ui)
- `@/components/ui/alert` (shadcn/ui)
- `@/components/ui/skeleton` (shadcn/ui)
- `@/components/page-header` (Custom, bereits vorhanden)

### Performance-Überlegungen

**Ladezeit-Ziel:** < 2 Sekunden

**Optimierungen:**
1. **Skeleton-Loading:** Während API-Call läuft, wird Tabellen-Struktur als Skeleton angezeigt
2. **Caching:** Browser cached die `/api/admin/runners` Response (Standard-HTTP-Caching)
3. **Client-seitige Sortierung:** Einmalige Berechnung nach API-Response, kein Re-Fetching

**Bottleneck:**
- TYPO3-API-Antwortzeit (außerhalb unserer Kontrolle)
- Falls TYPO3 > 2 Sekunden braucht, wird Error-State angezeigt

### Sicherheitsaspekte

1. **Admin-Authentifizierung:**
   - Middleware prüft `app_metadata.role === 'admin'` vor Zugriff auf `/rangliste`
   - Nicht-Admins werden auf `/` weitergeleitet

2. **API-Zugriff:**
   - `/api/admin/runners` hat bereits Admin-Check (`requireAdmin()`)
   - Rate Limiting: 30 Requests/Minute (bereits implementiert)

3. **Datenschutz:**
   - Nur Admins sehen die Rangliste (alle Läufer*innen)
   - Normale Nutzer*innen sehen weiterhin nur ihre eigenen Daten

### Ausnahmen & Fehlerbehandlung

1. **TYPO3-API nicht erreichbar:**
   - Error-State mit Alert: "Rangliste konnte nicht geladen werden. Bitte versuche es später erneut."
   - Retry-Option: Button "Erneut versuchen"

2. **Keine Läufer*innen vorhanden:**
   - Empty-State: "Noch keine Läufer*innen vorhanden"

3. **Alle Läufer*innen haben 0 km:**
   - Normale Anzeige mit 0 km und 0 Läufen für alle

4. **Admin-Rechte fehlen:**
   - Middleware-Redirect zu `/` (vor Seiten-Load)

### Responsive Design

- **Desktop (> 1024px):** Volle Tabelle mit allen Spalten
- **Tablet (768px - 1024px):** Volle Tabelle, kleinere Schrift
- **Mobile (< 768px):** Optional, da Admin-Funktion primär auf Desktop genutzt wird
  - Falls implementiert: Stacked Cards statt Tabelle

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
