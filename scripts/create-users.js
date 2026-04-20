#!/usr/bin/env node
'use strict';

/**
 * Bulk-User-Erstellung für 24-Tage-Lauf
 *
 * Usage:
 *   node scripts/create-users.js users.csv
 *   PRODUCTION=true node scripts/create-users.js users.csv
 *
 * CSV-Format (eine E-Mail pro Zeile):
 *   user1@example.com
 *   user2@example.com
 */

const path = require('node:path');
const fs = require('node:fs');

// Load environment
const isProduction = process.env.PRODUCTION === 'true';
const envPath = isProduction
  ? path.resolve(process.cwd(), '.env.backup-production')
  : path.resolve(process.cwd(), '.env.local');

const dotenvResult = require('dotenv').config({ path: envPath });

if (dotenvResult.error) {
  console.error(`❌ Fehler: Env-Datei nicht gefunden unter ${envPath}`);
  console.error('Stelle sicher, dass .env.local (Dev) oder .env.backup-production existiert.');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const redirectUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://24-tage-lauf.vercel.app';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Fehler: NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt');
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');

/**
 * Parse CSV file — one email per line, no header required
 */
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');

  if (lines.length === 0) {
    throw new Error('CSV-Datei ist leer');
  }

  const users = [];
  for (let i = 0; i < lines.length; i++) {
    const email = lines[i].trim();

    if (!email || email.startsWith('#')) continue;

    if (email.includes('@')) {
      users.push({ email });
    } else {
      console.warn(`⚠️  Zeile ${i + 1} übersprungen: ungültige E-Mail "${email}"`);
    }
  }

  return users;
}

/**
 * Create a single user with invite email
 */
async function createUser(supabase, email, dryRun) {
  const options = {
    email,
    email_confirm: false,
  };

  if (dryRun) {
    console.log(`  [DRY-RUN] Würde User erstellen: ${email}`);
    return { success: true, dryRun: true };
  }

  try {
    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const exists = existingUsers?.users?.some(u => u.email === email);

    if (exists) {
      return { success: false, error: 'User existiert bereits', email };
    }

    // Create user with invite
    const { data, error } = await supabase.auth.admin.createUser(options);

    if (error) {
      return { success: false, error: error.message, email };
    }

    // Send invite email explicitly (Supabase should do this automatically, but be explicit)
    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${redirectUrl}/auth/callback`,
    });

    if (inviteError) {
      console.warn(`  ⚠️  User ${email} erstellt, aber Einladung fehlgeschlagen: ${inviteError.message}`);
    }

    return { success: true, email, userId: data.user.id };
  } catch (err) {
    return { success: false, error: err.message, email };
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const csvFile = args.find(arg => !arg.startsWith('--'));

  if (!csvFile) {
    console.error('❌ Fehler: CSV-Datei fehlt');
    console.log('\nUsage:');
    console.log('  node scripts/create-users.js users.csv');
    console.log('  node scripts/create-users.js users.csv --dry-run');
    console.log('  PRODUCTION=true node scripts/create-users.js users.csv');
    console.log('\nCSV-Format (eine E-Mail pro Zeile):');
    console.log('  user1@example.com');
    console.log('  user2@example.com');
    process.exit(1);
  }

  const csvPath = path.resolve(csvFile);
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Fehler: Datei nicht gefunden: ${csvPath}`);
    process.exit(1);
  }

  console.log('═'.repeat(60));
  console.log(`📧 Bulk-User-Erstellung für 24-Tage-Lauf`);
  console.log('═'.repeat(60));
  console.log(`Umgebung:     ${isProduction ? '🔴 PRODUCTION' : '🟢 DEV'}`);
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`CSV-Datei:    ${csvPath}`);
  console.log(`Redirect URL: ${redirectUrl}`);
  if (dryRun) console.log(`Modus:        DRY-RUN (keine Änderungen)`);
  console.log('═'.repeat(60));
  console.log();

  // Parse CSV
  let users;
  try {
    users = parseCSV(csvPath);
    console.log(`✅ ${users.length} User aus CSV gelesen\n`);
  } catch (err) {
    console.error(`❌ Fehler beim Parsen der CSV: ${err.message}`);
    process.exit(1);
  }

  if (users.length === 0) {
    console.error('❌ Keine gültigen User in CSV gefunden');
    process.exit(1);
  }

  // Confirm before production run
  if (isProduction && !dryRun) {
    console.log('⚠️  ACHTUNG: Du bist dabei, User auf PRODUCTION anzulegen!');
    console.log('⚠️  Die User erhalten automatisch Einladungs-E-Mails.\n');

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    await new Promise(resolve => {
      readline.question('Fortfahren? (yes/no): ', answer => {
        readline.close();
        if (answer.toLowerCase() !== 'yes') {
          console.log('❌ Abgebrochen');
          process.exit(0);
        }
        resolve();
      });
    });
    console.log();
  }

  // Create Supabase client
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Create users
  console.log('Erstelle User...\n');
  const results = [];

  for (const user of users) {
    process.stdout.write(`  ${user.email} ... `);
    const result = await createUser(supabase, user.email, dryRun);
    results.push(result);

    if (result.success) {
      if (result.dryRun) {
        console.log('✅ (Dry-Run)');
      } else {
        console.log(`✅ Erstellt — Einladung versendet`);
      }
    } else {
      console.log(`❌ ${result.error}`);
    }

    // Rate limiting: wait 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Summary
  console.log();
  console.log('═'.repeat(60));
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`✅ Erfolgreich: ${successful}`);
  if (failed > 0) {
    console.log(`❌ Fehlgeschlagen: ${failed}`);
    console.log('\nFehlgeschlagene User:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.email}: ${r.error}`);
    });
  }
  console.log('═'.repeat(60));

  if (dryRun) {
    console.log('\n💡 Führe ohne --dry-run aus um User wirklich zu erstellen');
  }
}

main().catch(err => {
  console.error(`\n❌ Unerwarteter Fehler: ${err.message}`);
  process.exit(1);
});
