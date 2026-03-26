# PROJ-19: Teams-Benachrichtigung nach Lauf-Eintrag

## Status: Planned
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
- [ ] **AC-5:** Der Header der Card zeigt in **Bold**: Läufer*innen-Name, Datum des Laufs (DD.MM.YYYY), Kilometer (z. B. „5,2 km") — Format: `Name | TT.MM.JJJJ | X,X km`
- [ ] **AC-6:** Der Body der Card enthält:
  - Zufällig ausgewählte motivierende Nachricht aus der `teams_messages`-Tabelle
  - Gesamtanzahl Läufe der Läufer*in
  - Gesamtkilometer der Läufer*in (kumuliert)
  - Gesamtkilometer des Teams BettercallPaul (Summe aller Läufer*innen)
- [ ] **AC-7:** Die motivierende Nachricht wird zufällig aus allen aktiven Einträgen der `teams_messages`-Tabelle ausgewählt
- [ ] **AC-8:** Die `teams_messages`-Tabelle enthält bei Deployment mindestens 30 Einträge (per Migration befüllt)
- [ ] **AC-9:** Die Webhook-URL wird über die Umgebungsvariable `TEAMS_WEBHOOK_URL` konfiguriert; ist sie nicht gesetzt, wird kein Fehler geworfen — das Senden wird still übersprungen
- [ ] **AC-10:** Team-Gesamtkilometer werden aus den aktuellen TYPO3-Läuferdaten berechnet (Summe von `totaldistance` aller Läufer*innen)

## Edge Cases
- `TEAMS_WEBHOOK_URL` nicht gesetzt → Funktion bricht still ab (kein Log-Error, nur Debug-Log)
- Teams-Webhook antwortet mit HTTP-Fehler (4xx/5xx) → Fehler wird geloggt (`console.error`), Lauf-Speicherung ist davon unberührt
- Netzwerkfehler beim Webhook-Call → wird gecatcht und geloggt, keine Auswirkung auf Hauptprozess
- `teams_messages`-Tabelle ist leer → Nachricht ohne motivierenden Text senden (nur Header + Statistiken)
- Läufer*in-Statistiken aus TYPO3 nicht verfügbar → Statistiken im Body weglassen oder mit „–" ersetzen, Nachricht trotzdem senden
- Mehrere Läufe gleichzeitig gespeichert (Strava-Sync) → eine Nachricht pro Lauf
- Lauf wird gelöscht → **keine** Benachrichtigung (nur bei Neu-Eintrag)

## Nachrichten-Texte (30 Einträge für DB-Migration)

1. 🏃‍♀️ Wer läuft, kommt weiter – und zwar im wahrsten Sinne des Wortes!
2. 💪 Kilometer für Kilometer näher am wohlverdienten Feierabend-Eis!
3. 🎉 Ein weiterer Lauf für den Menschen, ein riesiger Sprung für BettercallPaul!
4. 🔥 Heiß wie Asphalt im Juli – bei uns läuft es richtig!
5. 🦵 Diese Beine machen keine Pause. Na ja, außer jetzt gerade.
6. 🥇 Podium oder nicht – gelaufen ist gelaufen, und das zählt!
7. 🌟 Sterne schwitzen auch manchmal. Heute bist du der Star!
8. 🏅 Medaillenverdächtig: Wieder einen Lauf ins Ziel gebracht!
9. 😅 Laufen ist wie Fliegen, nur schwitziger und ohne Business Class.
10. 🚀 Launch der Woche: Nicht SpaceX, sondern unser*e Läufer*in!
11. 🎸 Rock'n'Roll auf dem Asphalt – dieser Lauf rockt das Team!
12. 🌈 Nach dem Lauf kommt der Kuchen. Gut gemacht, das ist verdient!
13. 🐢 Schnell oder gemütlich – egal! Hauptsache bewegt und dabei!
14. ⚡ Blitz auf Schuhen – wer kann da noch mithalten?
15. 🍕 Jeder Kilometer verdient ein Stück Pizza. Mathematisch erwiesen.
16. 🧠 Läufer*innen haben mehr graue Zellen. Und definitiv mehr Ausdauer.
17. 🌍 Schritt für Schritt die Welt verbessern – zumindest die eigene Kondition.
18. 🦸 Nicht alle Held*innen tragen Umhänge – manche tragen Laufschuhe!
19. 🐝 Fleißig wie eine Biene, schnell wie... na ja, eine rennende Biene eben.
20. 🎯 Ziel erreicht! Das nächste wartet schon ungeduldig in den Startlöchern.
21. 💃 Wer läuft, darf danach auch tanzen. Das sind die Regeln. Wir haben sie gemacht.
22. 🌞 Sonnenschein in den Beinen – wieder einen Lauf erfolgreich absolviert!
23. 🦊 Schlau genug um zu starten, stark genug um durchzuhalten!
24. 🏔️ Jeder Kilometer ist ein kleiner Gipfelsturm. Respekt, Bergsteiger*in!
25. 🍦 Ein Eis nach dem Lauf ist kein Luxus – das ist Hochleistungs-Sporternährung.
26. 🤖 KI kann vieles simulieren – aber diese Kilometer hat ein echter Mensch geschafft!
27. 🌊 Flow-State aktiviert: Läufer*in im absoluten Hochgefühl!
28. 🦩 Elegant wie ein Flamingo, ausdauernd wie ein Ochse – die perfekte Kombination!
29. 🎭 Drama: Die Beine dachten heute, sie kämen zur Ruhe. Klassischer Irrtum!
30. 🏋️ Andere heben Gewichte. Wir heben unsere Gesamtkilometer. Stärker geht nicht!

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
          { "type": "TextBlock", "text": "Name | TT.MM.JJJJ | X,X km", "weight": "Bolder", "size": "Medium" },
          { "type": "TextBlock", "text": "<motivierende Nachricht>", "wrap": true },
          { "type": "FactSet", "facts": [
            { "title": "Läufe gesamt", "value": "X" },
            { "title": "Kilometer gesamt (Läufer*in)", "value": "X,X km" },
            { "title": "Kilometer gesamt (BettercallPaul)", "value": "X,X km" }
          ]}
        ]
      }
    }]
  }
  ```

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## Implementation Notes
_To be added by /backend_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
