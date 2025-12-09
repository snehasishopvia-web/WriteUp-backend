#!/usr/bin/env node

/**
 * Check migration status - shows which migrations are pending vs applied
 *
 * Usage:
 *   node scripts/check-migration-status.js
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../.env');

// Smart environment loading: System variables take precedence in production
const isProduction = process.env.NODE_ENV === 'production';
let envSource = 'system environment variables';

if (!isProduction && fs.existsSync(envPath)) {
  // Development mode with .env file - load it
  dotenv.config({ path: envPath });
  envSource = `.env file`;
} else if (isProduction) {
  // Production mode - use system variables only
  envSource = 'system environment variables (production mode)';
} else {
  // Development without .env file - use system variables
  envSource = 'system environment variables (fallback)';
}

const { Client } = pg;

async function checkMigrationStatus() {
  // Validate DATABASE_URL exists
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in environment!');
    console.error('   Set it in .env file (local) or system variables (production)');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    const dbHost = process.env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'unknown';
    console.log('✅ Connected to database');
    console.log(`   Source: ${envSource}`);
    console.log(`   Host: ${dbHost}\n`);

    // Get all migration files
    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.js'))
      .sort();

    console.log(`📁 Found ${files.length} migration files in migrations/\n`);

    // Get applied migrations from database
    let appliedMigrations = [];
    try {
      const result = await client.query(
        'SELECT name, run_on FROM pgmigrations ORDER BY run_on'
      );
      appliedMigrations = result.rows.map(row => row.name);
      console.log(`✓ ${appliedMigrations.length} migrations have been applied to database\n`);
    } catch (error) {
      if (error.message.includes('relation "pgmigrations" does not exist')) {
        console.log('⚠️  No migrations table found - database is empty\n');
      } else {
        throw error;
      }
    }

    // Compare and categorize
    const pending = [];
    const applied = [];

    for (const file of files) {
      const migrationName = file.replace('.js', '');
      if (appliedMigrations.includes(migrationName)) {
        applied.push({ name: migrationName, status: 'applied' });
      } else {
        pending.push({ name: migrationName, status: 'pending' });
      }
    }

    // Display results
    console.log('═══════════════════════════════════════════════════════════');
    console.log('MIGRATION STATUS');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (applied.length > 0) {
      console.log(`✅ APPLIED (${applied.length}):`);
      console.log('─────────────────────────────────────────────────────────');
      applied.forEach(m => {
        console.log(`   ✓ ${m.name}`);
      });
      console.log('');
    }

    if (pending.length > 0) {
      console.log(`⏳ PENDING (${pending.length}):`);
      console.log('─────────────────────────────────────────────────────────');
      pending.forEach(m => {
        console.log(`   ⧗ ${m.name}`);
      });
      console.log('');
      console.log(`💡 To apply pending migrations, run: npm run migrate:up`);
    } else {
      console.log('✨ All migrations are up to date!\n');
    }

    console.log('═══════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the check
checkMigrationStatus();
