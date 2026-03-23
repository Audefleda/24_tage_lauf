# PROJ-12: Debug-Logging

## Status: Planned
**Created:** 2026-03-23
**Last Updated:** 2026-03-23

## Dependencies
- None (querschnittliche Anforderung — gilt für alle Backend-Features)

## User Stories
- Als Administrator möchte ich ein erweitertes Logging aktivieren können, um bei Problemen die genaue Kommunikation zwischen der App und externen Diensten nachvollziehen zu können.
- Als Administrator möchte ich das Debug-Logging ohne Code-Änderung ein- und ausschalten können, damit ich es im Problemfall schnell aktivieren und danach wieder deaktivieren kann.
- Als Entwickler möchte ich im Debug-Modus vollständige Anfrage- und Antwort-Details sehen, damit ich Integrationsprobleme analysieren kann.

## Acceptance Criteria
- [ ] **AC-1:** Es gibt eine Env-Variable `LOG_LEVEL` (Werte: `debug` oder leer/nicht gesetzt = normaler Betrieb)
- [ ] **AC-2:** `LOG_LEVEL=debug` kann im Vercel Dashboard (Settings → Environment Variables) gesetzt und durch einen Redeploy aktiviert werden — kein Code-Change nötig
- [ ] **AC-3:** Im normalen Betrieb (`LOG_LEVEL` nicht gesetzt) werden nur Fehler geloggt — kein zusätzliches Rauschen in den Vercel Logs
- [ ] **AC-4:** Im Debug-Modus werden alle relevanten Schritte der externen Kommunikation geloggt (siehe Debug-Ausgaben je Feature unten)
- [ ] **AC-5:** Debug-Ausgaben sind einheitlich formatiert: `[DEBUG][Modul] Beschreibung: {daten}`
- [ ] **AC-6:** Sensible Daten (Passwörter, vollständige Access-Tokens) werden in Debug-Ausgaben niemals im Klartext ausgegeben — Tokens werden auf die ersten 8 Zeichen gekürzt (z.B. `abc12345...`)

## Debug-Ausgaben je Feature

### PROJ-1 — TYPO3 Authentifizierung
- Login-Versuch gestartet (URL, E-Mail maskiert)
- Login-Formular erfolgreich geladen (Anzahl gefundener Felder)
- Login-POST abgeschickt (Ziel-URL)
- Login erfolgreich / fehlgeschlagen (Cookie gesetzt oder nicht)
- Re-Login ausgelöst (wegen HTTP-Status X)
- Token-Cache invalidiert

### PROJ-4 / PROJ-8 — TYPO3 Runs Update
- PUT-Anfrage an TYPO3 gestartet (Runner-UID, Anzahl Läufe)
- HTTP-Status der TYPO3-Antwort
- TYPO3-Antwort-Body (vollständig, da kein Geheimnis)

### PROJ-5 — Strava-Integration
- OAuth-Flow gestartet (User-ID, OAuth-URL ohne Secrets)
- OAuth-Callback empfangen (Athlete-ID, Scopes)
- Token-Refresh ausgelöst (User-ID, Grund: Token läuft ab)
- Token-Refresh erfolgreich (neue `expires_at`)
- Webhook-Event empfangen (vollständiger Body)
- Aktivitätsdetails abgerufen (Activity-ID, Typ, Distanz, Datum)
- Aktivitätstyp ignoriert (Typ, Grund)
- Webhook-Event verarbeitet (Activity-ID, eingetragene Distanz)
- Webhook-Event ignoriert (Grund: kein User, kein TYPO3-Profil, falscher Typ)

## Edge Cases
- Was passiert, wenn `LOG_LEVEL` auf einen ungültigen Wert gesetzt wird? → Wird wie "nicht gesetzt" behandelt (normaler Betrieb)
- Führt Debug-Logging zu Performance-Problemen? → Nein, da `console.log` in Serverless-Funktionen async ist und der Request nicht blockiert wird
- Können Debug-Logs Secrets enthalten? → Nein — AC-6 stellt sicher, dass Tokens immer maskiert werden

## Nicht-Ziele
- Kein persistentes Log-Speichern in der Datenbank (Vercel Logs sind ausreichend)
- Kein UI für Logs in der App (Vercel Dashboard ist die Oberfläche)
- Kein Live-Toggle ohne Redeploy (Vercel Env-Vars erfordern immer einen Redeploy)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
