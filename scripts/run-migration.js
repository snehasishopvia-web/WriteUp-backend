#!/usr/bin/env node

/**
 * Migration runner with smart environment loading
 * Works in both local development (.env file) and production (system variables)
 */

import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverDir = join(__dirname, '..');
const envPath = join(serverDir, '.env');

const isProduction = process.env.NODE_ENV === 'production';

// Smart environment loading: System variables take precedence in production
console.log('🔍 Environment Detection:');
console.log(`   Mode: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);

let envSource = 'system environment variables';

if (!isProduction && existsSync(envPath)) {
  // Development mode with .env file - load it
  dotenv.config({ path: envPath });
  envSource = `.env file (${envPath})`;
  console.log(`   📝 Loaded from: ${envSource}`);
} else if (isProduction) {
  // Production mode - use system variables only
  console.log(`   🚀 Using: System environment variables (production mode)`);
} else {
  // Development without .env file - use system variables
  console.log(`   ⚠️  No .env file found at: ${envPath}`);
  console.log(`   📡 Using: System environment variables (fallback)`);
}

// Validate DATABASE_URL is available from either source
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('\n❌ DATABASE_URL not found in environment!');
  console.error('   Please set it in one of these locations:');
  console.error('   - For local development: Create .env file with DATABASE_URL');
  console.error('   - For production: Set DATABASE_URL in system environment');
  console.error(`   - Current .env path: ${envPath}`);
  process.exit(1);
}

// Log database connection info (sanitized)
const sanitizedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
const dbHost = sanitizedUrl.split('@')[1]?.split('/')[0] || 'unknown';
console.log(`\n📦 Database Connection:`);
console.log(`   Source: ${envSource}`);
console.log(`   Host: ${dbHost}`);

// Get migration command from arguments (default to 'up')
const migrationCommand = process.argv[2] || 'up';
const migrationDir = join(serverDir, 'migrations');

// Run node-pg-migrate with the loaded environment
const args = [
  migrationCommand,
  '-m', migrationDir,
];

console.log(`\n🚀 Running migration: ${migrationCommand}\n`);

const child = spawn('node-pg-migrate', args, {
  cwd: serverDir,
  env: { ...process.env }, // Pass the environment with loaded .env
  stdio: 'inherit',
  shell: true
});

child.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Migration completed successfully');
  } else {
    console.error(`\n❌ Migration failed with code ${code}`);
  }
  process.exit(code);
});

child.on('error', (error) => {
  console.error('❌ Failed to run migration:', error);
  process.exit(1);
});
