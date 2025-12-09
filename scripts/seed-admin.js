/**
 * Seed Admin User Script
 *
 * This script creates the default admin user in the database.
 * It runs after migrations and is idempotent (safe to run multiple times).
 */

import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  console.log(`📝 Environment loaded from: ${envSource}`);
} else if (isProduction) {
  // Production mode - use system variables only
  envSource = 'system environment variables (production mode)';
  console.log(`🚀 Using: ${envSource}`);
} else {
  // Development without .env file - use system variables
  envSource = 'system environment variables (fallback)';
  console.log(`⚠️  No .env file found, using: ${envSource}`);
}

// Validate DATABASE_URL exists
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment!');
  console.error('   Set it in .env file (local) or system variables (production)');
  process.exit(1);
}

const dbHost = process.env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'unknown';
console.log(`📦 Database host: ${dbHost}\n`);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const ADMIN_EMAIL = 'admin@admin.com';
const ADMIN_PASSWORD = 'Admin@1234';
const ADMIN_USERNAME = 'admin';

async function seedAdminUser() {
  const client = await pool.connect();

  try {
    console.log('🌱 Starting admin user seeding...');

    // Check if users table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'users'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.error('❌ Error: Users table does not exist. Please run migrations first.');
      process.exit(1);
    }

    // Check if admin user already exists
    const adminCheck = await client.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1',
      [ADMIN_EMAIL, ADMIN_USERNAME]
    );

    if (adminCheck.rows.length > 0) {
      console.log('✅ Admin user already exists. Skipping creation.');
      return;
    }

    // Hash the password
    console.log('🔐 Hashing admin password...');
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

    // Insert admin user
    console.log('👤 Creating admin user...');
    const result = await client.query(
      `INSERT INTO users (
        username,
        email,
        password,
        user_type,
        first_name,
        last_name,
        is_active,
        is_staff,
        is_superuser,
        created_at,
        updated_at,
        date_joined
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), NOW())
      RETURNING id, email, username`,
      [
        ADMIN_USERNAME,
        ADMIN_EMAIL,
        hashedPassword,
        'admin',
        'Admin',
        'User',
        true,  // is_active
        true,  // is_staff
        true   // is_superuser
      ]
    );

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email:', result.rows[0].email);
    console.log('👤 Username:', result.rows[0].username);
    console.log('🔑 Default Password: Admin@1234');
    console.log('');
    console.log('⚠️  IMPORTANT: Change the admin password after first login!');

  } catch (error) {
    console.error('❌ Error seeding admin user:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seeding
seedAdminUser()
  .then(() => {
    console.log('✅ Admin seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Admin seeding failed:', error);
    process.exit(1);
  });
