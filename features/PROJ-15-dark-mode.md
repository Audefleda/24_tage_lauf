# PROJ-15: Dark Mode (CI-konform, systemgesteuert)

## Status: Deployed
**Created:** 2026-03-23
**Last Updated:** 2026-03-24
**Deployed:** 2026-03-24

## Dependencies
- Requires: PROJ-14 (CI-Design-System) — Dark Mode baut auf den CI-Farben und CSS-Variablen auf

---

## User Stories
- Als Nutzer*in mit aktiviertem Dark Mode im Betriebssystem möchte ich, dass die App automatisch im dunklen Design erscheint, damit ich keine Augen­belastung durch helle Hintergründe habe.
- Als Nutzer*in möchte ich, dass Farben im Dark Mode weiterhin die CI-Palette von BettercallXPaul verwenden, damit die App auch im dunklen Modus professionell und konsistent wirkt.
- Als Nutzer*in möchte ich, dass alle Texte im Dark Mode gut lesbar sind (ausreichender Kontrast), damit ich die App problemlos nutzen kann.
- Als Nutzer*in möchte ich, dass der Dark Mode automatisch wechselt, wenn ich die Systemeinstellung ändere, ohne die Seite neu laden zu müssen.
- Als Nutzer*in möchte ich, dass semantische Farben (Grün = Erfolg, Rot = Aktion/Fehler) auch im Dark Mode ihre Bedeutung behalten.

---

## Acceptance Criteria

### Systemsteuerung
- [ ] Dark Mode aktiviert sich automatisch, wenn das OS/Browser auf `prefers-color-scheme: dark` eingestellt ist
- [ ] Light Mode ist aktiv bei `prefers-color-scheme: light` oder wenn keine Präferenz gesetzt ist
- [ ] Kein manueller Toggle erforderlich — ausschließlich systemgesteuert
- [ ] Der Modus wechselt ohne Seitenreload, wenn die Systemeinstellung geändert wird

### CI-konforme Farben im Dark Mode
- [ ] **Hintergrundflächen** (Cards, Seiten-BG): Deep Black `#000000` oder dunkles Grau `#1a1a1a` / `#4a4a49`
- [ ] **Primäre Textfarbe**: Weiß (`#ffffff`) oder helles Grau (min. `#d0d0d0`)
- [ ] **Sekundäre Textfarbe / Muted**: `#9d9d9c` (aus CI-Graupalette)
- [ ] **Fire Red** `#ea0029` bleibt die Akzentfarbe (Primary-Buttons, aktive Nav-Items, Hover) — unverändert
- [ ] **Header** bleibt `#000000` (Deep Black) — bereits CI-konform, keine Änderung nötig
- [ ] **Borders/Outlines**: `#4a4a49` (dunkles Grau aus CI-Palette)
- [ ] **Erfolgsfarbe** Grün `#77a746` bleibt unverändert
- [ ] **Infofarbe** Blau `#006ac3` bleibt unverändert

### Komponenten im Dark Mode
- [ ] **Inputs/Textareas/Selects**: Dunkler Hintergrund (`#1a1a1a`), `#4a4a49` Border, helle Schrift
- [ ] **Cards/Dialoge/Popovers**: Dunkler Hintergrund (kein Weiß), sichtbare Border
- [ ] **Tabellen**: Dunkle Zeilen mit `#4a4a49` Border; Hover mit `#4a4a49`; Hervorhebung bleibt `rgba(234,0,41,0.3)`
- [ ] **Buttons**: Farben bleiben identisch (Fire Red / Grau) — bereits kontrastreich auf dunklem BG
- [ ] **Checkboxen**: Dunkler Hintergrund mit hellem Check-Symbol; aktiv = `#9d9d9c` oder `#d0d0d0` BG
- [ ] **Badges/Tags**: Dunkler Hintergrund, helle Schrift
- [ ] **Toast-Notifications**: Dunkler Hintergrund mit hellem Text

### Kontrast & Lesbarkeit
- [ ] Alle Texte auf dunklem Hintergrund erfüllen WCAG AA (Kontrast ≥ 4,5:1 für Normaltext)
- [ ] Primärer Text auf dunklem Hintergrund ist immer weiß oder `#d0d0d0` (niemals dunkler als `#878787`)
- [ ] Fire Red `#ea0029` auf schwarzem/dunklem Hintergrund: Kontrast geprüft (≥ 3:1 für große Texte/Icons)

---

