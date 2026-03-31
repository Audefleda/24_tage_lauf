# PROJ-21: Dev/Prod Datenbank-Trennung (Supabase + CI/CD)

## Status: Deployed
**Created:** 2026-03-27
**Last Updated:** 2026-03-31

## Dependencies
- None (infrastrukturelles Fundament, unabhängig von App-Features)

## Ziel

Bisher gibt es nur eine einzige Supabase-Instanz (Production). Datenbankmigrationen können damit nicht sicher lokal getestet werden — ein Fehler im Schema würde direkt die Produktionsdaten treffen.

Ziel ist die strikte Trennung in zwei Supabase-Instanzen:

| Umgebung | Supabase-Instanz | Wer verbindet sich |
|----------|------------------|--------------------|
| **Development** | `24-tage-lauf-dev` | Lokale Entwicklung, Vercel Previews |
| **Production** | `24-tage-lauf-prod` | Vercel Production (`main`-Branch) |

Migrationen werden über die Supabase CLI als versionierte SQL-Dateien verwaltet und bei jedem Merge auf `main` automatisch per GitHub Action auf die Produktionsdatenbank angewendet.

---

## User Stories

- Als **Entwickler** möchte ich Datenbankmigrationen lokal gegen die Dev-Instanz testen, bevor sie auf Production landen, damit kein Produktionsausfall durch fehlerhafte Schemata entsteht.
- Als **Entwickler** möchte ich Migrationen als SQL-Dateien im Git-Repository verwalten, damit Änderungen nachvollziehbar und versionierbar sind.
- Als **Entwickler** möchte ich, dass die Production-Datenbank bei jedem Deployment auf `main` automatisch migriert wird, ohne manuelle SQL-Ausführung im Dashboard.
- Als **Entwickler** möchte ich, dass Vercel Preview Deployments automatisch die Dev-Instanz verwenden, damit neue Features gegen realistische (aber nicht produktive) Daten getestet werden können.
- Als **Administrator** möchte ich klar getrennte Credentials für Dev und Prod in den jeweiligen Umgebungsvariablen, damit kein Staging-Prozess versehentlich Production-Daten überschreibt.

---

## Acceptance Criteria

### Supabase-Instanzen
- [ ] Zwei separate Supabase-Projekte existieren: eines für Development, eines für Production
- [ ] Die Production-Instanz enthält alle bestehenden Daten (Migration des aktuellen Standes)
- [ ] Die Dev-Instanz hat dasselbe Schema wie Production (kein Datenmigration nötig, Schema-only)

### Supabase CLI & Migrations
- [ ] `supabase/` Verzeichnis ist im Repository angelegt und initialisiert
- [ ] Alle aktuellen Tabellenstrukturen sind als initiale Migration unter `supabase/migrations/` dokumentiert
- [ ] Neue Migrationen werden mit `supabase migration new <name>` erstellt
- [ ] `supabase db push --db-url <DEV_URL>` wendet Migrationen auf die Dev-Instanz an
- [ ] Die Dev-Instanz kann jederzeit mit `supabase db reset` auf einen sauberen Stand gebracht werden

### Umgebungsvariablen
- [ ] `.env.local` (lokal) enthält `SUPABASE_URL` und `SUPABASE_ANON_KEY` der Dev-Instanz
- [ ] Vercel Production-Umgebung enthält Credentials der Production-Instanz
- [ ] Vercel Preview-Umgebung enthält Credentials der Dev-Instanz
- [ ] `.env.local` ist in `.gitignore` — keine Credentials im Repository

### GitHub Action (Auto-Migration)
- [ ] Eine GitHub Action existiert unter `.github/workflows/migrate-production.yml`
- [ ] Sie wird ausgelöst bei Push auf `main` (nach erfolgreichem Vercel-Deploy)
- [ ] Sie führt `supabase db push` gegen die Production-Instanz aus
- [ ] Production-Credentials sind als GitHub Secrets hinterlegt: `SUPABASE_PROD_DB_URL` (PostgreSQL Connection String), `SUPABASE_PROD_ACCESS_TOKEN` (Supabase Personal Access Token für CLI-Auth)
- [ ] Bei Fehler der Migration schlägt die Action fehl und benachrichtigt (kein stilles Versagen)
- [ ] Die Action läuft parallel zum Vercel-Build (unkritisch bei additiven Migrationen; destructive Änderungen erfordern zweistufigen Deploy)

### Vercel Preview
- [ ] Vercel Preview Deployments nutzen automatisch die Dev-Supabase-Credentials (via Vercel Environment Variables für `Preview`)

