# PROJ-27: Rangliste (Admin)

## Status: In Review
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

## Implementation Notes (Frontend)

### Abweichungen vom Tech Design

1. **Neue API-Route statt Wiederverwendung von `/api/admin/runners`:**
   - Der bestehende Endpoint `/api/admin/runners` verwendet `sumonly=1` und liefert keine individuellen Laeufe zurueck
   - Eine Aenderung dieses Endpoints haette die bestehende Benutzerverwaltung (RunnerAssignmentTable) beeinflussen koennen
   - Stattdessen: Neuer Endpoint `/api/admin/rangliste` der TYPO3 ohne `sumonly` aufruft und serverseitig Statistiken berechnet
   - Sortierung und Rang-Berechnung erfolgen serverseitig (nicht client-seitig wie im Tech Design vorgeschlagen), da der neue Endpoint die Daten ohnehin verarbeitet

2. **Drei statt zwei Summary-Karten:**
   - Zusaetzlich zu "Laeufer*innen gesamt" und "Aktive (mit Laeufen)" wurde eine dritte Karte "Gesamt-km aller Laeufer*innen" ergaenzt, die die Summe aller Kilometer zeigt

### Implementierte Dateien

- `src/app/api/admin/rangliste/route.ts` — API-Endpoint (Admin-only, rate-limited)
- `src/app/rangliste/page.tsx` — Ranglisten-Seite mit Tabelle, Loading/Error/Empty States
- `src/components/app-header.tsx` — Navigation erweitert um "RANGLISTE"-Link (Admin-only)
- `src/middleware.ts` — `/rangliste` als Admin-geschuetzte Route hinzugefuegt

### Features

- Top-3-Raenge mit farbigen Badges (Gold, Silber, Bronze), Dark-Mode-kompatibel
- Laeufer*innen ohne Laeufe werden mit gedaempfter Textfarbe am Ende angezeigt
- Responsive Design (Desktop + Tablet)
- Skeleton-Loading waehrend API-Call
- Error-State mit "Erneut versuchen"-Button
- Empty-State wenn keine Laeufer*innen vorhanden

## QA Test Results

**Tested:** 2026-04-20
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Automated tests (Vitest + Playwright) + Code review + Security audit

### Automated Test Results

**Vitest (Unit/Integration):** 177/177 passed (including PROJ-27 ranking calculation tests)
**Playwright (E2E):** 42/42 passed (PROJ-27 rangliste.spec.ts, Chromium + Mobile Safari)
**Regression:** All admin (10/10), team-stats (22/22), and other E2E tests pass
**Build:** Production build succeeds without errors
**Lint:** No new errors or warnings from PROJ-27 files

### Acceptance Criteria Status

#### AC-1: Neue Seite `/rangliste` existiert und ist im Navigationsmenu sichtbar
- [x] `/rangliste` page exists and renders correctly
- [x] Navigation link "RANGLISTE" appears between "LAUFE" and "ADMIN" in the header
- [x] Link is visible only for admins (guarded by `app_metadata.role === 'admin'`)
- [x] Active state highlighting works correctly (red color when on /rangliste)
- **PASS**

#### AC-2: Die Seite ist nur fuer Admins zugaenglich
- [x] Middleware redirects unauthenticated users to `/login`
- [x] Middleware redirects non-admin users to `/` (root page)
- [x] API endpoint `/api/admin/rangliste` returns 403 for non-admin users
- [x] API endpoint redirects unauthenticated users to `/login`
- [x] Defense in depth: both middleware AND `requireAdmin()` in route handler check admin role
- **PASS**

#### AC-3: Alle TYPO3-Laeufer*innen werden in einer Tabelle angezeigt
- [x] Table displays all runners from TYPO3 API response
- [x] Table uses shadcn/ui Table component (consistent with rest of app)
- **PASS**

#### AC-4: Die Liste ist nach Gesamtkilometern absteigend sortiert
- [x] Highest distance appears first, lowest (0 km) appears last
- [x] Sorting is performed server-side in the API route
- **PASS**

#### AC-5: Angezeigt werden: Rang, Name, Gesamtkilometer, Anzahl Laeufe
- [x] Table columns: Rang, Name, Gesamt-km, Laeufe
- [x] Startnummer ("Nr. X") is shown next to the name
- [x] Kilometers formatted with 2 decimal places and comma separator (German locale)
- **PASS**

