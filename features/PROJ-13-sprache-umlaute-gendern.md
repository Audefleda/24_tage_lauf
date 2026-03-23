# PROJ-13: Sprache — Umlaute & gendergerechte Formulierungen

## Status: Deployed
**Created:** 2026-03-23
**Last Updated:** 2026-03-23

## Implementation Notes
- Alle 7 Bugs aus QA Round 2 behoben (2026-03-23)
- BUG-1: `page-header.tsx` — "Meine Läufe", "Läufer*in:" korrigiert
- BUG-2: `request-log-table.tsx` — 6 ASCII-Umlaut-Strings korrigiert (Läufer*in-UID, Einträge, Zurück, etc.)
- BUG-3: `run-form.tsx` — "für" korrigiert
- BUG-4: `layout.tsx` — Metadata-Description korrigiert
- BUG-5/6: API-Routen (6 Dateien) — alle Umlaut- und Genderfehler behoben
- BUG-7: `api/runner/assign/route.ts` — "Ungültige Eingabe" Fallback korrigiert

## Dependencies
- None (querschnittliche Anpassung, unabhängig von anderen Features)

## User Stories
- Als Läufer*in möchte ich, dass mich die App in korrektem Deutsch mit Umlauten anspricht, damit sich die App professionell und vertraut anfühlt.
- Als Läuferin möchte ich, dass ich in der Benutzeroberfläche gleichberechtigt adressiert werde, damit ich mich von der App eingeschlossen fühle.
- Als Administrator*in möchte ich, dass alle Fehlermeldungen und Systemmeldungen auf Deutsch mit Umlauten formuliert sind, damit ich sie klar verstehen kann.
- Als Läufer*in möchte ich, dass E-Mails und Benachrichtigungen des Systems korrekte deutsche Umlaute und gendergerechte Ansprache verwenden, damit die Kommunikation konsistent und professionell wirkt.

## Acceptance Criteria

### Umlaute
- [ ] Alle UI-Texte, Labels und Buttons verwenden korrekte Umlaute (ä, ö, ü, Ä, Ö, Ü, ß)
- [ ] Keine Ersetzungen wie ae/oe/ue statt Umlauten in sichtbaren Texten
- [ ] Fehlermeldungen und Validierungstexte verwenden korrekte Umlaute
- [ ] System-E-Mails und Benachrichtigungen verwenden korrekte Umlaute

### Gendergerechte Sprache (Genderstern)
- [ ] Personenbezeichnungen im Singular folgen dem Muster: **Läufer*in**, **Nutzer*in**, **Administrator*in**
- [ ] Personenbezeichnungen im Plural folgen dem Muster: **Läufer*innen**, **Nutzer*innen**, **Administrator*innen**
- [ ] Anredeformen in E-Mails sind geschlechtsinklusiv (z. B. „Hallo [Name]," statt „Lieber/Liebe")
- [ ] Alle bestehenden maskulinen Generica werden ersetzt (z. B. „der Läufer" → „die Läufer*in")

### Vollständigkeit
- [ ] Alle sichtbaren Texte in UI-Komponenten sind überprüft und angepasst
- [ ] Alle Toast-Notifications und Fehlermeldungen sind überprüft und angepasst
- [ ] Alle Auth-bezogenen Texte (Login, Passwort-Reset, Erstanmeldung) sind überprüft und angepasst

