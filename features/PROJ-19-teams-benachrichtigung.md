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

**Tested:** 2026-03-26
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Code review + static analysis (server-only feature, no UI changes)

> Note: This feature is purely server-side (no UI). Testing was performed via code review,
> build verification, and static analysis of all implementation files. Cross-browser and
> responsive testing are not applicable (no UI changes).

### Acceptance Criteria Status

#### AC-1: Fire-and-forget Teams notification after PUT /api/runner/runs
- [x] `sendTeamsNotification()` is called without `await` in `route.ts` line 66
- [x] Only triggered when `notifyRun` is present in request body (i.e., distance > 0)
- [x] Client (`runs-table.tsx`) sends `notifyRun` only when `newDistance > 0` (not on delete)
- **PASS**

#### AC-2: Fire-and-forget Teams notification after POST /api/strava/webhook
- [x] `sendTeamsNotification()` is called without `await` in `webhook/route.ts` line 190
- [x] Called after successful TYPO3 update and last_synced_at update
- **PASS**

#### AC-3: Notification error does not cause HTTP error for caller
- [x] `sendTeamsNotification()` is synchronous (returns void), calls async `doSendNotification` with `.catch()` handler
- [x] All errors in `doSendNotification` are caught: network errors (line 267), HTTP errors (line 261), TYPO3 fetch errors (line 89-92), template fetch errors (line 128-130)
- [x] The outer `.catch()` on line 188 catches any uncaught promise rejection
- **PASS**

#### AC-4: Adaptive Card format with correct contentType
- [x] `buildAdaptiveCard()` produces correct structure with `contentType: 'application/vnd.microsoft.card.adaptive'`
- [x] Card includes `type: 'AdaptiveCard'`, `version: '1.2'`, `$schema` URL
- [x] Body contains TextBlock (header) and FactSet (statistics)
- **PASS**

#### AC-5: Header is bold text with template placeholders replaced
- [x] Template fetched from DB, placeholders `{name}`, `{datum}`, `{km}` replaced via `replacePlaceholders()`
- [x] Regex replacement handles multiple occurrences of same placeholder (uses `/g` flag)
- [x] TextBlock has `weight: 'Bolder'` and `size: 'Medium'`
- **PASS**

#### AC-6: Body contains FactSet with runner and team statistics
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
- [x] All 30 messages match the spec text
- **PASS**

#### AC-9: TEAMS_WEBHOOK_URL env var configuration; silent skip if unset
- [x] `process.env.TEAMS_WEBHOOK_URL` checked at the start of `sendTeamsNotification()`
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
- [x] Runner name falls back to `Laufer*in #{uid}`
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
- [x] `PUT /api/runner/runs` requires authenticated user (Supabase auth check on line 14-24)
- [x] `POST /api/strava/webhook` validates subscription_id against stored value (line 100-111)
- [x] `teams-notification.ts` uses `server-only` import guard -- cannot be imported by client components
- [x] `teams_messages` table has RLS enabled with no permissive policies -- no client access possible

#### Input Validation
- [ ] **BUG-1:** `notifyRun` field in PUT /api/runner/runs is validated only with basic `typeof` checks (line 50), not with a Zod schema. The `runDate` and `runDistance` values are client-controlled strings that flow into the Teams notification. While `formatKm()` sanitizes via `parseFloat()` and `formatDate()` via string splitting, the lack of Zod validation is inconsistent with the project's security rules (`.claude/rules/security.md`: "Validate ALL user input on the server side with Zod").

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
- [ ] **BUG-2:** No rate limiting on Teams webhook calls. A malicious or buggy client could rapidly save/update runs, triggering many Teams notifications. Each notification also makes a TYPO3 API call (`fetchAllRunners`). While the fire-and-forget pattern limits server impact, it could lead to Teams rate limiting or TYPO3 overload.

### Bugs Found

#### BUG-1: notifyRun field not validated with Zod schema
- **Severity:** Low
- **Steps to Reproduce:**
  1. Send a PUT request to `/api/runner/runs` with an authenticated session
  2. Include `notifyRun: { runDate: "arbitrary-string", runDistance: "arbitrary-string" }`
  3. Expected: Input validated with Zod schema per project security rules
  4. Actual: Only `typeof === 'string'` checks performed, values pass through to notification
- **Impact:** Low practical impact since values are sanitized by `formatKm()`/`formatDate()` before use, and output goes to a Teams Adaptive Card (no HTML/XSS). However, this violates the project's security conventions.
- **Priority:** Fix in next sprint

#### BUG-2: No rate limiting on Teams notifications
- **Severity:** Low
- **Steps to Reproduce:**
  1. Rapidly save multiple runs in quick succession (e.g., via API)
  2. Each save triggers a separate `sendTeamsNotification()` call
  3. Each notification call also triggers `fetchAllRunners()` to TYPO3
  4. Expected: Some form of debouncing or rate limiting
  5. Actual: No throttling; all notifications fire independently
- **Impact:** Low for normal use (5-30 users). Could become an issue if a user rapidly edits runs or if the Strava webhook receives a burst of events. Teams itself has rate limits that could cause silent failures.
- **Priority:** Nice to have (consider for future hardening)

#### BUG-3: Notification also fires on run edits, not just new entries
- **Severity:** Low
- **Steps to Reproduce:**
  1. Save a run with 5 km on a given date
  2. Edit that same run to 6 km
  3. Expected (per edge case EC-7 wording "nur bei Neu-Eintrag"): No notification for edits
  4. Actual: Notification fires because `newDistance > 0` is true for edits too
- **Impact:** The spec is ambiguous. AC-1 says "nach jedem erfolgreichen Speichern" (after every save) which includes edits. But the edge case parenthetical "(nur bei Neu-Eintrag)" suggests only new entries. Current behavior follows AC-1, which is arguably correct. The team should clarify intent.
- **Priority:** Nice to have (clarify spec, then decide)

### Summary
- **Acceptance Criteria:** 10/10 passed
- **Edge Cases:** 7/7 passed
- **Bugs Found:** 3 total (0 critical, 0 high, 0 medium, 3 low)
- **Security:** No critical vulnerabilities found. Minor observations noted (Zod validation, rate limiting).
- **Cross-browser/Responsive:** N/A (server-only feature, no UI changes)
- **Build:** Production build passes without errors
- **Production Ready:** YES
- **Recommendation:** Deploy. All 3 low-severity bugs are non-blocking and can be addressed in a future sprint.

## Deployment
_To be added by /deploy_
