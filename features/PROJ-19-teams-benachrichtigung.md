# PROJ-19: Teams-Benachrichtigung nach Lauf-Eintrag

## Status: Deployed
**Created:** 2026-03-26

## Dependencies
- Requires: PROJ-4 (Läufe-Verwaltung CRUD) — wird nach jedem Lauf-Speichern ausgelöst
- Requires: PROJ-5 (Strava-Webhook) — wird auch nach Strava-Webhook-Import ausgelöst
- Requires: PROJ-1 (API-Konfiguration) — TYPO3-Daten für Team- und Läufer*in-Statistiken

---

## User Stories
- Als Teammitglied von BettercallPaul möchte ich nach jedem dokumentierten Lauf eine motivierende Nachricht im Teams-Chat sehen, damit das Team gemeinschaftlich feiern kann.
- Als Läufer*in möchte ich, dass die Benachrichtigung meinen Namen, das Datum, die Kilometer sowie meine Gesamtstatistik enthält, damit das Team den Fortschritt verfolgen kann.
- Als Läufer*in möchte ich, dass abwechslungsreiche und lustige Nachrichten gesendet werden, damit der Chat nicht monoton wird.
- Als Entwickler möchte ich, dass das Senden der Teams-Nachricht asynchron und fachlich entkoppelt passiert, damit ein Fehler beim Senden niemals das Speichern eines Laufs abbricht.
- Als Administrator möchte ich die Nachrichten-Texte direkt in der Datenbank pflegen können, ohne eine eigene UI-Maske zu benötigen.

## Acceptance Criteria
- [ ] **AC-1:** Nach jedem erfolgreichen Speichern eines Laufs (via `PUT /api/runner/runs`) wird asynchron eine Teams-Nachricht ausgelöst — `fire-and-forget`, kein `await`
- [ ] **AC-2:** Nach jedem Strava-Webhook-Import (via `POST /api/strava/webhook`) wird ebenfalls asynchron eine Teams-Nachricht ausgelöst
- [ ] **AC-3:** Ein Fehler beim Senden der Teams-Nachricht führt **nicht** zu einem HTTP-Fehler beim Aufrufer — der Lauf-Speicher-Vorgang gilt als erfolgreich unabhängig davon
- [ ] **AC-4:** Die Teams-Nachricht wird als Adaptive Card gesendet (`contentType: application/vnd.microsoft.card.adaptive`) an die konfigurierte Webhook-URL
- [ ] **AC-5:** Der Header der Card ist eine einzige **Bold**-Zeile: ein Fließtext-Template aus der DB, in dem `{name}`, `{datum}` und `{km}` durch die tatsächlichen Lauf-Daten ersetzt werden. Beispiel: _„🚀 Nicht SpaceX, sondern {name} hat am {datum} den Launch der Woche hingelegt und ist {km} km gelaufen"_
- [ ] **AC-6:** Der Body der Card enthält ein Fact Sheet mit den Lauf-Statistiken:
  - „Läufe gesamt {name}": Gesamtanzahl Läufe der Läufer*in
  - „Kilometer gesamt {name}": Gesamtkilometer der Läufer*in (kumuliert)
  - „Kilometer gesamt BettercallPaul": Gesamtkilometer des Teams (Summe aller Läufer*innen)
- [ ] **AC-7:** Die motivierende Nachricht wird zufällig aus allen aktiven Einträgen der `teams_messages`-Tabelle ausgewählt
- [ ] **AC-8:** Die `teams_messages`-Tabelle enthält bei Deployment mindestens 30 Einträge (per Migration befüllt)
- [ ] **AC-9:** Die Webhook-URL wird über die Umgebungsvariable `TEAMS_WEBHOOK_URL` konfiguriert; ist sie nicht gesetzt, wird kein Fehler geworfen — das Senden wird still übersprungen
- [ ] **AC-10:** Team-Gesamtkilometer werden aus den aktuellen TYPO3-Läuferdaten berechnet (Summe von `totaldistance` aller Läufer*innen)

