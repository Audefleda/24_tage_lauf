# PROJ-27: Rangliste (Admin)

## Status: Planned
**Created:** 2026-04-20
**Last Updated:** 2026-04-20

## Dependencies
- Requires: PROJ-2 (Anmeldung) - für Admin-Authentifizierung
- Requires: PROJ-3 (Läufe-Übersicht) - für TYPO3-Läufe-Daten-Abruf

## User Stories
- Als Administrator*in möchte ich eine Rangliste aller Läufer*innen nach Gesamtkilometern sehen, um einen schnellen Überblick über die Leistungen aller Teilnehmer*innen zu erhalten
- Als Administrator*in möchte ich zusätzlich zur Gesamtdistanz auch die Anzahl der Läufe sehen, um zu erkennen, wer regelmäßig läuft
- Als Administrator*in möchte ich auch Läufer*innen ohne Läufe in der Liste sehen, um zu erkennen, wer noch keinen Lauf eingetragen hat

## Acceptance Criteria
- [ ] Neue Seite `/rangliste` existiert und ist im Navigationsmenü zwischen "Läufe" und "Admin" sichtbar
- [ ] Die Seite ist nur für Admins zugänglich (Nicht-Admins werden auf die Startseite weitergeleitet)
- [ ] Alle TYPO3-Läufer*innen werden in einer Tabelle angezeigt
- [ ] Die Liste ist nach tatsächlich gelaufenen Gesamtkilometern absteigend sortiert (höchste Distanz zuerst)
- [ ] Angezeigt werden: Rang, Name, Gesamtkilometer, Anzahl Läufe
- [ ] Auch Läufer*innen mit 0 km werden am Ende der Liste angezeigt
- [ ] Der Rang wird automatisch basierend auf der Sortierung vergeben (1., 2., 3., ...)
- [ ] Bei gleicher Kilometeranzahl wird die Anzahl der Läufe als zweites Sortierkriterium verwendet (mehr Läufe = höherer Rang)
- [ ] Die Seite verwendet das CI-konforme Design (BettercallXPaul) und ist Dark-Mode-kompatibel
- [ ] Ladezeiten: Initiales Laden < 2 Sekunden

## Edge Cases
- Was passiert, wenn mehrere Läufer*innen exakt die gleiche Distanz UND Anzahl Läufe haben?
  → Alphabetische Sortierung nach Name als drittes Kriterium
- Was passiert, wenn kein einziger Läufer Läufe eingetragen hat?
  → Alle Läufer*innen werden mit 0 km und 0 Läufen angezeigt
- Was passiert, wenn ein Nicht-Admin versucht, die Seite direkt über die URL aufzurufen?
  → Middleware leitet zur Startseite weiter
- Was passiert, wenn die TYPO3-API nicht erreichbar ist?
  → Fehlermeldung wird angezeigt: "Rangliste konnte nicht geladen werden. Bitte versuche es später erneut."
- Wie wird die Gesamtdistanz berechnet?
  → Summe aller Läufe im Event-Zeitraum (20.04.2026 - 14.05.2026) — Läufe außerhalb des Zeitraums werden nicht gezählt

## Technical Requirements
- **Authentication:** Admin-Rolle erforderlich (app_metadata.role === 'admin')
- **Data Source:** TYPO3-API (alle Läufer*innen, alle Läufe)
- **Performance:** < 2 Sekunden Ladezeit
- **Browser Support:** Chrome, Firefox, Safari (aktuelle Versionen)
- **Responsive:** Funktioniert auf Desktop und Tablet (Mobile optional, da Admin-Funktion)

## Out of Scope
- Keine Filterfunktionen (z.B. nach Woche, Team)
- Keine Export-Funktion (CSV/PDF)
- Keine Live-Aktualisierung (User muss Seite manuell neu laden)
- Keine Detailansicht pro Läufer*in (dafür gibt es die Benutzerverwaltung)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
