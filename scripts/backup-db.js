#!/usr/bin/env node
'use strict';

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// Load env file: use BACKUP_DOTENV_PATH if set, otherwise fall back to .env.local
const envPath = process.env.BACKUP_DOTENV_PATH
  ? path.resolve(process.env.BACKUP_DOTENV_PATH)
  : path.resolve(process.cwd(), '.env.local');
const dotenvResult = require('dotenv').config({ path: envPath });

if (dotenvResult.error) {
  console.error(`Fehler: Env-Datei nicht gefunden unter ${envPath}`);
  console.error('Bitte stelle sicher, dass du das Script aus dem Projektverzeichnis aufrufst.');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('Fehler: NEXT_PUBLIC_SUPABASE_URL fehlt in .env.local');
  process.exit(1);
}
if (!serviceRoleKey) {
  console.error('Fehler: SUPABASE_SERVICE_ROLE_KEY fehlt in .env.local');
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');
const tar = require('tar');

async function getTableNames() {
  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase-Verbindung fehlgeschlagen: ${response.status} ${response.statusText}`);
  }

  const spec = await response.json();
  // Extract table names from OpenAPI paths (exclude rpc/ paths and empty entries)
  const tables = Object.keys(spec.paths || {})
    .map((p) => p.replace(/^\//, ''))
    .filter((name) => name && !name.startsWith('rpc/'));

  return tables;
}

function toCSV(rows) {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    const values = headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    });
    lines.push(values.join(','));
  }
  return lines.join('\n');
}

async function exportTable(supabase, tableName, tmpDir) {
  process.stdout.write(`  Exportiere: ${tableName} ...`);

  let allRows = [];
  let from = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + batchSize - 1);

    if (error) {
      throw new Error(`Fehler beim Exportieren von ${tableName}: ${error.message}`);
    }

    if (!data || data.length === 0) break;

    allRows = allRows.concat(data);

    if (data.length < batchSize) break;
    from += batchSize;
  }

  const csv = toCSV(allRows);
  const filePath = path.join(tmpDir, `${tableName}.csv`);
  fs.writeFileSync(filePath, csv, 'utf-8');
  console.log(` ${allRows.length} Zeilen`);

  return filePath;
}

async function main() {
  // Determine output directory: optional CLI argument or current working directory
  const outputDir = process.argv[2]
    ? path.resolve(process.argv[2])
    : process.cwd();

  // Ensure output directory exists (create recursively if needed)
  try {
    fs.mkdirSync(outputDir, { recursive: true });
  } catch (err) {
    console.error(`Fehler: Zielverzeichnis konnte nicht erstellt werden: ${outputDir}`);
    console.error(err.message);
    process.exit(1);
  }

  // Verify write permissions by attempting to create a temp file
  const testFile = path.join(outputDir, `.backup-write-test-${Date.now()}`);
  try {
    fs.writeFileSync(testFile, '');
    fs.unlinkSync(testFile);
  } catch {
    console.error(`Fehler: Keine Schreibrechte im Zielverzeichnis: ${outputDir}`);
    process.exit(1);
  }

  console.log(`Zielverzeichnis: ${outputDir}`);

  // Build timestamp for archive name
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join('-') + '_' + [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('-');
  const archiveName = `backup_${timestamp}.tar.gz`;
  const archivePath = path.join(outputDir, archiveName);

  // Create temp directory for CSV files
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-backup-'));

  try {
    console.log('Verbinde mit Supabase...');
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Discover tables
    let tables;
    try {
      tables = await getTableNames();
    } catch (err) {
      console.error(`Fehler: ${err.message}`);
      process.exit(1);
    }

    if (tables.length === 0) {
      console.warn('Hinweis: Keine Tabellen im public Schema gefunden. Erstelle leeres Archiv.');
    } else {
      console.log(`${tables.length} Tabelle(n) gefunden: ${tables.join(', ')}\n`);
    }

    // Export each table to CSV
    for (const table of tables) {
      await exportTable(supabase, table, tmpDir);
    }

    // Create tar.gz archive
    console.log(`\nErstelle Archiv: ${archiveName} ...`);
    const csvFiles = tables.map((t) => `${t}.csv`);
    await tar.create(
      {
        gzip: true,
        file: archivePath,
        cwd: tmpDir,
      },
      csvFiles
    );

    // Verify archive was written
    if (!fs.existsSync(archivePath)) {
      throw new Error('Archiv wurde nicht erstellt — fehlende Schreibrechte im Zielverzeichnis?');
    }

    const sizeKB = Math.round(fs.statSync(archivePath).size / 1024);
    console.log(`Backup abgeschlossen: ${archivePath} (${sizeKB} KB)`);

    // Cleanup old backups
    cleanupBackups(outputDir, now);
  } catch (err) {
    console.error(`\nFehler: ${err.message}`);
    process.exit(1);
  } finally {
    // Remove temp CSV files
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function cleanupBackups(outputDir, now) {
  const KEEP_HOURLY_DAYS = 5;
  const backupPattern = /^backup_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})\.tar\.gz$/;

  const files = fs.readdirSync(outputDir)
    .map((name) => {
      const match = name.match(backupPattern);
      if (!match) return null;
      const [, datePart, timePart] = match;
      const isoStr = `${datePart}T${timePart.replace(/-/g, ':')}`;
      return { name, date: new Date(isoStr) };
    })
    .filter(Boolean)
    .sort((a, b) => b.date - a.date); // newest first

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - KEEP_HOURLY_DAYS);

  // Group files older than cutoff by day, keep only the latest per day
  const keptPerDay = new Set();
  let deleted = 0;

  for (const file of files) {
    if (file.date >= cutoff) continue; // within retention window, keep all

    const dayKey = file.name.slice(7, 17); // "YYYY-MM-DD"
    if (!keptPerDay.has(dayKey)) {
      keptPerDay.add(dayKey); // keep the newest of this day
    } else {
      fs.unlinkSync(path.join(outputDir, file.name));
      deleted++;
    }
  }

  if (deleted > 0) {
    console.log(`Bereinigung: ${deleted} alte Backup(s) gelöscht (älter als ${KEEP_HOURLY_DAYS} Tage, nur Tages-Backup behalten).`);
  }
}

main();