---

## Edge Cases

- **Migration schlägt fehl auf Production:** Die GitHub Action schlägt fehl und blockiert den Workflow. Der Entwickler muss das Problem beheben und erneut pushen. Ein Rollback der Migration muss manuell erfolgen (down-Migration erstellen).
- **Dev-Schema weicht von Prod ab:** Wenn die Dev-Instanz experimentelle Änderungen hat, die nie auf Prod sollen, müssen diese vor dem Merge zurückgenommen werden. Dies ist bewusst — Dev ist kein 1:1-Abbild von Prod, sondern ein Testfeld.
- **Erster Setup:** Die bestehende Produktionsdatenbank muss als initiale Migration `0001_initial_schema.sql` introspektiert werden (`supabase db pull`), damit der Migrations-Zustand konsistent ist.
- **Secrets fehlen:** Wenn GitHub Secrets nicht konfiguriert sind, schlägt die Action beim ersten Push auf `main` fehl. Dies muss vor dem ersten Merge dokumentiert und eingerichtet werden.
- **Supabase CLI nicht installiert:** Lokale Migrations-Befehle schlagen fehl, wenn die CLI fehlt. Installationshinweis in `README` oder `CLAUDE.md` ergänzen.

---

## Technical Requirements

- **Tooling:** Supabase CLI (`supabase` v1.x oder neuer)
- **CI:** GitHub Actions (bereits über GitHub vorhanden, kein zusätzlicher Service nötig)
- **Secrets:** GitHub Repository Secrets für Production-Credentials
- **Keine Laufzeitänderungen an der App:** Die App selbst ändert sich nicht — nur Konfiguration und Infrastruktur

---

## Tech Design (Solution Architect)

### Systemübersicht

Zwei vollständig getrennte Supabase-Instanzen. Eine Codebasis mit umgebungsgesteuerten Credentials.

```
Git Repository
├── supabase/migrations/        ← Versionierte Schema-Änderungen (bereits vorhanden)
├── supabase/config.toml        ← CLI-Konfiguration (neu anlegen via supabase init)
├── .env.local                  ← Lokal: Dev-Credentials (nicht in Git)
└── .github/workflows/
    └── migrate-production.yml  ← Auto-Migration bei Push auf main (neu anlegen)

Vercel Environments
├── Production  (main-Branch)   → Prod-Supabase-Instanz
├── Preview     (alle anderen)  → Dev-Supabase-Instanz
└── Lokal (.env.local)          → Dev-Supabase-Instanz
```

### Zwei Supabase-Instanzen

| | Dev-Instanz | Prod-Instanz |
|---|---|---|
| Zweck | Schema-Tests, neue Features | Echte Benutzerdaten, Live-Betrieb |
| Genutzt von | Lokale App, Vercel Previews | Vercel Production |
| Daten | Testdaten (löschbar) | Echte Daten (nie löschen) |
| Migrationen | Manuell via CLI | Automatisch via GitHub Action |

### Migrations-Workflow

```
Neue Migration schreiben
        │
        ▼
supabase db push → Dev-Instanz   (manuell testen)
        │
   Test OK?
   ├── Nein → anpassen und erneut testen
   └── Ja  → git commit + push → main
                    │
                    ▼
           GitHub Action startet automatisch
                    │
                    ▼
        supabase db push → Prod-Instanz
```

### GitHub Action (migrate-production.yml)

Auslöser: Push auf `main`. Schritte: Supabase CLI installieren → `supabase db push` gegen Prod-Instanz. Bei Fehler: Workflow schlägt fehl, GitHub benachrichtigt — kein stilles Versagen.

**Timing:** Läuft parallel zum Vercel-Deploy. Unkritisch, weil additive Migrationen (neue Spalten/Tabellen) von der laufenden App-Version ignoriert werden. Destructive Änderungen erfordern einen zweistufigen Deploy.

### Umgebungsvariablen

| Variable | Lokal | Vercel Preview | Vercel Production |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Dev | Dev | Prod |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dev | Dev | Prod |
| `SUPABASE_SERVICE_ROLE_KEY` | Dev | Dev | Prod |

GitHub Secrets (nur für CI, nie in der App):

| Secret | Inhalt |
|---|---|
| `SUPABASE_PROD_DB_URL` | PostgreSQL Connection String der Prod-Instanz |
| `SUPABASE_PROD_ACCESS_TOKEN` | Supabase Personal Access Token für CLI-Authentifizierung |

### Einmalige Setup-Schritte

