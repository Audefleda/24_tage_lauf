# PROJ-22: Umgebungsanzeige im Header

## Status: In Review
**Created:** 2026-03-31
**Last Updated:** 2026-03-31

## Dependencies
- Requires: PROJ-1 (App-Header existiert bereits als `AppHeader`-Komponente)

## User Stories
- Als Anwender möchte ich auf einem Blick erkennen, ob ich mich auf der lokalen Entwicklungsumgebung, einer Preview oder der Produktionsumgebung befinde, damit ich weiß, ob meine Eingaben "echte" Daten betreffen.
- Als Entwickler möchte ich beim Testen einer Preview-URL sofort den Branch-Namen und das Deployment-Datum sehen, damit ich sicherstellen kann, dass ich den richtigen Build teste.
- Als Administrator möchte ich in der Produktion das Deployment-Datum sehen, damit ich nachvollziehen kann, welche Version gerade live ist.
- Als Anwender auf der Login-Seite möchte ich die Umgebungsinfo bereits vor dem Einloggen sehen, damit ich bei falscher Umgebung direkt abbrechen kann.

## Acceptance Criteria

### Lokale Entwicklung (`NODE_ENV === "development"` oder kein Vercel-Deployment)
- [ ] Im Header wird ein Badge/Label „Lokale Entwicklung" angezeigt
- [ ] Kein Datum/Uhrzeit wird angezeigt

### Preview-Umgebung (`NEXT_PUBLIC_VERCEL_ENV === "preview"`)
- [ ] Im Header wird „Preview · <Branch-Name> · <Datum> <Uhrzeit>" angezeigt
- [ ] Branch-Name stammt aus `NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF`
- [ ] Datum und Uhrzeit stammen aus dem Build-Zeitstempel (`NEXT_PUBLIC_DEPLOY_TIME`), der beim Build injiziert wird
- [ ] Format: `DD.MM. HH:MM` (z.B. `31.03. 14:22`)

### Produktionsumgebung (`NEXT_PUBLIC_VERCEL_ENV === "production"`)
- [ ] Im Header wird nur Datum und Uhrzeit des Deployments angezeigt (z.B. `Deploy: 31.03. 14:22`)
- [ ] Kein Branch-Name wird angezeigt
- [ ] Datum und Uhrzeit stammen aus dem Build-Zeitstempel (`NEXT_PUBLIC_DEPLOY_TIME`)

### Allgemein
- [ ] Die Umgebungsanzeige ist für alle Nutzer sichtbar — auch ohne Login, also auch auf der Login-Seite
- [ ] Die Anzeige ist im bestehenden `AppHeader` integriert (keine neue Komponente)
- [ ] Die Anzeige ist auf Mobile (375px) sichtbar oder dezent ausgeblendet, falls Platz fehlt
- [ ] Im Produktions-Build ohne Vercel-Kontext (z.B. `npm run build` lokal) wird nichts angezeigt oder es erscheint „Lokale Entwicklung"

## Edge Cases
- **Kein `NEXT_PUBLIC_DEPLOY_TIME` gesetzt** (z.B. lokaler Build ohne CI): Datum/Uhrzeit nicht anzeigen, nur Umgebungsname
- **Branch-Name ist sehr lang** (>20 Zeichen): Abschneiden mit `…` nach 20 Zeichen
- **`NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF` nicht gesetzt**: Nur „Preview" anzeigen, ohne Branch-Name
- **Login-Seite**: Anzeige muss auch ohne eingeloggten User erscheinen

## Technical Requirements
- `NEXT_PUBLIC_DEPLOY_TIME` wird als ISO-8601-String zur Build-Zeit gesetzt (z.B. via `next.config.ts`: `env: { NEXT_PUBLIC_DEPLOY_TIME: new Date().toISOString() }`)
- `NEXT_PUBLIC_VERCEL_ENV` und `NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF` sind Standard-Vercel-Umgebungsvariablen — keine manuelle Konfiguration nötig
- Die Anzeige ist rein clientseitig lesbar (alle Variablen sind `NEXT_PUBLIC_*`)
- Kein API-Aufruf nötig

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## Implementation Notes (Frontend)
- `NEXT_PUBLIC_DEPLOY_TIME` injected via `next.config.ts` `env` block at build time (ISO-8601)
- `EnvironmentBadge` component added directly inside `app-header.tsx` (no separate file, as spec requires integration in existing AppHeader)
- Uses shadcn/ui `Badge` component with three visual variants:
  - **Local dev**: Emerald green badge, text "Lokale Entwicklung"
  - **Preview**: Amber badge with "Preview . branch . DD.MM. HH:MM" format
  - **Production**: Outline/grey badge with "Deploy: DD.MM. HH:MM"