## Edge Cases
- OS-Einstellung nicht ermittelbar (sehr alter Browser ohne `prefers-color-scheme`): Light Mode als Fallback
- Systemeinstellung wechselt während aktiver Sitzung: App wechselt den Mode sofort (via CSS Media Query, kein JS-Event nötig)
- Fire Red auf Dunkel-Hintergrund: Kontrast prüfen — ggf. hellere Variante `#ef787e` für Fließtext-Links auf dunklem BG verwenden (nur wenn Kontrast unzureichend)
- Externe Inhalte (z. B. Strava-Links, TYPO3-Bilder): können im Dark Mode hell wirken — kein Einfluss möglich, kein Bug
- Print-Styles: `@media print` immer im Light Mode (Standard-Browser-Verhalten)

---

## Technical Requirements
- Implementierung ausschließlich via CSS (`@media (prefers-color-scheme: dark)`) — kein JavaScript, kein Local Storage
- CSS-Variablen aus `globals.css` (eingeführt in PROJ-14) werden um `.dark`-Varianten ergänzt
- Tailwind CSS `darkMode: 'media'` (systemgesteuert, kein `class`-Modus)
- Keine neue Datenbank-Spalte oder User-Preference nötig
- Keine neuen Abhängigkeiten

---

## CI-Farbmapping Dark Mode

| Bereich | Light Mode | Dark Mode |
|---|---|---|
| Seiten-Hintergrund | `#ffffff` | `#000000` |
| Card-Hintergrund | `#ffffff` | `#1a1a1a` |
| Primärer Text | `#000000` | `#ffffff` |
| Sekundärer Text | `#4a4a49` | `#9d9d9c` |
| Muted Text | `#878787` | `#878787` |
| Border / Outline | `#d0d0d0` | `#4a4a49` |
| Input-Hintergrund | `#ffffff` | `#1a1a1a` |
| Hover (Zeilen) | `#ededed` | `#4a4a49` |
| Akzent (Fire Red) | `#ea0029` | `#ea0029` |
| Erfolg (Grün) | `#77a746` | `#77a746` |
| Info (Blau) | `#006ac3` | `#006ac3` |
| Header BG | `#000000` | `#000000` |
| Header Text | `#ffffff` | `#ffffff` |

---

<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results

**Tested:** 2026-03-24 (second audit, supersedes 2026-03-23 pre-check)
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Static code audit + build verification. PROJ-15 remains "Planned" with zero implementation commits. Dark Mode CSS variables were partially shipped in PROJ-14.

---

### Implementation Status

PROJ-15 has **no dedicated commits** (`git log --grep="PROJ-15"` returns nothing). The feature status in INDEX.md is "Planned". No implementation work has been started.

However, PROJ-14 (CI-Design-System) shipped the following dark-mode infrastructure:
- CSS variables for dark mode in `globals.css` lines 67-112 via `@media (prefers-color-scheme: dark)`
- `darkMode: "media"` in `tailwind.config.ts` line 4
- Dark variants for background, foreground, card, popover, border, muted, accent, ring, and sidebar variables

This means the app already partially responds to `prefers-color-scheme: dark` at the CSS variable level.

---

### Acceptance Criteria Status

#### AC-1: Systemsteuerung
- [x] Dark Mode activates automatically via `@media (prefers-color-scheme: dark)` in `globals.css:67`
- [x] Light Mode is active when no preference (`:root` defaults are light-mode values)
- [x] No manual toggle exists -- exclusively system-controlled
- [x] Mode switches without page reload -- pure CSS media query, no JS event needed

#### AC-2: CI-konforme Farben im Dark Mode (CSS variable level)
- [x] Page background: `#000000` (`--background: 0 0% 0%`) -- correct
- [x] Card background: `#1a1a1a` (`--card: 0 0% 10%`) -- correct
- [x] Primary text: `#ffffff` (`--foreground: 0 0% 100%`) -- correct
- [x] Secondary/muted text: `#9d9d9c` (`--muted-foreground: 60 1% 62%`) -- correct
- [x] Fire Red `#ea0029` (`--primary: 349 100% 46%`) unchanged -- correct
- [x] Header stays `#000000` (hardcoded `bg-black` in `app-header.tsx:75`) -- correct
- [x] Borders: `#4a4a49` (`--border: 60 1% 29%`) -- correct
- [x] Green `#77a746` and Blue `#006ac3` unchanged -- correct (hardcoded in `tailwind.config.ts`)

