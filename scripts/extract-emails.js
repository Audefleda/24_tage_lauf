#!/usr/bin/env node
'use strict';

/**
 * Extrahiert E-Mail-Adressen aus verschiedenen Formaten und erstellt CSV
 *
 * Usage:
 *   node scripts/extract-emails.js members.txt
 *   node scripts/extract-emails.js members.txt --admin max@example.com,anna@example.com
 *
 * Unterstützte Eingabeformate:
 *   - Nur E-Mails (eine pro Zeile)
 *   - Teams-Mitgliederliste (Name, Rolle, E-Mail gemischt)
 *   - Kommaseparierte E-Mails
 *   - Semikolon-separierte E-Mails (Outlook-Stil)
 */

const fs = require('node:fs');
const path = require('node:path');

/**
 * Extract all email addresses from text using regex
 */
function extractEmails(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex);
  return matches ? [...new Set(matches.map(e => e.toLowerCase()))] : [];
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const inputFile = args.find(arg => !arg.startsWith('--'));
  const adminFlag = args.find(arg => arg.startsWith('--admin'));

  if (!inputFile) {
    console.error('❌ Fehler: Eingabedatei fehlt');
    console.log('\nUsage:');
    console.log('  node scripts/extract-emails.js members.txt');
    console.log('  node scripts/extract-emails.js members.txt --admin admin@example.com');
    console.log('  node scripts/extract-emails.js members.txt --admin admin1@example.com,admin2@example.com');
    console.log('\nUnterstützte Formate:');
    console.log('  - Teams-Mitgliederliste (Namen + E-Mails)');
    console.log('  - Nur E-Mails (eine pro Zeile)');
    console.log('  - Kommasepariert: user1@example.com, user2@example.com');
    console.log('  - Semikolon-separiert (Outlook): user1@example.com; user2@example.com');
    process.exit(1);
  }

  const inputPath = path.resolve(inputFile);
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Fehler: Datei nicht gefunden: ${inputPath}`);
    process.exit(1);
  }

  // Parse admin emails
  let adminEmails = new Set();
  if (adminFlag) {
    const adminValue = adminFlag.split('=')[1] || args[args.indexOf(adminFlag) + 1];
    if (adminValue) {
      adminEmails = new Set(
        adminValue.split(',').map(e => e.trim().toLowerCase()).filter(e => e.includes('@'))
      );
    }
  }

  console.log('═'.repeat(60));
  console.log('📧 E-Mail-Extraktion für 24-Tage-Lauf');
  console.log('═'.repeat(60));
  console.log(`Eingabedatei: ${inputPath}`);
  if (adminEmails.size > 0) {
    console.log(`Admin-E-Mails: ${[...adminEmails].join(', ')}`);
  }
  console.log('═'.repeat(60));
  console.log();

  // Read and extract emails
  const content = fs.readFileSync(inputPath, 'utf-8');
  const emails = extractEmails(content);

  if (emails.length === 0) {
    console.error('❌ Keine E-Mail-Adressen gefunden');
    process.exit(1);
  }

  console.log(`✅ ${emails.length} E-Mail-Adresse(n) gefunden:\n`);
  emails.forEach((email, i) => {
    const isAdmin = adminEmails.has(email);
    console.log(`  ${i + 1}. ${email}${isAdmin ? ' (Admin)' : ''}`);
  });
  console.log();

  // Generate CSV
  const outputPath = path.join(path.dirname(inputPath), 'users.csv');
  const csvLines = ['email,admin'];
  emails.forEach(email => {
    const isAdmin = adminEmails.has(email);
    csvLines.push(`${email},${isAdmin ? 'true' : 'false'}`);
  });

  fs.writeFileSync(outputPath, csvLines.join('\n') + '\n', 'utf-8');

  console.log('═'.repeat(60));
  console.log(`✅ CSV erstellt: ${outputPath}`);
  console.log('═'.repeat(60));
  console.log('\n💡 Nächster Schritt:');
  console.log(`   node scripts/create-users.js ${outputPath} --dry-run`);
}

main();