#### AC-6: Laeufer*innen mit 0 km werden am Ende der Liste angezeigt
- [x] Runners with 0 km appear at the bottom of the table
- [x] 0 km runners shown with muted text color (visual distinction)
- **PASS**

#### AC-7: Rang wird automatisch basierend auf der Sortierung vergeben
- [x] Sequential ranking: 1., 2., 3., ...
- [x] Top 3 ranks displayed with colored badges (gold, silver, bronze)
- [x] Ranks 4+ displayed as plain text
- [x] Top 3 badges only shown when runner has totalKm > 0 (no gold badge for 0 km)
- **PASS**

#### AC-8: Bei gleicher Kilometeranzahl wird Anzahl der Laeufe als zweites Sortierkriterium verwendet
- [x] More runs = higher rank when km are equal
- [x] Alphabetical name as third criterion when km AND runs are equal
- [x] German locale sorting (`localeCompare('de')`) handles umlauts correctly
- **PASS**

#### AC-9: CI-konformes Design und Dark-Mode-kompatibel
- [x] Uses shadcn/ui Card, Table, Badge, Alert, Button, Skeleton components
- [x] Three summary cards: total runners, active runners, total km
- [x] Top-3 badges have dark mode variants (`dark:text-yellow-400`, `dark:text-gray-300`, `dark:text-amber-500`)
- [x] Page layout consistent with other admin pages
- [ ] BUG-1: User-visible text uses ASCII transliterations instead of German umlauts (see bugs below)
- **PARTIAL PASS** (design is CI-konform, but text violates PROJ-13 language standard)

#### AC-10: Ladezeiten: Initiales Laden < 2 Sekunden
- [x] E2E test confirms page loads and renders data within acceptable time
- [x] Skeleton loading state shown during data fetch
- **PASS**

### Edge Cases Status

#### EC-1: Gleiche Distanz UND Anzahl Laeufe -> alphabetische Sortierung
- [x] Verified in unit tests (`calculateRanking` sorts by name as tertiary criterion)
- [x] Uses German locale sorting
- **PASS**

#### EC-2: Kein einziger Laeufer hat Laeufe eingetragen -> alle mit 0 km angezeigt
- [x] All runners displayed with 0 km and 0 runs
- [x] Summary cards show correct counts (0 active)
- **PASS**

#### EC-3: Nicht-Admin versucht direkte URL-Aufruf
- [x] Middleware redirects to `/` (root page)
- [x] API returns 403 JSON for non-admin
- **PASS**

#### EC-4: TYPO3-API nicht erreichbar
- [x] Error state displayed with descriptive message
- [x] "Erneut versuchen" button triggers data reload
- [x] Retry button works (tested: first call fails, second succeeds)
- **PASS**

#### EC-5: Gesamtdistanz-Berechnung nur im Event-Zeitraum
- [x] Only runs from 2026-04-20 to 2026-05-14 are counted
- [x] Runs outside the event period are excluded
- [x] Event start and end dates are inclusive
- [x] Handles datetime format "YYYY-MM-DD HH:MM:SS"
- **PASS**

### Additional Edge Cases Tested (not in spec)

- [x] Empty runner list -> empty state with "Noch keine Laeufer*innen vorhanden"
- [x] Runners with `undefined` runs array -> gracefully handled (0 km, 0 runs)
- [x] NaN distance values (e.g., "abc") -> treated as 0
- [x] Comma-separated distances (German locale, e.g., "5,50") -> correctly parsed
- [x] Distance 0 runs not counted in runCount but included in totalKm calculation
- [x] Rounding to 2 decimal places (e.g., 1.111 + 2.222 = 3.33)

### Cross-Browser Testing

| Browser | Status |
|---------|--------|
| Chromium (Desktop) | PASS (21/21 E2E tests) |
| Mobile Safari (iPhone 13) | PASS (21/21 E2E tests) |
| Firefox | Not tested (not in Playwright config, but no browser-specific code used) |

### Responsive Testing

| Viewport | Status | Notes |
|----------|--------|-------|
| Desktop (1440px) | PASS | Full table with all columns |
| Tablet (768px) | PASS | Table scrolls horizontally via `overflow-x-auto` |
| Mobile (375px) | PASS (functional) | Table usable with horizontal scroll; spec notes mobile is optional for admin features |

### Security Audit (Red Team)