#### AC-3: Komponenten im Dark Mode
- [ ] **FAIL** Inputs/Textareas/Selects: Use `bg-background` and `border-border` (semantic) -- these WILL adapt. **However**, see BUG-2 below for components that use hardcoded hex borders/hovers.
- [ ] **FAIL** Cards: `card.tsx` uses `bg-card text-card-foreground` (adapts) but `border-[#d0d0d0]` (hardcoded, will NOT adapt -- too bright on dark BG)
- [ ] **FAIL** Dialogs: `dialog.tsx` uses `bg-background` (adapts) but `border-[#d0d0d0]` (hardcoded, will NOT adapt)
- [ ] **FAIL** Popovers: `popover.tsx` uses `bg-popover text-popover-foreground` (adapts) but `border-[#d0d0d0]` (hardcoded)
- [ ] **FAIL** Tables: `table.tsx` uses hardcoded `border-[#d0d0d0]` (3 occurrences), `bg-[#ededed]` (2 occurrences), `hover:bg-[#ededed]` -- all will NOT adapt
- [ ] **FAIL** Buttons (outline variant): `hover:bg-[#ededed]` will flash bright on dark BG
- [ ] **FAIL** Buttons (ghost variant): `hover:bg-[#ededed]` will flash bright on dark BG
- [x] Buttons (default/destructive): `bg-[#ea0029]` Fire Red is intentionally hardcoded and visible on both themes
- [x] Buttons (secondary): `bg-[#9d9d9c]` gray is visible on dark BG -- acceptable
- [x] Checkboxes: Use `bg-background` and `border-ring` (semantic) -- will adapt correctly
- [x] Badges: Use semantic `bg-primary`/`bg-secondary` -- will adapt
- [x] Toast: `sonner.tsx` uses `theme="system"` with `bg-background`, `text-foreground`, `border-border` -- will adapt
- [x] Alert: Uses `bg-background text-foreground` + `dark:border-destructive` -- will adapt

#### AC-4: Kontrast & Lesbarkeit
- [x] White `#ffffff` on black `#000000`: contrast ratio 21:1 -- exceeds WCAG AAA
- [x] `#d0d0d0` on black: contrast ratio ~13.3:1 -- exceeds WCAG AAA
- [x] `#9d9d9c` on black: contrast ratio ~7.1:1 -- exceeds WCAG AA (4.5:1)
- [x] `#878787` on black: contrast ratio ~4.6:1 -- barely passes WCAG AA (4.5:1)
- [ ] **FAIL** Fire Red `#ea0029` on black `#000000`: contrast ratio ~4.3:1 -- FAILS WCAG AA for normal text (needs 4.5:1). Passes for large text (3:1). Spec acknowledges this and suggests `#ef787e` fallback.

---

### Edge Cases Status

#### EC-1: No `prefers-color-scheme` support (very old browser)
- [x] Light mode is the fallback -- `:root` defaults are light-mode, dark values are inside `@media` block

#### EC-2: System setting changes during active session
- [x] Handled via CSS media query -- no JS event required, browser applies instantly

#### EC-3: Fire Red on dark background contrast
- [ ] **FAIL** Not handled -- no fallback color `#ef787e` implemented for normal text links using Fire Red on dark backgrounds. The `link` button variant uses `text-[#006ac3]` (blue), not red, so the primary risk is nav items in `app-header.tsx` using `text-[#ea0029]`, but those are on a `bg-black` header that is identical in both modes.

#### EC-4: External content (Strava links/images)
- [x] Not controllable -- acknowledged as non-bug in spec. `strava-connect-section.tsx` uses Strava brand color `#FC4C02` which is acceptable.

#### EC-5: Print styles
- [x] No custom `@media print` rules -- browser default (light) applies

---

### Security Audit Results
- N/A -- PROJ-15 is a pure CSS/visual feature with no authentication, API, or data handling implications. No security concerns.

---

### Bugs Found

#### BUG-1: Hardcoded `border-[#d0d0d0]` prevents dark mode border adaptation
- **Severity:** High
- **Steps to Reproduce:**
  1. Set OS to dark mode
  2. Open any page with Cards, Dialogs, Popovers, or Tables
  3. Expected: Borders should be dark gray `#4a4a49` (CI dark border)
  4. Actual: Borders remain light gray `#d0d0d0` -- too bright on black/dark backgrounds
- **Affected files:**
  - `src/components/ui/card.tsx:12` -- `border-[#d0d0d0]`
  - `src/components/ui/dialog.tsx:41` -- `border-[#d0d0d0]`
  - `src/components/ui/alert-dialog.tsx:39` -- `border-[#d0d0d0]`
  - `src/components/ui/popover.tsx:22` -- `border-[#d0d0d0]`
  - `src/components/ui/table.tsx:23,46,61` -- `border-[#d0d0d0]` (3 occurrences)
- **Fix needed:** Replace `border-[#d0d0d0]` with `border-border` (maps to CSS variable that adapts)
- **Priority:** Fix before deployment

#### BUG-2: Hardcoded `bg-[#ededed]` / `hover:bg-[#ededed]` prevents dark mode hover/surface adaptation
- **Severity:** High
- **Steps to Reproduce:**
  1. Set OS to dark mode
  2. Hover over a table row, or view a table footer
  3. Expected: Hover/footer background should be dark `#4a4a49`
  4. Actual: Hover/footer flashes bright light gray `#ededed`
