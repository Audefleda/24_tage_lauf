# PROJ-18: Läufer-Vorauswahl anhand E-Mail-Adresse

## Status: Planned
**Created:** 2026-03-26

## Dependencies
- Requires: PROJ-9 (Läufer-Selbstzuordnung) — erweitert den `RunnerSelectDialog` um Vorauswahl-Logik

---

## User Stories
- Als Läufer*in, die sich beim ersten Login zuordnen muss, möchte ich meinen Namen in der Liste vorausgewählt sehen, damit ich mich nicht manuell durch die Liste suchen muss.
- Als Läufer*in mit E-Mail-Adresse im Format `vorname.nachname@domain.tld` möchte ich, dass die App meinen Namen automatisch aus der E-Mail-Adresse ableitet.
- Als Läufer*in, deren Name nicht eindeutig erkannt werden kann, möchte ich die vollständige unveränderte Liste sehen und manuell wählen — ohne Fehlermeldung oder Warnung.
- Als System möchte ich eine robuste, mehrstufige Suche verwenden, damit auch Teilübereinstimmungen einen sinnvollen Vorschlag liefern.

## Acceptance Criteria
- [ ] **AC-1:** Beim Öffnen des `RunnerSelectDialog` wird die E-Mail-Adresse des eingeloggten Benutzers ausgelesen (steht bereits in der Supabase-Session)
- [ ] **AC-2:** Aus der E-Mail wird der Teil vor dem `@` extrahiert und anhand von `.` in Vorname und Nachname aufgeteilt (Format: `vorname.nachname`)
- [ ] **AC-3:** Die Matching-Logik durchläuft folgende Stufen der Reihe nach — bei erstem Treffer wird abgebrochen:
  1. **Vollständiger Name:** Suche nach `Vorname Nachname` (Leerzeichen zwischen Vor- und Nachname) — case-insensitive
  2. **Abgekürzter Nachname:** Suche nach `Vorname N.` (Nachname auf ersten Buchstaben + Punkt) — case-insensitive
  3. **Nur Vorname:** Suche nach exaktem Vornamen — case-insensitive
  4. **Substring:** Suche, ob der Vorname als Teilstring in einem Läufernamen vorkommt — case-insensitive
  5. **Kein Treffer:** kein Läufer vorausgewählt
- [ ] **AC-4:** Wird ein Treffer gefunden, ist der entsprechende Läufer im Select vorausgewählt (wie als hätte der Benutzer ihn manuell gewählt) — der Bestätigen-Button ist damit sofort aktiv
- [ ] **AC-5:** Die Vorauswahl ist eine reine UI-Hilfe — der Benutzer kann jederzeit einen anderen Läufer auswählen und bestätigen
- [ ] **AC-6:** Kann kein Treffer ermittelt werden, bleibt das Select leer (kein Vorschlag, kein Fehler, kein Hinweis)
- [ ] **AC-7:** Die Matching-Logik wird nur auf die Liste der **noch nicht vergebenen** Läufer angewendet (die bereits gefilterte Liste aus `GET /api/runner/available`)
- [ ] **AC-8:** Die gesamte Logik ist rein clientseitig — kein neuer API-Endpunkt

## Edge Cases
- E-Mail enthält keinen Punkt vor dem `@` (z. B. `max@domain.tld`) → kein Nachname ableitbar; Suche nur nach dem gesamten lokalen Teil als Vorname (Stufe 3/4)
- Lokaler Teil enthält mehr als einen Punkt (z. B. `max.mustermann.jr@domain.tld`) → erster Teil = Vorname, letzter Teil = Nachname; mittlere Teile werden ignoriert
- Mehrere Läufer treffen zu (z. B. zwei Läufer mit Vorname "Max") → erster Treffer in der alphabetisch sortierten Liste wird vorausgewählt; keine Warnung
- E-Mail-Adresse fehlt in der Session → kein Absturz, kein Vorschlag, Dialog verhält sich wie bisher
- Groß-/Kleinschreibung unterschiedlich zwischen E-Mail und TYPO3-Läufername (z. B. `max.mustermann` vs. "Max Mustermann") → Matching ist case-insensitive, Treffer wird gefunden
- Sonderzeichen / Umlaute in Namen (z. B. `mueller` vs. "Müller") → kein automatisches Umlaut-Mapping; kein Treffer bei Abweichung — Benutzer wählt manuell

## Technical Requirements
- Matching-Logik als pure Hilfsfunktion implementierbar (kein Netzwerk, kein State)
- Eingabe: Liste der verfügbaren Läufer (`{ uid, nr, name }[]`) + E-Mail-String
- Ausgabe: `uid` des vorausgewählten Läufers oder `null`
- Funktion ist unabhängig testbar

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## Implementation Notes
_To be added by /frontend_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