- Badge is placed between the site title and the navigation links, visible on all pages (including login)
- On mobile (<640px) the badge is hidden (`hidden sm:inline-flex`) to preserve header space
- Branch names longer than 20 characters are truncated with ellipsis
- All edge cases handled: missing deploy time, missing branch ref, missing Vercel env

## QA Test Results

**Tested:** 2026-03-31 (2. Durchlauf)
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Build:** `npm run build` passes without errors
**Unit Tests:** 86/86 passed (davon 10 fuer EnvironmentBadge in app-header.test.tsx)

### Acceptance Criteria Status

#### AC-1: Lokale Entwicklung (NODE_ENV === "development" oder kein Vercel-Deployment)
- [x] Im Header wird ein Badge/Label "Lokale Entwicklung" angezeigt (emerald green Badge) -- Unit-Test bestaetigt
- [x] Kein Datum/Uhrzeit wird angezeigt -- Unit-Test bestaetigt

#### AC-2: Preview-Umgebung (NEXT_PUBLIC_VERCEL_ENV === "preview")
- [x] Im Header wird "Preview . <Branch-Name> . <Datum> <Uhrzeit>" angezeigt (amber Badge) -- Unit-Test bestaetigt
- [x] Branch-Name stammt aus NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF
- [x] Datum und Uhrzeit stammen aus dem Build-Zeitstempel (NEXT_PUBLIC_DEPLOY_TIME)
- [x] Format: DD.MM. HH:MM (korrekt in formatDeployTime implementiert) -- Unit-Test bestaetigt

#### AC-3: Produktionsumgebung (NEXT_PUBLIC_VERCEL_ENV === "production")
- [x] Im Header wird nur Datum und Uhrzeit des Deployments angezeigt (z.B. "Deploy: 31.03. 14:22") -- Unit-Test bestaetigt
- [x] Kein Branch-Name wird angezeigt
- [x] Datum und Uhrzeit stammen aus dem Build-Zeitstempel (NEXT_PUBLIC_DEPLOY_TIME)

#### AC-4: Allgemein
- [x] Die Umgebungsanzeige ist fuer alle Nutzer*innen sichtbar -- auch ohne Login (AppHeader in root layout.tsx)
- [x] Die Anzeige ist im bestehenden AppHeader integriert (EnvironmentBadge innerhalb app-header.tsx)
- [x] Die Anzeige ist auf Mobile (375px) dezent ausgeblendet (hidden sm:inline-flex) -- Unit-Test bestaetigt
- [x] Im Produktions-Build ohne Vercel-Kontext erscheint "Lokale Entwicklung" (Bedingung: !vercelEnv) -- Unit-Test bestaetigt

### Edge Cases Status

#### EC-1: Kein NEXT_PUBLIC_DEPLOY_TIME gesetzt
- [x] Lokale Entwicklung: Zeigt nur "Lokale Entwicklung" ohne Datum
- [x] Preview: Zeigt nur "Preview" bzw. "Preview . branch" ohne Datum -- Unit-Test bestaetigt
- [ ] BUG: Produktion: Badge wird komplett ausgeblendet statt "Deploy" ohne Datum zu zeigen (siehe BUG-1)

#### EC-2: Branch-Name ist sehr lang (>20 Zeichen)
- [x] Abschneiden mit Ellipsis nach 20 Zeichen (truncateBranch korrekt implementiert) -- Unit-Test bestaetigt

#### EC-3: NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF nicht gesetzt
- [x] Nur "Preview" angezeigt, ohne Branch-Name (filter(Boolean) entfernt null-Werte) -- Unit-Test bestaetigt

#### EC-4: Login-Seite
- [x] Anzeige erscheint auch ohne eingeloggten User (AppHeader in root layout)

#### EC-5: Malformed NEXT_PUBLIC_DEPLOY_TIME (neu identifiziert)
- [ ] BUG: Ungueltige ISO-Strings fuehren zu "NaN.NaN. NaN:NaN" statt Fallback (siehe BUG-2)

