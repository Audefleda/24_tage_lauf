# PROJ-7: Passwort-Reset

## Status: Planned
**Created:** 2026-03-18
**Last Updated:** 2026-03-18

## Dependencies
- Requires: PROJ-2 (Anmeldung — Supabase Auth)

## User Stories
- Als Läufer möchte ich mein vergessenes Passwort zurücksetzen können, damit ich wieder Zugang zu meinem Account bekomme.
- Als Läufer möchte ich nach dem Klick auf "Passwort vergessen" eine E-Mail erhalten mit einem Link zum Zurücksetzen.
- Als Läufer möchte ich über den Link in der E-Mail direkt zu einem Formular in der App gelangen, wo ich mein neues Passwort eingeben kann.
- Als Läufer möchte ich nach erfolgreichem Zurücksetzen automatisch eingeloggt und zur Übersicht weitergeleitet werden.

## Acceptance Criteria
- [ ] Login-Seite hat einen "Passwort vergessen"-Link/-Button
- [ ] Nach Eingabe der E-Mail und Klick auf "Zurücksetzen" wird eine Rücksetz-Mail von Supabase verschickt
- [ ] Der Link in der Rücksetz-Mail führt zu unserer App (nicht ins Nirgendwo)
- [ ] Die App verarbeitet den Supabase Auth-Callback-Token korrekt (Token-Exchange)
- [ ] Nach Token-Exchange wird der Nutzer auf eine "Neues Passwort setzen"-Seite weitergeleitet
- [ ] Das Formular hat zwei Felder: "Neues Passwort" und "Passwort bestätigen"
- [ ] Validierung: mindestens 8 Zeichen, beide Felder müssen übereinstimmen
- [ ] Nach erfolgreichem Speichern: Nutzer ist eingeloggt und wird zu `/runs` weitergeleitet
- [ ] Abgelaufene oder ungültige Tokens zeigen eine verständliche Fehlermeldung mit Link zurück zur Login-Seite
- [ ] Der "Passwort vergessen"-Bereich ist vom Login-Formular klar getrennt (eigene Unterseite oder ausklappbarer Bereich)

## Edge Cases
- Was passiert wenn der Token abgelaufen ist (Supabase-Standard: 1 Stunde)? → Fehlermeldung "Link abgelaufen", Link zurück zu Login mit Hinweis erneut anzufordern
- Was passiert wenn ein Nutzer den Reset-Link mehrfach klickt? → Token ist nach einmaliger Nutzung ungültig, Fehlermeldung
- Was passiert wenn die E-Mail nicht im System existiert? → Aus Sicherheitsgründen trotzdem Erfolgsmeldung anzeigen ("Falls diese E-Mail registriert ist, wurde eine Mail verschickt")
- Was passiert wenn die Passwörter nicht übereinstimmen? → Client-seitige Validierung, kein API-Aufruf
- Was passiert wenn der Nutzer den Link in einem anderen Browser öffnet? → Supabase PKCE-Flow muss berücksichtigt werden

## Technical Notes
- Supabase verschickt die Reset-Mail mit einem Link der Form: `https://app.com/auth/callback?token_hash=...&type=recovery`
- Die App benötigt eine Route `src/app/auth/callback/route.ts` die den Token gegen eine Session tauscht
- Der `redirectTo`-Parameter beim `resetPasswordForEmail()`-Aufruf muss auf die Production-URL zeigen: `https://24-tage-lauf.vercel.app/auth/callback?next=/reset-password`
- In Supabase Dashboard muss `https://24-tage-lauf.vercel.app/**` als erlaubte Redirect-URL eingetragen sein

---
<!-- Sections below are added by subsequent skills -->

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
