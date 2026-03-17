# PROJ-4: Läufe-Verwaltung (CRUD)

## Status: In Review
**Created:** 2026-03-17
**Last Updated:** 2026-03-17

### Frontend Implementation Notes (Inline-Edit Redesign 2026-03-17)
- **Inline editing:** Distance column in runs-table.tsx is now an editable `<Input>` per row (no separate edit screen)
- **Auto-save on blur:** When the user leaves an input field, the value is validated and saved via PUT /api/runner/runs
- **Per-row feedback:** Each row shows spinner (saving), green check (success, 2s), or red error icon + message (error)
- **Toast notifications:** Sonner toast on success ("Lauf gespeichert" / "Lauf entfernt") and error
- **Validation:** Client-side: empty/0 = remove run, positive decimal with max 3 decimal places, German comma input supported
- **Error recovery:** On save failure, the original value is restored in the input
- **Keyboard support:** Enter triggers blur (save), Escape restores original value and blurs
- **Stats refresh:** After successful save, parent page silently re-fetches data to update StatsCard
- **Removed separate edit page:** `/runs/[index]/edit` now redirects to `/runs`; `/runs/new` was already a redirect
- **run-form.tsx:** No longer used by any page (kept for reference but could be deleted)
- **Files changed:** `src/components/runs-table.tsx`, `src/app/runs/page.tsx`, `src/app/runs/[index]/edit/page.tsx`

## Dependencies
- Requires: PROJ-1 (API-Konfiguration & Superuser-Authentifizierung)
- Requires: PROJ-2 (Läufer-Auswahl)
- Requires: PROJ-3 (Läufe-Übersicht)

## User Stories
- Als Läufer möchte ich die Distanz direkt in der Tabellenzeile eingeben können, ohne einen separaten Screen aufrufen zu müssen.
- Als Läufer möchte ich, dass meine Eingabe automatisch gespeichert wird wenn ich das Feld verlasse, damit ich nicht aktiv auf "Speichern" klicken muss.
- Als Läufer möchte ich sofort visuelles Feedback sehen ob das Speichern erfolgreich war oder fehlgeschlagen ist.
- Als Läufer möchte ich einen Lauf löschen können, indem ich 0 oder leer einträgt — kein separater Löschvorgang nötig.

## Acceptance Criteria
- [ ] Jede Zeile der Eventliste enthält ein direkt editierbares Distanzfeld (kein separater Edit-Screen)
- [ ] Das Distanzfeld ist vorausgefüllt mit der aktuellen Distanz (leer wenn kein Lauf eingetragen)
- [ ] Beim Verlassen des Feldes (onBlur) wird automatisch gespeichert — kein "Speichern"-Button nötig
- [ ] Während des Speicherns zeigt die Zeile einen Ladezustand (z.B. Spinner oder gedimmte Zeile)
- [ ] Bei erfolgreichem Speichern: kurze Erfolgsanzeige (z.B. grüner Haken, Toast)
- [ ] Bei Fehler (z.B. TYPO3 lehnt ab): Fehlermeldung direkt in/unter der Zeile, Wert wird zurückgesetzt
- [ ] Validierung: Distanz muss leer, 0 oder eine positive Dezimalzahl sein
- [ ] Leer oder 0 eintragen entfernt den Lauf effektiv (kein separater "Löschen"-Button)
- [ ] Kein separater Edit-Screen mehr — `/runs/[index]/edit` entfällt
- [ ] **Datenisolation (Sicherheit):** Die `typo3_uid` des Läufers wird ausschließlich serverseitig aus dem Supabase-Profil des eingeloggten Nutzers gelesen — niemals vom Client übernommen
- [ ] **Nur eigene Läufe:** Das an TYPO3 übertragene Runs-Array enthält ausschließlich die Läufe des aktuell eingeloggten Läufers — niemals Daten anderer Läufer

## Edge Cases
- Was passiert wenn der Nutzer schnell mehrere Felder hintereinander verlässt? → Speicherungen laufen sequenziell oder das letzte gewinnt (kein Race Condition-Problem, da TYPO3 immer das komplette Array ersetzt)
- Was passiert bei ungültigem Wert (z.B. Buchstaben)? → Validierung verhindert Speichern, Fehlermeldung in der Zeile
- Was passiert bei Netzwerkfehler? → Fehlermeldung in der Zeile, alter Wert wird wiederhergestellt
- Was passiert wenn TYPO3 `success: false` zurückgibt? → Fehlermeldung aus `message`-Feld wird angezeigt, alter Wert wiederhergestellt
- Was passiert wenn ein Nutzer keine `typo3_uid` im Profil hat? → Schreiboperation wird blockiert, Fehlermeldung "Kein Läufer zugeordnet"