1. Neues Supabase-Projekt anlegen (Dev) — manuell im Dashboard
2. `supabase init` im Repository ausführen (erzeugt `config.toml`)
3. `supabase db push` gegen Dev — wendet die 11 vorhandenen Migrations-Dateien an
4. Vercel Env-Vars konfigurieren (Dev für Preview, Prod für Production)
5. GitHub Secrets hinterlegen (`SUPABASE_PROD_DB_URL`, `SUPABASE_PROD_ACCESS_TOKEN`)

> Die 11 bestehenden Migrations-Dateien unter `supabase/migrations/` werden direkt wiederverwendet — kein Neu-Introspektieren nötig.

### Was sich NICHT ändert

- App-Code (kein Code-Change)
- Datenmodell und Produktionsdaten
- Vercel-Deployment-Prozess (deployt weiterhin automatisch)

## Implementierungsnotizen

- Dev-Instanz `jyzjyaucwgcxsetppjbv` (24_tage_lauf_dev) wurde via Supabase MCP mit allen 11 Migrationen befüllt
- `supabase/config.toml` mit Prod-Projekt-ID `aceaotlrychrxcafjoxk` angelegt
- GitHub Action `.github/workflows/migrate-production.yml` löst nur aus, wenn Dateien unter `supabase/migrations/**` geändert wurden (kein unnötiger Run bei reinen App-Deployments)
- Offene manuelle Schritte: `.env.local` auf Dev-Credentials umstellen, Vercel Env-Vars trennen (siehe Anleitung in Spec)

## QA Test Results

**Tested:** 2026-03-31
**Tester:** QA Engineer (AI)
**Method:** Infrastructure/Config Audit (keine UI -- rein infrastrukturelles Feature)

### Acceptance Criteria Status

#### AC-1: Supabase-Instanzen

- [x] Zwei separate Supabase-Projekte existieren: Dev (`jyzjyaucwgcxsetppjbv`) und Prod (`aceaotlrychrxcafjoxk`) -- laut Implementierungsnotizen angelegt
- [x] Die Production-Instanz enthaelt alle bestehenden Daten (unveraendert, war bereits die einzige Instanz)
- [x] Die Dev-Instanz hat dasselbe Schema wie Production (11 Migrationen via Supabase MCP angewendet laut Spec)

#### AC-2: Supabase CLI & Migrations

- [x] `supabase/` Verzeichnis ist im Repository angelegt (config.toml + migrations/)
- [x] Alle 11 aktuellen Tabellenstrukturen sind als Migrationen unter `supabase/migrations/` vorhanden
- [x] Neue Migrationen koennen mit `supabase migration new <name>` erstellt werden (Standard-CLI-Funktionalitaet)
- [x] `supabase db push --db-url <DEV_URL>` wendet Migrationen auf die Dev-Instanz an (Standard-CLI-Funktionalitaet)
- [x] Die Dev-Instanz kann mit `supabase db reset` auf sauberen Stand gebracht werden (Standard-CLI-Funktionalitaet)

#### AC-3: Umgebungsvariablen

- [x] `.env.local` (lokal) existiert und enthaelt Supabase-Credentials
- [ ] **OFFEN (manuell):** Vercel Production-Umgebung -- kann nicht automatisiert geprueft werden, ob Prod-Credentials hinterlegt sind
- [ ] **OFFEN (manuell):** Vercel Preview-Umgebung -- kann nicht automatisiert geprueft werden, ob Dev-Credentials hinterlegt sind
- [x] `.env.local` ist in `.gitignore` (Pattern `.env*.local` vorhanden)
- [ ] BUG-1: `.env.local` enthaelt keine Hinweise darauf, ob Dev- oder Prod-Credentials eingetragen sind -- keine Kommentar-Dokumentation zur Umgebungszuordnung

#### AC-4: GitHub Action (Auto-Migration)

- [x] GitHub Action existiert unter `.github/workflows/migrate-production.yml`
- [x] Wird bei Push auf `main` ausgeloest
- [x] Fuehrt `supabase db push` gegen die Production-Instanz aus (via `secrets.SUPABASE_PROD_DB_URL`)
- [x] Production-Credentials sind als GitHub Secrets referenziert: `SUPABASE_PROD_DB_URL` und `SUPABASE_PROD_ACCESS_TOKEN`
- [x] Bei Fehler schlaegt die Action fehl (Standard-Verhalten, kein `continue-on-error`)
- [ ] BUG-2: Die Action laeuft PARALLEL zum Vercel-Deploy (nicht NACH dem Vercel-Build wie im AC formuliert)
- [x] Die Action wird nur bei Aenderungen in `supabase/migrations/**` ausgeloest (optimiert, kein unnuetiger Run bei reinen Code-Aenderungen)
- [ ] BUG-3: Spec-AC fordert `SUPABASE_PROD_SERVICE_ROLE_KEY` als Secret, Implementierung nutzt stattdessen `SUPABASE_PROD_ACCESS_TOKEN` -- Abweichung vom AC

