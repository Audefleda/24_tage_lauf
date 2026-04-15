# CI/CD Workflow

Automatisiertes Testing und Deployment mit GitHub Actions + Vercel.

## Übersicht

```
Feature-Branch
    ↓
Push → GitHub Actions
    ↓
1. Build + Unit Tests
    ↓
Pull Request → Vercel Preview Deploy (Dev-DB)
    ↓
2. E2E Tests auf Preview
    ↓
✅ Merge zu main
    ↓
Vercel Production Deploy (Prod-DB)
    ↓
3. Datenbank-Migration (GitHub Action)
    ↓
4. Smoke Tests auf Production (optional)
```

## Workflows

### 1. CI - Test on Preview Environment

**Datei:** `.github/workflows/ci-test-preview.yml`

**Trigger:**
- Pull Requests zu `main`
- Push auf `feature/**` Branches

**Stages:**
1. **Build & Unit Tests**
   - Lint-Check (`npm run lint`)
   - Unit Tests (`npm test`)
   - Build-Verifikation (`npm run build`)

2. **E2E Tests auf Vercel Preview**
   - Wartet auf Vercel Preview Deployment
   - Führt Playwright E2E Tests gegen Preview-URL aus
   - Nutzt Dev-Datenbank (automatisch via Vercel Environment Variables)

3. **PR Comment**
   - Kommentiert PR mit Test-Status
   - ✅ Bei Erfolg: "Bereit für Merge"
   - ❌ Bei Fehler: "Bitte Logs prüfen"

**Vorteile:**
- Features werden gegen realistische Umgebung getestet (Dev-DB)
- Bugs werden vor Production entdeckt
- Kein manuelles Testing nötig

---

### 2. Migrate Production Database

**Datei:** `.github/workflows/migrate-production.yml`

**Trigger:**
- Push auf `main` (nach Merge)
- Nur wenn `supabase/migrations/**` geändert wurde

**Aufgaben:**
- Verlinkt Production Supabase-Instanz
- Wendet neue Migrationen an (`supabase db push`)
- Blockiert bei Fehler (kein stiller Ausfall)

**Wichtig:**
- Benötigt GitHub Secret: `SUPABASE_PROD_ACCESS_TOKEN`

---

### 3. Smoke Tests - Production

**Datei:** `.github/workflows/smoke-tests-production.yml`

**Trigger:**
- Nach erfolgreichem Production-Deployment
- Läuft automatisch nach Migration-Workflow

**Aufgaben:**
- Wartet auf Vercel Production Deploy
- Führt kritische E2E Tests auf Production aus (`@smoke` Tag)
- Lädt Playwright Report bei Fehler hoch

**Vorteile:**
- Verifiziert dass Production nach Deployment funktioniert
- Früherkennung von Breaking Changes
- Kann bei Fehler automatisch Rollback triggern (optional)

---

## Setup

### 1. GitHub Secrets konfigurieren

```bash
# Repository Settings → Secrets and variables → Actions → New repository secret

GITHUB_TOKEN              # Automatisch vorhanden (kein Setup nötig)
SUPABASE_PROD_ACCESS_TOKEN  # Bereits konfiguriert (PROJ-21)
```

Optional (für erweiterte Features):
- `SLACK_WEBHOOK_URL` - Für Notifications bei Smoke Test Failures
- `VERCEL_TOKEN` - Für präzisere Deployment-Status-Abfragen

### 2. Vercel Environment Variables

**Preview Environment (Dev):**
```
NEXT_PUBLIC_SUPABASE_URL=https://jyzjyaucwgcxsetppjbv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<dev-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<dev-service-role-key>
```

**Production Environment:**
```
NEXT_PUBLIC_SUPABASE_URL=https://aceaotlrychrxcafjoxk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<prod-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<prod-service-role-key>
```

### 3. Playwright E2E Tests mit Umgebungs-URL

`playwright.config.ts` muss `BASE_URL` aus Env-Variable lesen:

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
  },
  // ...
})
```

### 4. Smoke Tests markieren

Kritische Tests mit `@smoke` Tag versehen:

```typescript
test('@smoke Login funktioniert', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Anmelden' }).click()
  // ...
})
```

---

## Workflow-Beispiel

### Feature entwickeln

```bash
# 1. Feature-Branch erstellen
git checkout -b feature/proj-25-neue-funktion

# 2. Entwickeln, Testen, Committen
npm run dev
npm test
git commit -m "feat(PROJ-25): ..."

# 3. Pushen
git push -u origin feature/proj-25-neue-funktion
```

→ GitHub Actions läuft: Build + Unit Tests

### Pull Request erstellen

```bash
# PR auf GitHub erstellen
gh pr create --title "PROJ-25: Neue Funktion" --body "..."
```

→ Vercel erstellt Preview Deploy  
→ GitHub Actions wartet auf Preview  
→ E2E Tests laufen gegen Preview  
→ PR wird automatisch kommentiert mit Status  

### Merge zu main

Nach erfolgreichen Tests:

```bash
gh pr merge --squash
```

→ Vercel deployt zu Production  
→ GitHub Action migriert Datenbank  
→ Smoke Tests laufen auf Production  
→ Bei Fehler: Notification  

---

## Vorteile dieses Workflows

✅ **Frühe Fehlererkennung** - Bugs werden auf Preview gefunden, nicht in Production  
✅ **Automatisiert** - Kein manuelles Testing vor jedem Merge nötig  
✅ **Sicherheit** - E2E Tests gegen echte Datenbank (Dev)  
✅ **Transparenz** - PR-Comments zeigen Test-Status sofort  
✅ **Rollback-fähig** - Bei Production-Smoke-Test-Fehler kann automatisch Alarm ausgelöst werden  

---

## Troubleshooting

### E2E Tests timeout auf Preview

**Problem:** `wait-for-vercel-preview` läuft in Timeout  
**Lösung:** `max_timeout` in `.github/workflows/ci-test-preview.yml` erhöhen (aktuell 300s = 5 Min)

### Smoke Tests schlagen auf Production fehl

**Problem:** Production funktioniert nicht nach Deployment  
**Lösung:** 
1. Playwright Report in GitHub Actions Artifacts anschauen
2. Vercel Logs prüfen
3. Ggf. Rollback via Vercel Dashboard

### GitHub Action hat keine Permission für PR Comments

**Problem:** `actions/github-script` kann nicht kommentieren  
**Lösung:** Repository Settings → Actions → General → Workflow permissions → "Read and write permissions" aktivieren

---

## Nächste Schritte (Optional)

- **Slack/Teams Notifications** bei Smoke Test Failures
- **Automatischer Rollback** bei kritischen Production-Fehlern
- **Performance Tests** (Lighthouse CI)
- **Visual Regression Tests** (Percy, Chromatic)
- **Load Tests** (k6, Artillery)