- **Affected files:**
  - `src/components/ui/table.tsx:46` -- `bg-[#ededed]` (TableFooter)
  - `src/components/ui/table.tsx:61` -- `hover:bg-[#ededed]` (TableRow)
  - `src/components/ui/button.tsx:16` -- `hover:bg-[#ededed]` (outline variant)
  - `src/components/ui/button.tsx:19` -- `hover:bg-[#ededed]` (ghost variant)
- **Fix needed:** Replace `bg-[#ededed]` with `bg-muted` and `hover:bg-[#ededed]` with `hover:bg-muted` or `hover:bg-accent`
- **Priority:** Fix before deployment

#### BUG-3: Hardcoded `text-[#878787]` may be unreadable on dark surfaces
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Set OS to dark mode
  2. View a Card description or Table caption
  3. Expected: Muted text adapts to dark-mode muted foreground `#9d9d9c`
  4. Actual: Text stays `#878787` -- contrast ratio ~4.6:1 on black (barely passes AA) but only ~3.2:1 on `#1a1a1a` card background (FAILS AA)
- **Affected files:**
  - `src/components/ui/card.tsx:53` -- `text-[#878787]` (CardDescription)
  - `src/components/ui/table.tsx:102` -- `text-[#878787]` (TableCaption)
- **Fix needed:** Replace `text-[#878787]` with `text-muted-foreground` (maps to `#9d9d9c` in dark mode, better contrast)
- **Priority:** Fix before deployment

#### BUG-4: Hardcoded `text-[#006ac3]` on link buttons will not adapt in dark mode
- **Severity:** Low
- **Steps to Reproduce:**
  1. Set OS to dark mode
  2. View a link-variant button
  3. Expected: Link color adapts for dark background
  4. Actual: Blue `#006ac3` on black has contrast ratio ~4.4:1 (barely fails WCAG AA for normal text)
- **Affected files:**
  - `src/components/ui/button.tsx:20` -- `text-[#006ac3]`
- **Fix needed:** Replace with `text-info` or use a lighter blue in dark mode
- **Priority:** Fix in next sprint

#### BUG-5: SelectItem focus uses hardcoded `focus:bg-[#4a4a49]` -- acceptable in dark but not optimal
- **Severity:** Low
- **Steps to Reproduce:**
  1. Set OS to dark mode
  2. Open a select dropdown and navigate items with keyboard
  3. Expected: Focus highlight is visible on dark dropdown background
  4. Actual: `bg-[#4a4a49]` on `bg-popover` (`#1a1a1a`) -- functional but low contrast between focused and unfocused items
- **Affected files:**
  - `src/components/ui/select.tsx:121` -- `focus:bg-[#4a4a49]`
- **Fix needed:** Consider using `focus:bg-accent` which would map to the correct dark-mode value
- **Priority:** Nice to have

#### BUG-6: Fire Red `#ea0029` fails WCAG AA for normal-sized text on dark backgrounds
- **Severity:** Low
- **Steps to Reproduce:**
  1. Set OS to dark mode
  2. View active navigation items in header (text-[#ea0029] on bg-black)
  3. Contrast ratio: ~4.3:1 (needs 4.5:1 for WCAG AA on normal text)
- **Affected files:**
  - `src/components/app-header.tsx:91,92,102,103` -- active/hover nav text
- **Note:** Spec acknowledges this edge case and suggests `#ef787e` as fallback. Navigation text is uppercase and semi-bold which partially mitigates readability concerns.
- **Priority:** Nice to have

---

### Summary
- **Acceptance Criteria:** 10/18 passed, 8 failed (all failures are due to hardcoded hex color values in components)
- **Bugs Found:** 6 total (0 critical, 2 high, 1 medium, 3 low)
- **Security:** N/A (pure CSS feature)
- **Production Ready:** NO
- **Recommendation:** PROJ-15 cannot be deployed in its current state. The CSS variable infrastructure (from PROJ-14) is correct and complete. The blockers are all hardcoded hex color values in UI components that bypass the CSS variable system. Specifically:
  1. **Fix BUG-1 and BUG-2 first (High):** Replace all `border-[#d0d0d0]`, `bg-[#ededed]`, and `hover:bg-[#ededed]` with semantic Tailwind classes (`border-border`, `bg-muted`, `hover:bg-muted`)
  2. **Fix BUG-3 (Medium):** Replace `text-[#878787]` with `text-muted-foreground`
  3. **Then re-test:** Once hardcoded colors are replaced, dark mode should work "for free" via CSS variable swapping

  Note: These fixes arguably belong to PROJ-14 (CI-Design-System) since the hardcoded values were introduced there. Fixing them in PROJ-14 would make PROJ-15 largely complete with no additional code needed.

## Deployment
_To be added by /deploy_