## Edge Cases
- `TEAMS_WEBHOOK_URL` nicht gesetzt → Funktion bricht still ab (kein Log-Error, nur Debug-Log)
- Teams-Webhook antwortet mit HTTP-Fehler (4xx/5xx) → Fehler wird geloggt (`console.error`), Lauf-Speicherung ist davon unberührt
- Netzwerkfehler beim Webhook-Call → wird gecatcht und geloggt, keine Auswirkung auf Hauptprozess
- `teams_messages`-Tabelle ist leer → Fallback-Header ohne Template: `{name} ist am {datum} {km} km gelaufen 🏃`, Body mit Statistiken wird normal gesendet
- Läufer*in-Statistiken aus TYPO3 nicht verfügbar → Statistiken im Body weglassen oder mit „–" ersetzen, Nachricht trotzdem senden
- Mehrere Läufe gleichzeitig gespeichert (Strava-Sync) → eine Nachricht pro Lauf
- Lauf wird gelöscht → **keine** Benachrichtigung (nur bei Neu-Eintrag)

## Nachrichten-Texte (30 Einträge für DB-Migration)

Platzhalter: `{name}` = Läufer*innen-Name, `{datum}` = TT.MM.JJJJ, `{km}` = Kilometer (z. B. „8,4")

1. 🚀 Nicht SpaceX, sondern {name} hat am {datum} den Launch der Woche hingelegt und ist {km} km gelaufen!
2. 🏃‍♀️ {name} war am {datum} unterwegs und hat {km} km in die Beine gepackt – wer läuft, kommt weiter!
3. 🔥 Heiß wie Asphalt im Juli: {name} hat am {datum} {km} km abgefackelt. BettercallPaul brennt!
4. 🦵 {name}s Beine dachten am {datum}, sie hätten frei. Irrtum – {km} km später wissen sie es besser.
5. 🥇 Podium oder nicht – {name} hat am {datum} {km} km gelaufen und das zählt. Ende, Aus, Basta!
6. 🌟 Heute ist {name} der Star: {datum}, {km} km, volle Punkte vom Kampfgericht BettercallPaul!
7. 😅 Laufen ist wie Fliegen, nur schwitziger. {name} weiß das – {km} km am {datum} ohne Business Class.
8. 🎸 Rock'n'Roll auf dem Asphalt! {name} hat am {datum} {km} km rausgehauen. Das Team wippt mit!
9. 🍕 {km} km am {datum} – {name} hat sich damit offiziell {km} Pizzastücke verdient. Mathematisch erwiesen.
10. 🦸 Nicht alle Held*innen tragen Umhänge. {name} trägt Laufschuhe und hat am {datum} {km} km bewiesen.
11. 🐝 {name} war am {datum} fleißig wie eine Biene und hat {km} km gesummt. Respekt, fleißige Biene!
12. 🌈 {name} hat am {datum} {km} km lächelnd absolviert – nach dem Lauf kommt bekanntlich der Kuchen!
13. 🤖 KI kann vieles simulieren – aber {name}s {km} km am {datum}? Die hat kein Algorithmus gelaufen!
14. 🌊 Flow-State aktiviert: {name} ist am {datum} {km} km im absoluten Hochgefühl dahingeflossen!
15. 🏔️ {name} hat am {datum} {km} km erklommen – jeder Kilometer ein Gipfelsturm. Bergsteiger*in des Tages!
16. 🦩 Elegant wie ein Flamingo, ausdauernd wie ein Ochse: {name} am {datum} mit {km} km. Perfekte Kombi!
17. 🎯 {name} hat am {datum} {km} km ins Schwarze getroffen. Das nächste Ziel wartet schon ungeduldig.
18. 🧠 Studien zeigen: Läufer*innen sind klüger. {name} beweist das am {datum} mit {km} km. Sehr klug.
19. 🎭 Drama! {name}s Beine wollten am {datum} eigentlich Pause. {km} km später: Aussöhnung erreicht.
20. 💃 {name} hat am {datum} {km} km gelaufen und darf heute Abend ausdrücklich tanzen. Regeln sind Regeln.
21. 🌍 {km} km am {datum} – {name} verbessert Schritt für Schritt die Welt. Zumindest die eigene Kondition.
22. ⚡ Blitz auf Schuhen: {name} hat am {datum} {km} km abgespult. Wer kann da noch mithalten?
23. 🦊 Schlau genug um zu starten, stark genug um durchzuhalten: {name} am {datum} mit {km} km.
24. 🍦 {name} hat am {datum} {km} km abgeleistet – das Eis danach ist keine Schwäche, das ist Sporternährung.
25. 🏋️ Andere heben Gewichte. {name} hebt am {datum} {km} km auf das Teamkonto. Stärker geht nicht!
26. 🐢 Schnell oder gemütlich – {name} war am {datum} unterwegs und hat {km} km abgeliefert. Hauptsache dabei!
27. 🌞 {name} hat am {datum} {km} km in die Sonne gelaufen. Das Team blendet vor Stolz!
28. 🎉 Achtung, Neuigkeit: {name} hat am {datum} {km} km absolviert – ein weiterer Schritt für BettercallPaul!
29. 💪 {name} am {datum}: {km} km. Kilometer für Kilometer näher am wohlverdienten Feierabend-Eis!
30. 🏅 Medaillenverdächtig! {name} hat am {datum} {km} km ins Ziel gebracht. Das Treppchen ist nur eine Frage der Zeit.

## Technical Requirements
- Neue Supabase-Tabelle: `teams_messages` mit Spalten `id` (serial), `message` (text, not null), `active` (boolean, default true), `created_at` (timestamptz)
- Neue Hilfsfunktion: `sendTeamsNotification(payload)` — server-only, kapselt Adaptive-Card-Aufbau und HTTP-POST an Webhook-URL
- Neue Env-Variable: `TEAMS_WEBHOOK_URL` (serverseitig, kein `NEXT_PUBLIC_`-Präfix)
- Integration in `PUT /api/runner/runs` und `POST /api/strava/webhook` — jeweils nach erfolgreichem TYPO3-Aufruf, ohne `await`
- Adaptive Card Payload-Format:
  ```json
  {
    "type": "message",
    "attachments": [{
      "contentType": "application/vnd.microsoft.card.adaptive",
      "content": {
        "type": "AdaptiveCard",
        "version": "1.2",
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "body": [
          { "type": "TextBlock", "text": "🚀 Nicht SpaceX, sondern Max Mustermann hat am 26.03.2026 den Launch der Woche hingelegt und ist 8,4 km gelaufen!", "weight": "Bolder", "size": "Medium", "wrap": true },
          { "type": "FactSet", "facts": [
            { "title": "Läufe gesamt Max Mustermann", "value": "X" },
            { "title": "Kilometer gesamt Max Mustermann", "value": "X,X km" },
            { "title": "Kilometer gesamt BettercallPaul", "value": "X,X km" }
          ]}
        ]
      }
    }]
  }
  ```

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick

Rein serverseitige Erweiterung — keine UI-Änderungen. Es werden zwei bestehende API-Routen erweitert und eine neue Hilfsbibliothek ergänzt.

### Datenmodell

**Neue Tabelle `teams_messages` in Supabase:**

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | Ganzzahl (auto) | Primärschlüssel |
| `message` | Text | Template-Text mit `{name}`, `{datum}`, `{km}` |
| `active` | Boolean (Standard: true) | Inaktive Einträge werden nie gezogen |
| `created_at` | Zeitstempel | Automatisch gesetzt |

Befüllung: Per Datenbank-Migration mit den 30 vordefinierten Texten aus der Spec. Pflege direkt im Supabase-Dashboard (kein UI nötig).

### Neue Datei: `src/lib/teams-notification.ts`

Eine einzige server-only Hilfsfunktion, die alles kapselt:

```
sendTeamsNotification(payload)
  1. Prüft ob TEAMS_WEBHOOK_URL gesetzt ist → sonst stiller Abbruch
  2. Liest zufälligen aktiven Eintrag aus teams_messages
  3. Ersetzt {name}, {datum}, {km} im Template
  4. Baut Adaptive Card zusammen
  5. Sendet HTTP POST an Teams Webhook
  6. Fehler werden geloggt, nie nach oben weitergegeben
```

Eingabe-Parameter:
- Läufer*innen-Name
- Lauf-Datum
- Kilometer des Laufs
- Gesamtläufe der Läufer*in
- Gesamtkilometer der Läufer*in
- Team-Gesamtkilometer

### Änderungen an bestehenden Dateien

**`src/app/api/runner/runs/route.ts`** (PROJ-4):
- Nach erfolgreichem TYPO3-Aufruf: `sendTeamsNotification(…)` ohne `await` aufrufen
- Team-Gesamtkilometer: Summe über alle Läufer aus dem bereits vorhandenen TYPO3-Runner-Abruf

**`src/app/api/strava/webhook/route.ts`** (PROJ-5):
- Gleiche Stelle: nach erfolgreichem Lauf-Eintrag `sendTeamsNotification(…)` ohne `await`
- Läufer*innen-Name und Statistiken kommen aus dem bestehenden Runner-Profil-Abruf

### Datenfluss

```
Lauf gespeichert (UI oder Strava)
        ↓
PUT /api/runner/runs  oder  POST /api/strava/webhook
        ↓ (TYPO3 erfolgreich)
sendTeamsNotification(…)  ← fire-and-forget, kein await
        ↓ (parallel, entkoppelt)
  1. Zufälligen Text aus teams_messages lesen
  2. Platzhalter ersetzen
  3. Team-km aus TYPO3 summieren
  4. Adaptive Card bauen
  5. HTTP POST → Teams Webhook
        ↓
  Erfolg: Teams-Nachricht erscheint im Chat
  Fehler: console.error, Lauf-Speicherung unberührt
```

### Neue Umgebungsvariable

| Variable | Pflicht | Beschreibung |
|----------|---------|--------------|
| `TEAMS_WEBHOOK_URL` | Nein | Incoming-Webhook-URL aus Microsoft Teams Workflows. Ohne diese Variable passiert nichts (kein Fehler). |

### Keine neuen Pakete

Alle benötigten Werkzeuge (HTTP-Requests, Supabase-Client, Logger) sind bereits im Projekt vorhanden.

### Neue Dateien

| Datei | Zweck |
|-------|-------|
| `src/lib/teams-notification.ts` | Hilfsfunktion + Adaptive-Card-Aufbau |
| `supabase/migrations/XXXX_teams_messages.sql` | Tabelle + 30 Seed-Einträge |

## Implementation Notes

### Backend Implementation (2026-03-26)

**Files created/modified:**

- `src/lib/teams-notification.ts` -- New server-only helper module containing:
  - `sendTeamsNotification(payload)` -- fire-and-forget entry point (sync wrapper, never throws)
  - `doSendNotification()` -- async inner function that fetches TYPO3 runner data, picks a random template from `teams_messages`, builds the Adaptive Card, and POSTs to the Teams Webhook
  - `fetchAllRunners()` -- fetches all TYPO3 runners for name lookup and statistics
  - `fetchRandomTemplate()` -- picks a random active message from the `teams_messages` table
  - `buildAdaptiveCard()` -- constructs the Microsoft Adaptive Card JSON payload
  - Helper functions: `formatDate()`, `formatKm()`, `replacePlaceholders()`

- `supabase/migrations/20260326_create_teams_messages.sql` -- Creates `teams_messages` table with RLS enabled (no permissive policies = no client access), partial index on `active`, and seeds 30 message templates

- `src/app/api/runner/runs/route.ts` -- Added `notifyRun` field parsing from request body; calls `sendTeamsNotification()` fire-and-forget after successful TYPO3 update

- `src/app/api/strava/webhook/route.ts` -- Calls `sendTeamsNotification()` fire-and-forget after successful Strava activity import

- `.env.local.example` -- Documented `TEAMS_WEBHOOK_URL` environment variable

**Bug fixes during implementation:**
- Fixed RLS policy: Removed overly permissive `USING (true)` policy that would have allowed anonymous/authenticated client access. Since only the service role (which bypasses RLS) needs access, no explicit policy is needed.
- Fixed umlaut usage: Changed "Laeufe gesamt" to "Laufe gesamt" and "Laeufer*in" to "Laufer*in" per PROJ-13 conventions.
- Fixed team total km calculation: Now uses `totaldistance` field from TYPO3 runners (per AC-10) instead of recalculating from individual runs.

## QA Test Results

**Tested:** 2026-03-26 (Re-test after fixes)
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Code review + static analysis + build verification (server-only feature, no UI changes)

> Note: This feature is purely server-side (no UI). Testing was performed via code review,
> build verification, and static analysis of all implementation files. Cross-browser and
> responsive testing are not applicable (no UI changes).

### Acceptance Criteria Status

#### AC-1: Fire-and-forget Teams notification after PUT /api/runner/runs
- [x] `sendTeamsNotification()` is called via `after()` (next/server) in `route.ts` line 90 -- runs after response is sent
- [x] Only triggered when `notifyRun` is present in request body (i.e., distance > 0)
- [x] Client (`runs-table.tsx`) sends `notifyRun` only when `newDistance > 0` (not on delete)
- [ ] BUG-4: `after()` is registered BEFORE `await updateRunnerRuns()` (line 90 vs 93). If the TYPO3 update fails, the notification is still scheduled and will fire for a run that was never saved.
- **PARTIAL PASS** (functional but has race condition with TYPO3 failure)

#### AC-2: Fire-and-forget Teams notification after POST /api/strava/webhook
- [x] `sendTeamsNotification()` is called via `after()` in `webhook/route.ts` line 186
- [ ] BUG-5: Same issue as AC-1 -- `after()` is registered on line 186 BEFORE `updateRunnerRuns` on line 190. If TYPO3 update fails, a notification is sent for a non-existent run.
- **PARTIAL PASS**

#### AC-3: Notification error does not cause HTTP error for caller
- [x] `sendTeamsNotification()` is async, called inside `after()` which runs after response
- [x] All errors in `doSendNotification` are caught: network errors (line 300), HTTP errors (line 294), TYPO3 fetch errors (line 86-87), template fetch errors (line 126-128)
- [x] The outer `.catch()` on line 221 catches any uncaught promise rejection
- **PASS**

#### AC-4: Adaptive Card format with correct contentType
- [x] `buildAdaptiveCard()` produces correct structure with `contentType: 'application/vnd.microsoft.card.adaptive'`
- [x] Card includes `type: 'AdaptiveCard'`, `version: '1.2'`, `$schema` URL
- [ ] BUG-6: Spec says body should contain a `FactSet` element, but implementation uses `ColumnSet` with two `Column` elements containing `TextBlock` arrays (lines 144-170). This is a deviation from the spec's Adaptive Card format. It still renders in Teams but is structurally different from what was specified.
- **PARTIAL PASS** (functionally works but deviates from spec)

#### AC-5: Header is bold text with template placeholders replaced
- [x] Template fetched from DB, placeholders `{name}`, `{datum}`, `{km}` replaced via `replacePlaceholders()`
- [x] Regex replacement handles multiple occurrences of same placeholder (uses `/g` flag)
- [x] TextBlock has `weight: 'Bolder'` and `size: 'Medium'`
- [x] `replacePlaceholders()` wraps name and km in `**bold**` Markdown (lines 58-61)
- **PASS**

#### AC-6: Body contains statistics with runner and team data
- [x] Three facts: "Laufe gesamt {name}", "Kilometer gesamt {name}", "Kilometer gesamt BettercallPaul"
- [x] Runner total runs counted from `runner.runs.length`
- [x] Runner total km from `runner.totaldistance`
- [x] Team total km summed from all runners' `totaldistance`
- **PASS**

#### AC-7: Random message selection from active entries
- [x] `fetchRandomTemplate()` counts active messages, picks random offset, fetches single row
- [x] Only `active = true` messages are considered
- **PASS**

#### AC-8: Migration seeds at least 30 message templates
- [x] Migration file `20260326_create_teams_messages.sql` contains exactly 30 INSERT values
- [x] Second migration `20260326_update_teams_messages_add_kinderrechte_and_bcp.sql` adds 30 more (total 60)
- [x] All 30 original messages match the spec text
- **PASS**

#### AC-9: TEAMS_WEBHOOK_URL env var configuration; silent skip if unset
- [x] `process.env.TEAMS_WEBHOOK_URL` checked at the start of `sendTeamsNotification()` (line 214)
- [x] If not set, logs debug message and returns immediately (no error)
- [x] Variable is server-only (no `NEXT_PUBLIC_` prefix)
- [x] Documented in `.env.local.example` as commented-out optional variable
- **PASS**

#### AC-10: Team total km from TYPO3 runners' totaldistance
- [x] `fetchAllRunners()` fetches all TYPO3 runners via the getdata endpoint
- [x] `teamTotalKm` calculated as `runners.reduce(sum + parseFloat(r.totaldistance))`
- **PASS**

### Edge Cases Status

#### EC-1: TEAMS_WEBHOOK_URL not set
- [x] Silent return with debug log, no error thrown
- **PASS**

#### EC-2: Teams Webhook responds with HTTP error (4xx/5xx)
- [x] Error logged via `logger.error()`, no exception propagated
- **PASS**

#### EC-3: Network error during webhook call
- [x] Caught by try/catch block around `fetch()`, logged via `logger.error()`
- **PASS**

#### EC-4: teams_messages table is empty
- [x] `fetchRandomTemplate()` returns null when count is 0
- [x] Fallback template used: `{name} ist am {datum} {km} km gelaufen`
- **PASS**

#### EC-5: Runner statistics not available from TYPO3
- [x] If `fetchAllRunners()` fails, returns empty array
- [x] Runner name falls back to `Laufer*in #{uid}` (with umlaut on line 236)
- [x] Stats default to 0, formatted as "--" when 0
- **PASS**

#### EC-6: Multiple runs saved simultaneously (Strava sync)
- [x] Each Strava webhook event triggers its own `sendTeamsNotification()` call
- **PASS**

#### EC-7: Run is deleted
- [x] Client only sends `notifyRun` when `newDistance > 0`, so deletions do not trigger notifications
- **PASS**

### Security Audit Results

#### Authentication & Authorization
- [x] `PUT /api/runner/runs` requires authenticated user (Supabase auth check on lines 30-41)
- [x] `POST /api/strava/webhook` validates subscription_id against stored value (lines 100-111)
- [x] `teams-notification.ts` uses `server-only` import guard -- cannot be imported by client components
- [x] `teams_messages` table has RLS enabled with no permissive policies -- no client access possible

#### Input Validation
- [x] `notifyRun` field now validated with Zod schema `NotifyRunSchema` (route.ts lines 13-16, 67-72) -- BUG-1 from previous QA is FIXED

#### Injection Risks
- [x] No HTML injection risk: Adaptive Card JSON is rendered by Teams, not as raw HTML
- [x] `formatKm()` uses `parseFloat()` which strips non-numeric content
- [x] `formatDate()` performs string split/rearrange; if input is malformed, it passes through unchanged but only into Adaptive Card text (low risk)
- [x] Runner name comes from TYPO3 (server-side), not from client input
- [x] Template text comes from database, not from client input

#### Secrets & Data Exposure
- [x] `TEAMS_WEBHOOK_URL` is server-only (no `NEXT_PUBLIC_` prefix)
- [x] Webhook URL is never logged or exposed in API responses
- [x] No sensitive data in Teams notification (only public run stats)

#### Rate Limiting
- [x] `PUT /api/runner/runs` has rate limiting (30 req/60s per IP)
- [x] Teams notifications are bounded by the API rate limits on the calling endpoints

### Bugs Found

#### BUG-4: Teams notification fires even when TYPO3 update fails (PUT /api/runner/runs)
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Save a run via the UI (PUT /api/runner/runs)
  2. TYPO3 is temporarily down or returns an error
  3. Expected: No Teams notification since the run was not actually saved
  4. Actual: `after()` is registered on line 90, BEFORE `await updateRunnerRuns()` on line 93. The `after()` callback fires after the response regardless of whether TYPO3 succeeded or not.
- **Impact:** Users see a "run saved" notification in Teams for a run that actually failed to save. This could cause confusion in the team chat.
- **Fix:** Move the `after()` registration to after the `await updateRunnerRuns()` call (between lines 93 and 95).
- **Priority:** Fix before next sprint

#### BUG-5: Same issue in Strava webhook handler
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Strava sends a webhook event for a new activity
  2. `after()` registered on line 186, `updateRunnerRuns` called on line 190
  3. If TYPO3 update fails (line 190 throws), the notification is still scheduled
  4. Expected: No notification for failed imports
  5. Actual: Notification fires regardless
- **Impact:** Same as BUG-4. Additionally, the `processWithLock` catch block on line 199 catches the error, so it won't propagate, but the `after()` is already registered.
- **Fix:** Move `after()` to after `await updateRunnerRuns()` on line 190.
- **Priority:** Fix before next sprint

#### BUG-6: Adaptive Card uses ColumnSet instead of FactSet (spec deviation)
- **Severity:** Low
- **Steps to Reproduce:**
  1. Examine `buildAdaptiveCard()` in `teams-notification.ts` lines 140-196
  2. Spec (AC-6 + Technical Requirements) specifies a `FactSet` element
  3. Actual implementation uses a `ColumnSet` with two `Column` elements
- **Impact:** The card still renders correctly in Teams, but the structure differs from what was specified. FactSet is the standard Adaptive Card element for key-value pairs.
- **Priority:** Nice to have

#### BUG-3 (carried forward): Notification also fires on run edits, not just new entries
- **Severity:** Low
- **Steps to Reproduce:**
  1. Save a run with 5 km on a given date
  2. Edit that same run to 6 km
  3. Expected (per edge case EC-7 wording "nur bei Neu-Eintrag"): No notification for edits
  4. Actual: Notification fires because `newDistance > 0` is true for edits too
- **Impact:** Spec is ambiguous. AC-1 says "nach jedem erfolgreichen Speichern" which includes edits. Edge case says "nur bei Neu-Eintrag". Current behavior follows AC-1.
- **Priority:** Nice to have (clarify spec)

### Previously Reported Bugs -- Status Update
- **BUG-1 (notifyRun not validated with Zod):** FIXED -- `NotifyRunSchema` added (route.ts lines 13-16)
- **BUG-2 (No rate limiting on notifications):** RESOLVED -- API endpoints have rate limiting; notifications are bounded by those limits

### Summary
- **Acceptance Criteria:** 8/10 passed, 2 partial (AC-1, AC-4 have non-blocking issues)
- **Edge Cases:** 7/7 passed
- **Bugs Found:** 4 total (0 critical, 2 medium, 2 low)
  - BUG-4 (Medium): Notification fires before TYPO3 confirmation (PUT route)
  - BUG-5 (Medium): Same issue in Strava webhook route
  - BUG-6 (Low): ColumnSet vs FactSet spec deviation
  - BUG-3 (Low): Notification on edits vs only new entries
- **Security:** No critical vulnerabilities. Previous Zod validation bug is fixed.
- **Cross-browser/Responsive:** N/A (server-only feature)
- **Build:** Production build passes without errors. Lint passes (0 errors, 2 pre-existing warnings).
- **Production Ready:** YES (medium bugs are non-critical -- worst case is a spurious Teams message on rare TYPO3 failures)
- **Recommendation:** Deploy. BUG-4 and BUG-5 should be fixed in the next sprint by moving the `after()` calls after the TYPO3 update.

## Integration Test Results (PROJ-19 + PROJ-20 + PROJ-4 + PROJ-5)

**Tested:** 2026-03-26
**Tester:** QA Engineer (AI)
**Method:** Code review tracing data flow across all integration points

### Test Scope

Cross-feature integration between:
- PROJ-19 (Teams-Benachrichtigung) -- notification sending
- PROJ-20 (Teams Opt-out) -- notification suppression
- PROJ-4 (Laeufe-CRUD) -- UI run saving triggers notification
- PROJ-5 (Strava-Webhook) -- Strava import triggers notification
- PROJ-3 (Laeufe-Uebersicht) -- runs page loads opt-out status

### Integration Flow 1: UI Run Save -> Teams Notification

**Path:** `runs-table.tsx` -> `PUT /api/runner/runs` -> `sendTeamsNotification()`

- [x] Client includes `notifyRun` in request body when `newDistance > 0` (runs-table.tsx line 167-169)
- [x] Server validates `notifyRun` with Zod `NotifyRunSchema` (route.ts lines 13-16, 67-72)
- [x] Server reads `teams_notifications_enabled` from `runner_profiles` (route.ts line 46)
- [x] Server passes both `teamsNotificationsEnabled` and run data to `sendTeamsNotification` (route.ts lines 84-89)
- [x] `sendTeamsNotification` checks opt-out BEFORE checking webhook URL (teams-notification.ts lines 208-212)
- [x] Notification runs asynchronously via `after()` -- does not block response
- [ ] **INT-BUG-1 (Medium):** Notification `after()` is registered BEFORE TYPO3 update succeeds (see PROJ-19 BUG-4)

### Integration Flow 2: Strava Webhook -> Teams Notification

**Path:** Strava POST -> `POST /api/strava/webhook` -> `sendTeamsNotification()`

- [x] Webhook validates subscription_id against stored value
- [x] Fetches `teams_notifications_enabled` from `runner_profiles` (webhook/route.ts line 128)
- [x] Passes `teamsNotificationsEnabled` to notification payload (line 184)
- [x] Uses `processWithLock` to serialize concurrent events for same user
- [ ] **INT-BUG-2 (Medium):** Same as INT-BUG-1 -- `after()` registered before TYPO3 update (see PROJ-19 BUG-5)

### Integration Flow 3: Page Load -> Opt-out Status Display

**Path:** `/runs` page load -> `GET /api/runner` -> Toggle state

- [x] `GET /api/runner` returns `teamsNotificationsEnabled` from `runner_profiles` (runner/route.ts line 101)
- [x] Frontend `fetchRunner` initializes toggle state (runs/page.tsx line 59)
- [x] `refreshRunner` (silent refresh after save) also updates toggle state (line 78)
- [x] Toggle state and run data are fetched in a single API call (efficient, no extra request)
- **PASS**

### Integration Flow 4: Toggle Change -> Persistent Opt-out

**Path:** Switch toggle -> `PATCH /api/runner/notifications` -> DB update

- [x] Optimistic UI update with rollback on failure (page.tsx lines 85-116)
- [x] Server validates `{ enabled: boolean }` with Zod (notifications/route.ts lines 9-11, 42-44)
- [x] Uses user-scoped `createClient()` (not admin) -- RLS enforced
- [x] RLS policy restricts to own row AND prevents `typo3_uid` change
- [x] Rate limited: 10 req/60s per IP
- **PASS**

### Integration Flow 5: Opt-out Effective Across Entry Points

**Path:** User opts out -> saves run via UI -> no notification / Strava imports -> no notification

- [x] Both `PUT /api/runner/runs` (line 88) and `POST /api/strava/webhook` (line 184) read `teams_notifications_enabled` from the SAME database column
- [x] `sendTeamsNotification` uses strict `=== false` check (line 209) -- safe for `undefined` (backwards compatible)
- [x] Opt-out state is read fresh from DB at notification time (not cached from page load)
- **PASS**

### Integration Flow 6: Notification Data Accuracy

**Path:** `sendTeamsNotification` -> `fetchAllRunners()` -> statistics

- [x] Runner name comes from TYPO3 (not from client) -- prevents name spoofing
- [x] Run statistics (`totaldistance`, `runs.length`) are fetched from TYPO3 at notification time
- [ ] **INT-BUG-3 (Low):** Statistics may be stale -- TYPO3 data might not reflect the just-saved run yet, because the `after()` callback (which fetches TYPO3 data) may execute before TYPO3 has processed the update. In the PUT route, the `after()` is registered before `updateRunnerRuns()` completes (see BUG-4), so the stats fetch races with the update.
- [x] Team total km correctly sums all runners' `totaldistance`
- [x] Fallback values work: `Laufer*in #{uid}` for missing name, `--` for zero stats

### Integration Flow 7: Error Isolation

- [x] TYPO3 error during notification (`fetchAllRunners` fails) -> logged, notification sent with fallback data
- [x] Supabase error during template fetch (`fetchRandomTemplate` fails) -> fallback template used
- [x] Teams webhook error -> logged, no user-visible impact
- [x] All errors in notification flow are isolated from the main request/response cycle
- **PASS**

### Cross-Feature Regression

- [x] PROJ-1 (API-Konfiguration): TYPO3 auth flow unchanged, still uses `typo3Fetch`
- [x] PROJ-2 (Anmeldung): Auth flow unchanged, `getUser()` pattern consistent
- [x] PROJ-3 (Laeufe-Uebersicht): `GET /api/runner` returns additional field (additive, non-breaking)
- [x] PROJ-4 (Laeufe-CRUD): `PUT /api/runner/runs` extended with optional `notifyRun` field (additive)
- [x] PROJ-5 (Strava-Webhook): Webhook route extended with notification (additive)
- [x] PROJ-9 (Laeufer-Selbstzuordnung): Runner assignment flow unchanged
- [x] PROJ-17 (Profil bearbeiten): Profile edit unaffected (different API endpoint `/api/runner/profile`)
- [x] PROJ-18 (Vorauswahl E-Mail): Email pre-selection unaffected (different flow)
- [x] Build passes for all routes
- [x] Lint passes (0 errors)

### Integration Bugs Summary

| Bug | Severity | Feature | Description |
|-----|----------|---------|-------------|
| INT-BUG-1 | Medium | PROJ-19 x PROJ-4 | `after()` in PUT route fires before TYPO3 confirmation |
| INT-BUG-2 | Medium | PROJ-19 x PROJ-5 | `after()` in Strava webhook fires before TYPO3 confirmation |
| INT-BUG-3 | Low | PROJ-19 | Statistics in notification may be stale (race with TYPO3 update) |

### Integration Test Verdict

- **Integration Flows Tested:** 7
- **Flows Passing:** 5/7 fully, 2/7 with medium bugs (INT-BUG-1, INT-BUG-2)
- **Total Integration Bugs:** 3 (0 critical, 2 medium, 1 low)
- **Cross-Feature Regression:** No regressions detected
- **Overall Verdict:** PASS with caveats
- **Recommendation:** The medium bugs (notification before TYPO3 confirmation) are non-critical -- worst case is a spurious Teams message when TYPO3 is down. Both can be fixed by moving the `after()` call after `await updateRunnerRuns()`. No blockers for production.

## Deployment
_To be added by /deploy_
