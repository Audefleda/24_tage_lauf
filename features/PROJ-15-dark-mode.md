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

### Previous Audit (2026-03-24)
Previous audit found 6 bugs (2 high, 1 medium, 3 low). BUG-1, BUG-2, BUG-3 were fixed in commits `af8e4f4` and `6825d21`. See current re-test below.

---

### Re-Test (2026-03-27)

**Tested:** 2026-03-27
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Static code audit + build verification (`npm run build` passes). All previously reported bugs re-verified against current codebase.

---

### Acceptance Criteria Status

#### AC-1: Systemsteuerung
- [x] Dark Mode activates automatically via `@media (prefers-color-scheme: dark)` in `globals.css:67`
- [x] Light Mode is active when no preference (`:root` defaults are light-mode values)
- [x] No manual toggle exists -- exclusively system-controlled
- [x] Mode switches without page reload -- pure CSS media query, no JS event needed

#### AC-2: CI-konforme Farben im Dark Mode
- [x] Page background: `#000000` (`--background: 0 0% 0%`) -- correct
- [x] Card background: `#1a1a1a` (`--card: 0 0% 10%`) -- correct
- [x] Primary text: `#ffffff` (`--foreground: 0 0% 100%`) -- correct
- [x] Secondary/muted text: `#9d9d9c` (`--muted-foreground: 60 1% 62%`) -- correct
- [x] Fire Red as primary -- dark mode uses `--primary: 349 100% 56%` (slightly lighter for better contrast)
- [x] Header stays `#000000` (hardcoded `bg-black` in `app-header.tsx:60`) -- correct
- [x] Borders: `#4a4a49` (`--border: 60 1% 29%`) -- correct
- [x] Green `#77a746` and Blue `#006ac3` unchanged -- correct (hardcoded in `tailwind.config.ts`)

#### AC-3: Komponenten im Dark Mode
- [x] Inputs: `input.tsx` uses `bg-background`, `border-border`, `text-foreground` (all semantic) -- adapts correctly
- [x] Selects: `select.tsx` uses `bg-popover`, `border-border`, `text-popover-foreground`, `focus:bg-accent` (all semantic) -- adapts correctly
- [x] Cards: `card.tsx` uses `border-border bg-card text-card-foreground` -- FIXED (was `border-[#d0d0d0]`)
- [x] Dialogs: `dialog.tsx` uses `border-border bg-background` -- FIXED (was `border-[#d0d0d0]`)
- [x] Alert Dialogs: `alert-dialog.tsx` uses `border-border bg-background` -- FIXED (was `border-[#d0d0d0]`)
- [x] Popovers: `popover.tsx` uses `border-border bg-popover text-popover-foreground` -- FIXED (was `border-[#d0d0d0]`)
- [x] Tables: `table.tsx` uses `border-border`, `bg-muted`, `hover:bg-muted` -- FIXED (was hardcoded hex)
- [x] Buttons (outline): uses `hover:bg-accent` -- FIXED (was `hover:bg-[#ededed]`)
- [x] Buttons (ghost): uses `hover:bg-accent` -- FIXED (was `hover:bg-[#ededed]`)
- [x] Buttons (default/destructive): `bg-[#ea0029]` Fire Red is intentionally hardcoded -- visible on both themes
- [x] Buttons (secondary): `bg-[#9d9d9c]` gray -- visible on dark BG, acceptable
- [x] Checkboxes: `bg-background`, `border-ring` (semantic) -- adapts correctly
- [x] Badges: Use semantic `bg-primary`/`bg-secondary` -- adapts correctly
- [x] Toast: `sonner.tsx` uses `theme="system"` with `bg-background`, `text-foreground`, `border-border` -- adapts correctly
- [x] Alert: Uses `bg-background text-foreground` + `dark:border-destructive` -- adapts correctly
- [x] Card description / Table caption: uses `text-muted-foreground` -- FIXED (was `text-[#878787]`)

#### AC-4: Kontrast & Lesbarkeit
- [x] White `#ffffff` on black `#000000`: contrast ratio 21:1 -- exceeds WCAG AAA
- [x] `#d0d0d0` on black: contrast ratio ~13.3:1 -- exceeds WCAG AAA
- [x] `#9d9d9c` on black: contrast ratio ~7.1:1 -- exceeds WCAG AA (4.5:1)
- [x] `#878787` on black: contrast ratio ~4.6:1 -- passes WCAG AA (4.5:1). No longer used as component text color; replaced by `text-muted-foreground` which resolves to `#9d9d9c` in dark mode.
- [x] Fire Red in dark mode: `--primary` adjusted to HSL(349, 100%, 56%) which is approximately `#FF1F4B`, contrast ~5.6:1 on black -- passes WCAG AA for normal text. Hardcoded `#ea0029` in header nav: korrekte WCAG-Berechnung ergibt 4.53:1 -- passes WCAG AA (BUG-6 geschlossen).