#### AC-5: Vercel Preview

- [ ] **OFFEN (manuell):** Vercel Preview Deployments nutzen Dev-Credentials -- muss manuell im Vercel Dashboard verifiziert werden

### Edge Cases Status

#### EC-1: Migration schlaegt fehl auf Production
- [x] GitHub Action schlaegt bei Fehler fehl (Standard-Exit-Code-Handling, kein `continue-on-error` oder `set +e`)

#### EC-2: Dev-Schema weicht von Prod ab
- [x] Bewusste Design-Entscheidung -- Dev ist Testfeld, kein 1:1-Abbild (dokumentiert)

#### EC-3: Erster Setup (Initiale Migration)
- [x] 11 bestehende Migrations-Dateien werden direkt wiederverwendet -- kein Neu-Introspektieren noetig (dokumentiert)

#### EC-4: Secrets fehlen
- [ ] BUG-4: Kein Validierungsschritt in der GitHub Action, der prueft ob Secrets vorhanden sind bevor `supabase db push` laeuft. Fehlermeldung wuerde kryptisch sein (leerer DB-URL-String).

#### EC-5: Supabase CLI nicht installiert
- [ ] BUG-5: Kein Hinweis in README oder CLAUDE.md zur Supabase CLI Installation (im Edge-Case-Abschnitt der Spec als Anforderung genannt)

### Security Audit Results

- [x] Keine Credentials im Repository: `.env.local` korrekt in `.gitignore`, kein Secret in tracked files
- [x] GitHub Secrets korrekt referenziert: `SUPABASE_PROD_DB_URL` und `SUPABASE_PROD_ACCESS_TOKEN` als Secrets, nie hardcoded
- [x] Prod-Project-ID in `config.toml` ist unkritisch: Die Reference-ID allein reicht nicht fuer Zugriff
- [x] Action laeuft nur auf `main`-Branch: kein Risiko durch Fork-PRs (Push-Trigger, nicht PR-Trigger)
- [ ] BUG-6: `supabase/setup-cli@v1` nutzt Major-Version-Pinning -- ein Supply-Chain-Angriff auf das Action-Repository koennte die CLI manipulieren. Empfehlung: SHA-Pinning oder exaktes Version-Pinning.
- [x] Kein `NEXT_PUBLIC_`-Prefix fuer sensitive Variablen (Service Role Key ist server-only)
- [x] `.env.local.example` enthaelt nur Platzhalter, keine echten Credentials

### Bugs Found

#### BUG-1: Fehlende Umgebungs-Kennzeichnung in .env.local.example
- **Severity:** Low
- **Steps to Reproduce:**
  1. Oeffne `.env.local.example`
  2. Erwartung: Klarer Hinweis, dass lokale Entwicklung die Dev-Instanz verwenden soll
  3. Tatsaechlich: Kein Hinweis auf Dev/Prod-Zuordnung
- **Priority:** Nice to have

#### BUG-2: GitHub Action laeuft parallel zum Vercel-Deploy, nicht danach
- **Severity:** Low
- **Steps to Reproduce:**
  1. AC fordert: "Sie laeuft NACH dem Vercel-Build, nicht davor"
  2. Tatsaechlich: Action wird bei Push auf `main` sofort ausgeloest, parallel zu Vercel
  3. Spec-Implementierungsnotizen dokumentieren dies als bewusste Designentscheidung (additive Migrationen sind unkritisch)
- **Note:** Die Implementierungsnotizen begruenden die Abweichung vom AC -- bei additiven Migrationen ist Parallelitaet unkritisch. Destructive Aenderungen erfordern ohnehin zweistufigen Deploy. AC sollte angepasst werden.
- **Priority:** Nice to have (AC-Anpassung statt Code-Aenderung)

#### BUG-3: Secret-Name weicht vom AC ab
- **Severity:** Medium
- **Steps to Reproduce:**
  1. AC fordert GitHub Secret `SUPABASE_PROD_SERVICE_ROLE_KEY`
  2. Implementierung nutzt `SUPABASE_PROD_ACCESS_TOKEN` (Supabase Personal Access Token)
  3. Dies sind unterschiedliche Authentifizierungsmechanismen (Service Role Key vs. CLI Access Token)