### Security Audit Results
- [x] Keine sensiblen Daten exponiert: Alle Env-Variablen sind NEXT_PUBLIC_* (bewusst oeffentlich)
- [x] Kein API-Aufruf, kein User-Input -- kein Injektions-Risiko
- [x] Branch-Name in Preview akzeptabel (Preview-Umgebungen sind nicht oeffentlich)
- [x] Keine Geheimnisse (Tokens, Passwoerter) in der Anzeige
- [x] Security-Headers in next.config.ts weiterhin korrekt konfiguriert
- [x] Kein XSS-Risiko: Alle angezeigten Werte stammen aus Build-Zeit-Umgebungsvariablen, nicht aus User-Input
- [x] Env-Variablen werden nur in app-header.tsx und app-header.test.tsx referenziert -- kein Leak in andere Dateien

### Cross-Browser / Responsive (Code Review)
- [x] Chrome/Firefox/Safari: Standard CSS (flexbox, badge) -- keine browser-spezifischen APIs verwendet
- [x] 375px (Mobile): Badge korrekt ausgeblendet via hidden sm:inline-flex (Breakpoint 640px)
- [x] 768px (Tablet): Badge sichtbar (ueber 640px Breakpoint)
- [x] 1440px (Desktop): Badge sichtbar, ausreichend Platz im Header

### Regression Check
- [x] AppHeader Navigation (PROJ-2, PROJ-3, PROJ-4): Links weiterhin korrekt positioniert
- [x] Login-Seite (PROJ-2): Header rendert korrekt ohne Navigation
- [x] Admin-Link (PROJ-6): Weiterhin nur fuer Admin-Rolle sichtbar
- [x] Logout-Button: Weiterhin funktional
- [x] Build erfolgreich: Keine Kompilierungsfehler
- [x] Alle 86 Unit Tests bestanden (7 Test-Dateien) -- keine Regressionen

### Bugs Found

#### BUG-1: Produktion ohne NEXT_PUBLIC_DEPLOY_TIME zeigt gar kein Badge
- **Severity:** Low
- **Steps to Reproduce:**
  1. Setze NEXT_PUBLIC_VERCEL_ENV=production
  2. Setze NEXT_PUBLIC_DEPLOY_TIME nicht (oder loesche es)
  3. Expected: Badge "Deploy" wird ohne Zeitangabe angezeigt (analog zum Edge-Case-Spec: "Datum/Uhrzeit nicht anzeigen, nur Umgebungsname")
  4. Actual: Badge wird komplett ausgeblendet (return null in Zeile 41)
- **Priority:** Nice to have -- In der Praxis wird NEXT_PUBLIC_DEPLOY_TIME immer gesetzt (via next.config.ts), daher ist dieser Fall quasi nur theoretisch moeglich.
- **Unit-Test:** Dokumentiert in app-header.test.tsx ("BUG-1: production without deploy time returns null instead of showing label")

#### BUG-2: Malformed NEXT_PUBLIC_DEPLOY_TIME fuehrt zu "NaN"-Anzeige
- **Severity:** Low
- **Steps to Reproduce:**
  1. Setze NEXT_PUBLIC_DEPLOY_TIME auf einen ungueltigen Wert (z.B. "not-a-date")
  2. Setze NEXT_PUBLIC_VERCEL_ENV=production
  3. Expected: Badge faellt zurueck auf "Deploy" ohne Zeitangabe, oder wird ausgeblendet
  4. Actual: Badge zeigt "Deploy: NaN.NaN. NaN:NaN", weil `new Date("not-a-date")` kein Error wirft, sondern ein Invalid-Date-Objekt zurueckgibt, und die try/catch-Logik in formatDeployTime greift nicht
- **Root Cause:** formatDeployTime (Zeile 12-24) prueft nicht auf `isNaN(date.getTime())` nach dem Date-Konstruktor
- **Priority:** Nice to have -- In der Praxis wird der Wert via `new Date().toISOString()` in next.config.ts generiert und ist daher immer valides ISO-8601. Dieser Fall ist nur bei manueller Manipulation moeglich.

### Summary
- **Acceptance Criteria:** 11/11 passed
- **Edge Cases:** 4/6 passed, 2 Low-Severity Bugs (1 bereits bekannt, 1 neu)
- **Bugs Found:** 2 total (0 critical, 0 high, 0 medium, 2 low)
- **Security:** Pass -- keine Angriffsvektoren, rein clientseitige Anzeige von Build-Zeit-Variablen
- **Regression:** Pass -- keine Regressionen in bestehenden Features, alle 86 Unit Tests bestanden
- **Production Ready:** YES
- **Recommendation:** Deploy. Beide Low-Severity Bugs (BUG-1, BUG-2) betreffen rein theoretische Szenarien und koennen optional in einem spaeteren Sprint behoben werden.

## Deployment
_To be added by /deploy_