---

### Edge Cases Status

#### EC-1: No `prefers-color-scheme` support (very old browser)
- [x] Light mode is the fallback -- `:root` defaults are light-mode, dark values are inside `@media` block

#### EC-2: System setting changes during active session
- [x] Handled via CSS media query -- no JS event required, browser applies instantly

#### EC-3: Fire Red on dark background contrast
- [x] `--primary` CSS variable uses lighter value in dark mode (56% lightness vs 46%). Semantic usages (`text-primary`, `bg-primary`) benefit from this. Hardcoded `text-[#ea0029]` in header nav: korrekte WCAG-Berechnung 4.53:1 -- passes AA (BUG-6 geschlossen).

#### EC-4: External content (Strava links/images)
- [x] Not controllable -- acknowledged as non-bug in spec. `strava-connect-section.tsx` uses Strava brand color `#FC4C02` which is acceptable.

#### EC-5: Print styles
- [x] No custom `@media print` rules -- browser default (light) applies

---

### Security Audit Results
- N/A -- PROJ-15 is a pure CSS/visual feature with no authentication, API, or data handling implications. No security concerns.

---

### Cross-Browser & Responsive Notes
- `@media (prefers-color-scheme: dark)` is supported in Chrome 76+, Firefox 67+, Safari 12.1+ -- covers all modern browsers
- CSS variable-based theming is resolution-independent; no responsive-specific concerns for dark mode
- `darkMode: "media"` in Tailwind config ensures `dark:` utility classes also follow OS preference

---

### Previously Fixed Bugs (from 2026-03-24 audit)

| Bug | Status | Fixed in |
|-----|--------|----------|
| BUG-1: Hardcoded `border-[#d0d0d0]` in card/dialog/popover/table | FIXED | `af8e4f4`, `6825d21` |
| BUG-2: Hardcoded `bg-[#ededed]` / `hover:bg-[#ededed]` in table/button | FIXED | `af8e4f4`, `6825d21` |
| BUG-3: Hardcoded `text-[#878787]` in card description/table caption | FIXED | `6825d21` |
| BUG-4: `text-[#006ac3]` link button dark mode | FIXED | Now uses `dark:text-[#4daaff]` (contrast ~8.8:1 on black) |
| BUG-5: `focus:bg-[#4a4a49]` in SelectItem | FIXED | Now uses `focus:bg-accent` (semantic) |

---

### Remaining Bugs

#### BUG-6: Fire Red `#ea0029` in header nav
- **Status:** ✅ GESCHLOSSEN — Korrekte WCAG-Berechnung ergibt 4.53:1 (≥ 4.5:1 AA). Der QA-Report hatte 4.3:1 falsch berechnet.
- **Ursprüngliche Steps to Reproduce:**
  1. Set OS to dark mode
  2. View active navigation items in header (`text-[#ea0029]` on `bg-black`)
  3. Contrast ratio: ~4.3:1 (needs 4.5:1 for WCAG AA on normal text)
- **Affected files:**
  - `src/components/app-header.tsx:65` -- hover on logo link
  - `src/components/app-header.tsx:76-77` -- active/hover on "Laeufe" nav link
  - `src/components/app-header.tsx:87-88` -- active/hover on "Admin" nav link
  - `src/components/app-header.tsx:114` -- hover on logout button
- **Mitigating factors:** (1) Header is `bg-black` in both light and dark mode, so this is not a dark-mode regression -- it exists in light mode too. (2) Nav text is `font-bold uppercase` which improves perceived readability. (3) Spec acknowledges this edge case and suggests `#ef787e` as optional fallback.
- **Priority:** Nice to have (not a blocker)

#### BUG-7: Hardcoded CI hex colors in button variants are not theme-adaptive
- **Severity:** Low
- **Status:** ✅ GESCHLOSSEN — By design. CI-Farben (Fire Red, Grau) sind bewusst hardcodiert. Buttons sehen auf dunklem und hellem Hintergrund korrekt aus (weiße Schrift, ausreichender Kontrast). Kein visueller Defekt.

---

### Summary
- **Acceptance Criteria:** 18/18 passed (all previously failing criteria now fixed)
- **Previously found bugs:** 6/6 geschlossen (BUG-6 Kontrast korrekt, BUG-7 by design)
- **New bugs found:** 0
- **Security:** N/A (pure CSS feature)
- **Cross-browser:** Supported in all modern browsers (Chrome 76+, Firefox 67+, Safari 12.1+)
- **Production Ready:** YES — keine offenen Bugs

## Deployment
_To be added by /deploy_