## Edge Cases
- Was passiert bei Netzwerkfehler während des Speicherns? → Fehlermeldung, Daten bleiben im Formular
- Was passiert, wenn die API einen Validierungsfehler zurückgibt? → API-Fehlermeldung wird angezeigt
- Was passiert bei 0 km? → Eintrag wird aus dem TYPO3-Array entfernt (oder als 0 gespeichert, je nach API-Verhalten)
- Was passiert, wenn ein Nutzer keine `typo3_uid` im Profil hat? → Schreiboperation wird blockiert, Fehlermeldung "Kein Läufer zugeordnet"
- Was passiert, wenn der Client eine fremde UID mitschickt? → Server ignoriert sie, verwendet immer die UID aus dem Supabase-Session-Profil
- Was passiert, wenn jemand per URL einen Index außerhalb des Event-Zeitraums aufruft? → 404 oder Redirect zur Übersicht

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

**Sicherheitsprinzip: Datenisolation**

Die `typo3_uid` darf **niemals** vom Client kommen. Das serverseitige Muster ist immer:
1. Supabase-Session des eingeloggten Nutzers prüfen (via `createClient()` auf dem Server)
2. `typo3_uid` aus `runner_profiles` für diese Session-User-ID lesen
3. TYPO3-API mit dieser serverseitig ermittelten UID aufrufen
4. Client kann keine UID mitschicken — der Request-Body enthält nur die Lauf-Daten

**Das universelle Muster für alle Operationen:**
1. Aktuelle Läufe via `runnerget.json` für die **serverseitig ermittelte** `typo3_uid` abrufen
2. Runs-Array lokal modifizieren (hinzufügen / ändern / entfernen)
3. Komplettes modifiziertes Array mit der **serverseitigen** UID an `updateruns` schicken
4. Bei Erfolg: Seite neu laden (erneuter `runnerget.json`-Call)

**Inline-Editing direkt in der Tabelle (kein separater Screen):**
Die Distanzspalte in der Eventtabelle (PROJ-3) enthält direkt editierbare Eingabefelder. Es gibt keine separate Edit-Seite mehr. `/runs/[index]/edit` entfällt.

**Datenfluss Inline-Edit:**
1. Nutzer klickt in das Distanzfeld einer Tabellenzeile
2. Nutzer gibt Distanz ein (oder leert das Feld für "kein Lauf")
3. Beim Verlassen des Feldes (onBlur): Validierung → PUT `/api/runner/runs`
4. Während Speichern: Zeile zeigt Ladezustand
5. Erfolg: kurze Erfolgsanzeige (Toast oder grüner Haken), Statistiken aktualisieren sich
6. Fehler: Fehlermeldung in/unter der Zeile, ursprünglicher Wert wird wiederhergestellt

**"Löschen" = leer oder 0 eintragen:**
Kein separater Delete-Button. Leeres Feld oder 0 km = Lauf wird aus dem Array entfernt.

**Seiten & Komponenten:**
- `src/app/runs/page.tsx` — enthält jetzt die Tabelle mit Inline-Inputs (PROJ-3 + PROJ-4 verschmelzen in einer Seite)
- `src/components/runs-table.tsx` — Distanzspalte als editierbares `<input>` statt reiner Text
- `src/app/runs/[index]/edit/page.tsx` — **entfällt**
- `src/components/run-form.tsx` — **entfällt**

**Datumsformat:**
- Angezeigt: Wochentag + Datum (z.B. "Mo, 20.04.2026")
- Gespeichert an API: `"YYYY-MM-DD 06:00:00"` (Uhrzeit immer 06:00:00)

**Event-Zeitraum (Konstante):**
- Start: 20.04.2026
- Ende: 14.05.2026
- 25 Tage

**Validierung (Zod-Schema):**
- `runDistance`: Dezimalzahl ≥ 0, max. 3 Nachkommastellen (0 erlaubt = Lauf löschen)

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