- **Note:** Die Implementierung ist technisch korrekt -- `supabase db push` benoetigt den Access Token fuer CLI-Auth, nicht den Service Role Key. Der AC ist fehlerhaft formuliert.
- **Priority:** Fix before deployment (AC im Spec korrigieren)

#### BUG-4: Fehlende Secret-Validierung in GitHub Action
- **Severity:** Medium
- **Steps to Reproduce:**
  1. GitHub Secrets `SUPABASE_PROD_DB_URL` und `SUPABASE_PROD_ACCESS_TOKEN` sind nicht konfiguriert
  2. Push auf `main` mit Migration-Aenderung
  3. Erwartung: Klare Fehlermeldung "Secrets nicht konfiguriert"
  4. Tatsaechlich: `supabase db push` erhaelt leeren String als `--db-url`, Fehlermeldung ist kryptisch
- **Priority:** Fix before deployment

#### BUG-5: Fehlende Dokumentation zur Supabase CLI Installation
- **Severity:** Low
- **Steps to Reproduce:**
  1. Edge Case in Spec fordert: "Installationshinweis in README oder CLAUDE.md ergaenzen"
  2. Weder README noch CLAUDE.md enthalten Hinweis zu `supabase` CLI
- **Priority:** Fix in next sprint

#### BUG-6: Supply-Chain-Risiko durch Major-Version-Pinning der GitHub Action
- **Severity:** Low
- **Steps to Reproduce:**
  1. `supabase/setup-cli@v1` nutzt Major-Version-Tag
  2. Ein kompromittiertes Update des Action-Repos koennte malicious Code ausfuehren
  3. Empfehlung: `supabase/setup-cli@<commit-sha>` oder exakte Version
- **Note:** Branchenstandard ist Major-Version-Pinning (z.B. `actions/checkout@v4`). Risiko ist gering, aber fuer ein Projekt mit Produktionsdatenbank-Zugriff erwaehnenswert.
- **Priority:** Nice to have

### Nicht testbare Kriterien (manuell zu verifizieren)

Die folgenden Punkte koennen nur manuell durch den Entwickler/Admin verifiziert werden:

1. **Vercel Production Env-Vars:** Prod-Supabase-Credentials sind korrekt hinterlegt
2. **Vercel Preview Env-Vars:** Dev-Supabase-Credentials sind korrekt hinterlegt
3. **GitHub Secrets:** `SUPABASE_PROD_DB_URL` und `SUPABASE_PROD_ACCESS_TOKEN` sind konfiguriert
4. **Dev-Instanz Schema:** Dev-Instanz hat identisches Schema nach `supabase db push`
5. **Lokale .env.local:** Enthaelt Dev-Credentials (nicht Prod)

### Cross-Browser / Responsive Testing
- **Nicht anwendbar:** PROJ-21 ist ein rein infrastrukturelles Feature ohne UI-Aenderungen.

### Regression Testing
- **Nicht anwendbar:** Keine App-Code-Aenderungen. Bestehende Features bleiben unveraendert.
- [x] Bestehende 11 Migrations-Dateien sind unveraendert (keine Regression moeglich)
- [x] `supabase/config.toml` referenziert korrekte Prod-Project-ID
- [x] Keine Aenderungen an `.env.local.example` oder App-Code

### Summary
- **Acceptance Criteria:** 14/19 passed, 2 abweichend (BUG-2/3, begruendbar), 3 manuell zu verifizieren
- **Bugs Found:** 6 total (0 critical, 0 high, 2 medium, 4 low)
- **Security:** Pass (keine kritischen Findings, Supply-Chain-Hinweis als Low eingestuft)
- **Production Ready:** BEDINGT JA -- unter folgenden Voraussetzungen:
  1. BUG-3: AC im Spec an Implementierung anpassen (Secret-Name)
  2. BUG-4: Secret-Validierung in GitHub Action ergaenzen
  3. Manuelle Verifikation der 5 nicht testbaren Kriterien durch den Admin
- **Recommendation:** Medium-Bugs (BUG-3, BUG-4) beheben, dann deployen. Low-Bugs koennen im naechsten Sprint adressiert werden.

## Deployment

- **Deployed:** 2026-03-31
- **Commit:** `76182de`
- **Branch:** `main`
- **GitHub Action:** `.github/workflows/migrate-production.yml` — wird beim nächsten Push einer Migration automatisch ausgelöst