## Edge Cases
- Kurze UI-Labels (z. B. Button-Beschriftungen wie „Speichern") brauchen keine Genderanpassung — nur Personenbezeichnungen
- Technische Strings (z. B. Enum-Werte, API-Parameter, Datenbankfelder) werden **nicht** angepasst — nur sichtbare Texte
- Eigennamen und feststehende Bezeichnungen (z. B. „Strava", „TYPO3", „Supabase") bleiben unverändert
- Texte, die von externen Systemen geliefert werden (z. B. Supabase Auth-Fehlercodes), können nicht angepasst werden — nur die App-seitigen Übersetzungen/Wrapper

## Style Guide

| Altes Muster | Neues Muster |
|---|---|
| Läufer | Läufer*in (Sg.) / Läufer*innen (Pl.) |
| Nutzer | Nutzer*in (Sg.) / Nutzer*innen (Pl.) |
| Benutzer | Nutzer*in (Sg.) / Nutzer*innen (Pl.) |
| Administrator | Administrator*in (Sg.) / Administrator*innen (Pl.) |
| der Läufer | die Läufer*in |
| ein Läufer | eine Läufer*in |
| Lieber Nutzer | Hallo [Name], |
| Kein Läufer gefunden | Keine Läufer*in gefunden |

## Technical Requirements
- Rein textuelle Änderung — keine funktionalen Code-Änderungen
- Keine Datenbankmigrationen erforderlich
- Betrifft: React-Komponenten (JSX-Texte), TypeScript-Strings, Fehlermeldungs-Konstanten

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results

**Tested:** 2026-03-23
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Static code analysis of all user-visible strings + build verification

### Acceptance Criteria Status

#### AC-1: Umlaute -- Alle UI-Texte, Labels und Buttons verwenden korrekte Umlaute
- [x] login-form.tsx: "gueltige" -> "gültige", "Zuruecksetzung" -> "Zurücksetzung", "Laeufe" -> "Läufe", etc. -- all fixed
- [x] reset-password-form.tsx: "bestaetigen" -> "bestätigen", "Passwoerter stimmen nicht ueberein" -> "Passwörter stimmen nicht überein" -- fixed
- [x] runs-table.tsx: "gueltige" -> "gültige", "fuer" -> "für" -- fixed
- [x] admin/page.tsx: "oeffnen" -> "öffnen" -- fixed
- [ ] BUG: page-header.tsx still shows "Meine Laeufe" (line 10) and "Laeufer:" (line 12) without umlauts
- [ ] BUG: request-log-table.tsx still has ASCII umlauts: "Laeufer-UID filtern..." (line 217), "Laeufer-UID Filter" (line 221), "Laeufer-UID" column header (line 295), "Keine Log-Eintraege gefunden." (line 278), "Eintraege gesamt" (line 382), "Zurueck" (line 392)
- [ ] BUG: run-form.tsx still shows "0 eingeben um den Lauf fuer diesen Tag zu entfernen." (line 124) -- "fuer" should be "für"
- [ ] BUG: layout.tsx metadata description still says "Laeufe eintragen und verwalten" (line 8) -- should be "Läufe eintragen und verwalten"
- **FAIL**

#### AC-2: Umlaute -- Keine ae/oe/ue Ersetzungen in sichtbaren Texten
- [ ] BUG: Multiple files still use ae/oe/ue replacements (see AC-1 findings)
- **FAIL**

#### AC-3: Umlaute -- Fehlermeldungen und Validierungstexte verwenden korrekte Umlaute
- [x] login-form.tsx validation: "gültige E-Mail-Adresse" -- fixed
- [x] runs-table.tsx validation: "gültige Zahl" -- fixed
- [x] reset-password-form.tsx: "Passwörter stimmen nicht überein" -- fixed
- [ ] BUG: /api/runner/runs/route.ts line 34: "Kein Laeufer-Profil gefunden" -- not fixed
- [ ] BUG: /api/runner/runs/route.ts line 49: "Ungueltiges Request-Format" -- not fixed
- [ ] BUG: /api/runner/route.ts line 49: "Kein Laeufer-Profil gefunden. Bitte Admin kontaktieren." -- not fixed
- [ ] BUG: /api/runner/route.ts line 89: "Laeufer mit UID ... nicht in TYPO3 gefunden" -- not fixed
- [ ] BUG: /api/auth/update-password/route.ts line 25: "Ungueltige Eingabe" -- not fixed
- [ ] BUG: /api/auth/update-password/route.ts line 54: "uebereinstimmen" -- not fixed
- [ ] BUG: /api/auth/update-password/route.ts line 71: "Ungueltige Anfrage" -- not fixed
- [ ] BUG: /api/admin/users/[id]/route.ts line 47: "Ungueltige User-ID" -- not fixed
- [ ] BUG: /api/admin/users/[id]/route.ts line 58: "Ungueltiger JSON-Body" -- not fixed
- [ ] BUG: /auth/callback/route.ts line 85: "Der Link ist ungueltig oder abgelaufen." -- not fixed
- **FAIL**

#### AC-4: Umlaute -- System-E-Mails und Benachrichtigungen verwenden korrekte Umlaute
- [x] E-Mail content is managed by Supabase -- outside app control (per edge case EC-4)
- [x] App-side wrappers (password reset confirmation text) use correct umlauts in login-form.tsx
- **PASS** (within scope of what the app controls)

#### AC-5: Gender -- Personenbezeichnungen Singular: Läufer*in, Nutzer*in, Administrator*in
- [x] runner-select-dialog.tsx: "Läufer*in auswählen" -- fixed
- [x] runner-assignment-table.tsx: "Läufer*innen-Zuordnung" -- fixed
- [x] admin/page.tsx: "Nutzer*innenverwaltung" -- fixed
- [x] /api/runner/assign/route.ts: "Ungültige Läufer*in", "Läufer*in erfolgreich zugeordnet" -- fixed
- [ ] BUG: page-header.tsx line 12: "Laeufer:" -- still uses non-gendered ASCII form, should be "Läufer*in:"
- [ ] BUG: /api/runner/runs/route.ts line 34: "Kein Laeufer-Profil" -- still uses non-gendered ASCII form
- [ ] BUG: /api/runner/route.ts line 49: "Kein Laeufer-Profil" -- still uses non-gendered ASCII form
- [ ] BUG: /api/runner/route.ts line 89: "Laeufer mit UID" -- still uses non-gendered ASCII form
- **FAIL**

#### AC-6: Gender -- Personenbezeichnungen Plural: Läufer*innen, Nutzer*innen
- [x] runner-assignment-table.tsx: "Nutzer*innen", "Läufer*innen" -- fixed
- [x] runner-select-dialog.tsx: "Läufer*innen", "Läufer*innenliste" -- fixed
- [x] admin/page.tsx: "Nutzer*innen mit TYPO3-Läufer*innen" -- fixed
- **PASS** (in scope of changed components)

#### AC-7: Gender -- Anredeformen in E-Mails geschlechtsinklusiv
- [x] E-Mails are managed by Supabase -- outside app control
- [x] App-side messages use neutral forms (e.g., "Hallo" or no direct address)
- **PASS**

#### AC-8: Gender -- Alle maskulinen Generica ersetzt
- [x] Most UI components have been updated
- [ ] BUG: page-header.tsx "Laeufer:" -- still masculine generic without asterisk
- [ ] BUG: Several API error messages still use "Laeufer" without asterisk (see AC-5)
- [ ] BUG: request-log-table.tsx: "Laeufer-UID" column header (line 295) -- while "UID" is technical, "Laeufer" should be "Läufer*innen" for consistency
- **FAIL**

#### AC-9: Vollstaendigkeit -- Alle sichtbaren Texte in UI-Komponenten ueberprüft
- [ ] BUG: page-header.tsx missed entirely (2 ASCII-umlaut strings)
- [ ] BUG: request-log-table.tsx missed entirely (6 ASCII-umlaut strings)
- [ ] BUG: run-form.tsx line 124 missed (1 ASCII-umlaut string)
- [ ] BUG: layout.tsx metadata missed (1 ASCII-umlaut string)
- **FAIL**

#### AC-10: Vollstaendigkeit -- Alle Toast-Notifications und Fehlermeldungen ueberprüft
- [x] strava-connect-section.tsx toast messages use correct umlauts
- [ ] BUG: API-route error messages (7+ instances) still use ASCII umlauts -- these are returned as JSON errors and shown to users in Alert components
- **FAIL**

#### AC-11: Vollstaendigkeit -- Alle Auth-bezogenen Texte ueberprüft
- [x] login-form.tsx -- fixed
- [x] reset-password-form.tsx -- fixed
- [ ] BUG: /auth/callback/route.ts: "ungueltig oder abgelaufen" -- not fixed (this is shown in the login page via query param)
- [ ] BUG: /api/auth/update-password/route.ts: 3 error messages with ASCII umlauts -- not fixed
- **FAIL**

### Edge Cases Status

#### EC-1: Kurze UI-Labels brauchen keine Genderanpassung
- [x] Button labels like "Speichern", "Abbrechen", "Weiter" are correctly left as-is
- **PASS**

#### EC-2: Technische Strings nicht angepasst
- [x] Variable names, API parameter keys, database fields remain unchanged
- [x] Code comments with ASCII umlauts are not in scope (not user-visible)
- **PASS**

#### EC-3: Eigennamen bleiben unveraendert
- [x] "Strava", "TYPO3", "Supabase" remain unchanged throughout
- **PASS**

#### EC-4: Texte von externen Systemen
- [x] Supabase Auth error codes are not modified
- [x] App-side wrappers translate/wrap external errors where possible
- **PASS**

### Security Audit Results
- [x] No security implications -- text-only changes, no functional code modifications
- [x] Build passes successfully with all changes
- [x] No new API endpoints or auth flow changes introduced

### Bugs Found

#### BUG-1: page-header.tsx still uses ASCII umlauts
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Log in and navigate to /runs
  2. Expected: Header shows "Meine Läufe" and "Läufer*in: [Name]"
  3. Actual: Header shows "Meine Laeufe" and "Laeufer: [Name]"
- **Files:** src/components/page-header.tsx lines 10, 12
- **Priority:** Fix before deployment

#### BUG-2: request-log-table.tsx still uses ASCII umlauts throughout
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Log in as admin and navigate to /admin/request-log
  2. Expected: Filter placeholder "Läufer*innen-UID filtern...", column "Läufer*innen-UID", "Einträge", "Zurück"
  3. Actual: "Laeufer-UID filtern...", "Laeufer-UID", "Eintraege", "Zurueck"
- **Files:** src/components/request-log-table.tsx lines 217, 221, 278, 295, 382, 392
- **Priority:** Fix before deployment

#### BUG-3: run-form.tsx still uses ASCII umlaut in help text
- **Severity:** Low
- **Steps to Reproduce:**
  1. Navigate to /runs/[index]/edit
  2. Expected: Help text says "...für diesen Tag..."
  3. Actual: "...fuer diesen Tag..."
- **Files:** src/components/run-form.tsx line 124
- **Priority:** Fix before deployment

#### BUG-4: layout.tsx metadata uses ASCII umlaut
- **Severity:** Low
- **Steps to Reproduce:**
  1. Check page meta description in browser dev tools
  2. Expected: "Läufe eintragen und verwalten"
  3. Actual: "Laeufe eintragen und verwalten"
- **Files:** src/app/layout.tsx line 8
- **Priority:** Fix before deployment

#### BUG-5: API error messages in multiple routes still use ASCII umlauts
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Trigger error conditions (e.g., missing runner profile, invalid input)
  2. Expected: Error messages with proper umlauts
  3. Actual: "Kein Laeufer-Profil gefunden", "Ungueltiges Request-Format", "Ungueltige Eingabe", "uebereinstimmen", "Ungueltige User-ID", "Ungueltiger JSON-Body", "ungueltig oder abgelaufen"
- **Files:**
  - src/app/api/runner/runs/route.ts lines 34, 49
  - src/app/api/runner/route.ts lines 49, 89
  - src/app/api/auth/update-password/route.ts lines 25, 54, 71
  - src/app/api/admin/users/[id]/route.ts lines 47, 58
  - src/app/auth/callback/route.ts line 85
- **Priority:** Fix before deployment

#### BUG-6: API error messages missing gender-inclusive language
- **Severity:** Low
- **Steps to Reproduce:**
  1. Trigger runner-related errors in API routes
  2. Expected: "Läufer*in-Profil", "Läufer*in mit UID..."
  3. Actual: "Laeufer-Profil", "Laeufer mit UID..."
- **Files:** Same files as BUG-5
- **Priority:** Fix before deployment

### Summary
- **Acceptance Criteria:** 4/11 passed, 7/11 failed
- **Bugs Found:** 6 total (0 critical, 0 high, 3 medium, 3 low)
- **Security:** Pass (text-only changes, no security impact)
- **Production Ready:** NO
- **Recommendation:** The implementation addressed roughly half of the codebase (the main UI components that were explicitly modified in the diff). However, page-header.tsx, request-log-table.tsx, run-form.tsx, layout.tsx, and all API route error messages were missed. Fix BUG-1 through BUG-6 before deployment.

## Deployment
_To be added by /deploy_