#### Authentication & Authorization
- [x] **PASS** Middleware checks `app_metadata.role === 'admin'` (server-side, cannot be spoofed by client)
- [x] **PASS** API route has `requireAdmin()` check (defense in depth)
- [x] **PASS** Non-admin users get 403 on API, redirect on page
- [x] **PASS** Unauthenticated users redirected to `/login`

#### Data Exposure
- [x] **PASS** API response only contains: rank, uid (TYPO3), nr (Startnummer), name, totalKm, runCount
- [x] **PASS** No email addresses, Supabase user IDs, or other PII exposed
- [x] **PASS** Individual run data (dates, distances) not included in response
- [x] **PASS** TYPO3 credentials never exposed to client

#### Input Security
- [x] **PASS** GET-only endpoint with no user input parameters
- [x] **PASS** No `dangerouslySetInnerHTML` or `eval()` usage
- [x] **PASS** Runner names rendered via React JSX (auto-escaped, no XSS risk)

#### Rate Limiting
- [x] **PASS** Rate limited at 30 requests per 60 seconds per IP
- [x] **PASS** Returns 429 with `Retry-After` header when limit exceeded

#### TYPO3 Response Handling
- [x] **PASS** Handles non-OK HTTP responses gracefully (returns 502)
- [x] **PASS** Handles Typo3Error exceptions
- [x] **PASS** Handles unexpected errors with generic 500 response
- [x] **INFO** No Zod validation on TYPO3 response shape, but defensive coding with `?? []`, `?? '0'` mitigates risk
- [x] **INFO** Error messages do not leak TYPO3 internal details to the client

### Regression Testing

| Feature | Test Suite | Status |
|---------|-----------|--------|
| PROJ-26 Team-Gesamtkilometer | team-stats.spec.ts (22 tests) | PASS |
| Admin pages (PROJ-6, PROJ-8) | admin.spec.ts (10 tests) | PASS |
| All unit tests (177 tests) | `npm test` | PASS |
| Production build | `npm run build` | PASS |
| Lint | `npm run lint` | No new errors/warnings |

### Bugs Found

#### BUG-1: User-visible text uses ASCII transliterations instead of German umlauts (PROJ-13 violation)
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Log in as admin
  2. Navigate to `/rangliste`
  3. Observe all text labels on the page
- **Expected:** Text uses proper German umlauts: "Laufer*innen", "Laufen", "spater"
- **Actual:** Text uses ASCII transliterations: "Laeufer*innen", "Laeufen", "spaeter"
- **Affected strings in `src/app/rangliste/page.tsx`:**
  - Line 64: "spaeter" should be "spater"
  - Line 110: "Laeufer*innen" should be "Laufer*innen"
  - Line 142: "Laeufer*innen" should be "Laufer*innen"
  - Line 155: "Laeufer*innen" should be "Laufer*innen"
  - Line 170: "Laeufen" should be "Laufen"
  - Line 181: "Laeufer*innen" should be "Laufer*innen"
  - Line 197: "Laeufer*innen" should be "Laufer*innen"
  - Line 219: "Laeufe" should be "Laufe"
- **Priority:** Fix before deployment (violates deployed PROJ-13 standard)

**Note on BUG-1:** The correct German characters should be: "ae" -> "a" (a-umlaut), "oe" -> "o" (o-umlaut), "ue" -> "u" (u-umlaut). Specifically:
- "Laeufer" -> "Laufer" (with a-umlaut)
- "Laeufe" -> "Laufe" (with a-umlaut)
- "Laeufen" -> "Laufen" (with a-umlaut)
- "spaeter" -> "spater" (with a-umlaut)

### Summary

| Metric | Result |
|--------|--------|
| Acceptance Criteria | 9/10 PASS, 1 PARTIAL (AC-9 text quality) |
| Edge Cases | 5/5 PASS |
| Security Audit | PASS (no vulnerabilities found) |
| Regression | PASS (no regressions) |
| Bugs Found | 1 Medium |
| Automated Tests | Unit: 177/177 PASS, E2E: 42/42 PASS |

### Production-Ready Decision

**NOT READY** -- BUG-1 (Medium) must be fixed before deployment. All user-visible text in `src/app/rangliste/page.tsx` uses ASCII transliterations ("Laeufer", "Laeufe", "spaeter") instead of proper German umlauts, which violates the PROJ-13 language standard that is already deployed in production. This is a straightforward text fix affecting a single file.

After BUG-1 is fixed, the feature is production-ready. All functionality, security, and performance criteria are met.

## Deployment
_To be added by /deploy_
