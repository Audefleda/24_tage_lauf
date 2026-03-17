# PROJ-4: Läufe-Verwaltung (CRUD)

## Status: Planned
**Created:** 2026-03-17
**Last Updated:** 2026-03-17

## Dependencies
- Requires: PROJ-1 (API-Konfiguration & Superuser-Authentifizierung)
- Requires: PROJ-2 (Läufer-Auswahl)
- Requires: PROJ-3 (Läufe-Übersicht)

## User Stories
- Als Läufer möchte ich einen neuen Lauf eintragen (Datum, Distanz, ggf. weitere Felder), damit er auf der Ziel-Website erscheint.
- Als Läufer möchte ich einen bestehenden Lauf bearbeiten, falls ich etwas falsch eingetragen habe.
- Als Läufer möchte ich einen Lauf löschen, falls er versehentlich eingetragen wurde.
- Als Läufer möchte ich nach dem Speichern sofort die aktualisierte Übersicht sehen.
- Als Läufer möchte ich eine Bestätigung vor dem Löschen sehen, damit ich nicht versehentlich lösche.

## Acceptance Criteria
- [ ] Formular zum Erstellen eines neuen Laufs mit Pflichtfeldern (mindestens Datum und Distanz)
- [ ] Formular zum Bearbeiten eines bestehenden Laufs (vorausgefüllt mit bestehenden Daten)
- [ ] Löschen eines Laufs mit Bestätigungsdialog ("Wirklich löschen?")
- [ ] Validierung: Pflichtfelder müssen ausgefüllt sein, Distanz muss eine positive Zahl sein
- [ ] Nach erfolgreichem Speichern/Löschen: Rückleitung zur Übersicht + Liste wird aktualisiert
- [ ] Fehler beim API-Aufruf werden als Fehlermeldung im Formular angezeigt
- [ ] Speichern-Button zeigt Ladezustand während API-Aufruf läuft
- [ ] Abbrechen-Button kehrt zur Übersicht zurück ohne Änderungen

## Edge Cases
- Was passiert bei Netzwerkfehler während des Speicherns? → Fehlermeldung, Daten bleiben im Formular
- Was passiert, wenn die API einen Validierungsfehler zurückgibt? → API-Fehlermeldung wird angezeigt
- Was passiert, wenn zwei Nutzer gleichzeitig denselben Lauf bearbeiten? → API entscheidet, kein Offline-Konflikt-Handling nötig
- Was passiert bei ungültigem Datum (Zukunft)? → Validierung je nach API-Regeln

## Technical Requirements
- Formularvalidierung mit react-hook-form + Zod
- API-Aufrufe über Next.js Server Actions (POST, PUT/PATCH, DELETE)
- Felder richten sich nach dem tatsächlichen API-Schema (wird bei Implementierung exploriert)
- shadcn/ui Form, Input, DatePicker für das Formular

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

**Wichtig: Kein klassisches REST CRUD — "Replace-All"-Mechanismus**

Die TYPO3-API hat nur einen einzigen Schreibendpunkt (`updateruns`), der **immer das komplette Runs-Array** für einen Läufer ersetzt. Es gibt kein "füge einen Lauf hinzu" oder "lösche Lauf #3".

**API-Endpoint für alle Schreiboperationen:**
- `POST https://www.stuttgarter-kinderstiftung.de/startseite/userset.json`
- Payload (form-encoded):
  ```
  type=191
  request[extensionName]=SwitRunners
  request[pluginName]=User
  request[controller]=User
  request[action]=setdata
  request[arguments][perform]=updateruns
  request[arguments][userUid]=<uid>
  request[arguments][runs]=[{"runDate":"2026-03-17 06:00:00","runDistance":"5.5"}, ...]
  ```

**Das universelle Muster für alle Operationen:**
1. Aktuelles `runs`-Array aus dem React Context lesen
2. Array lokal modifizieren (hinzufügen / ändern / entfernen)
3. Komplettes modifiziertes Array an `updateruns` schicken
4. Bei Erfolg: Context mit aktualisierten Daten neu laden (erneuter `runnerget.json`-Call)

**Lauf-Identifikation (kein ID-Feld):**
Läufe werden über ihren **Array-Index** identifiziert. Edit und Delete erhalten den Index als Parameter.

**Datenfluss CREATE:**
1. Formular: Datum (DatePicker) + Distanz (Zahl) eingeben
2. Validierung: Datum muss gesetzt sein, Distanz > 0
3. Server Action: neuen Lauf ans Ende des Arrays anhängen → `updateruns` aufrufen
4. Erfolg → Redirect zu `/runs`, Context neu geladen

**Datenfluss EDIT (Index-basiert):**
1. Formular vorausgefüllt mit Daten des Laufs an Position `index`
2. Submit → Server Action: Array-Eintrag an `index` durch neue Daten ersetzen → `updateruns`
3. Erfolg → Redirect zu `/runs`, Context neu geladen

**Datenfluss DELETE (Index-basiert):**
1. Delete-Button mit `index` → `AlertDialog` öffnet sich
2. Bestätigung → Server Action: Array-Eintrag an `index` entfernen → `updateruns`
3. Erfolg → Context neu geladen, Tabelle aktualisiert sich

**Seiten & Komponenten:**
- `src/app/runs/new/page.tsx` — leeres Formular
- `src/app/runs/[index]/edit/page.tsx` — Formular vorausgefüllt (Index aus URL)
- `src/components/run-form.tsx` — Wiederverwendbar für Create + Edit
- `src/actions/runs.ts` — Server Action `setRuns(uid, runs[])` — die einzige Schreiboperation

**Datumsformat:**
- Eingabe im Formular: `Date` oder String `"YYYY-MM-DD"`
- Gespeichert an API: `"YYYY-MM-DD 06:00:00"` (Uhrzeit immer 06:00:00)

**Validierung (Zod-Schema):**
- `runDate`: gültiges Datum, nicht in der Zukunft
- `runDistance`: positive Dezimalzahl, > 0, max. 3 Nachkommastellen

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
