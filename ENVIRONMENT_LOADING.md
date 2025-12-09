# Environment Variable Loading - Complete Guide

This document explains how environment variables are loaded in this application, making it work seamlessly in both development and production environments.

## Problem We Solved

### Original Issue
The application was using `dotenv.config({ override: true })` which:
- ❌ Failed on production platforms (Render, Vercel) where no `.env` file exists
- ❌ Could override production system variables if `.env` accidentally uploaded
- ❌ Didn't provide visibility into where variables came from

### Our Solution
Implemented **smart environment loading** that:
- ✅ Works with `.env` files (local development)
- ✅ Works with system variables (production platforms)
- ✅ Shows exactly where each variable came from
- ✅ Follows platform best practices (Render, Vercel, Heroku, AWS)

## How It Works

### Priority System

The application uses this priority order:

```
1. NODE_ENV=production?
   → Use system environment variables only

2. .env file exists?
   → Load from .env file

3. Otherwise
   → Use system environment variables (fallback)
```

### Visual Flow

```
┌─────────────────────────────┐
│   Application Starts        │
└──────────┬──────────────────┘
           │
           ▼
    ┌──────────────┐
    │ Check Mode   │
    └──┬───────┬───┘
       │       │
       ▼       ▼
   PROD     DEV
       │       │
       │       ▼
       │  ┌────────────┐
       │  │.env exists?│
       │  └─┬────────┬─┘
       │   YES      NO
       │    │        │
       ▼    ▼        ▼
    System  .env  System
    Vars    File  Vars
       │     │      │
       └─────┴──────┘
              │
              ▼
       ┌─────────────┐
       │Validate URL │
       └──────┬──────┘
              │
              ▼
         ┌────────┐
         │Success!│
         └────────┘
```

## Where It's Implemented

### 1. Migration Runner ([scripts/run-migration.js](scripts/run-migration.js))

**Output Example (Development with .env):**
```bash
$ npm run migrate:up

🔍 Environment Detection:
   Mode: DEVELOPMENT
   📝 Loaded from: .env file (C:\...\server\.env)

📦 Database Connection:
   Source: .env file
   Host: pg-xxx.aivencloud.com:10168

🚀 Running migration: up
```

**Output Example (Production):**
```bash
$ npm run migrate:up

🔍 Environment Detection:
   Mode: PRODUCTION
   🚀 Using: System environment variables (production mode)

📦 Database Connection:
   Source: system environment variables (production mode)
   Host: prod-db.render.com:5432

🚀 Running migration: up
```

### 2. Migration Status ([scripts/check-migration-status.js](scripts/check-migration-status.js))

**Output:**
```bash
$ npm run migrate:status

✅ Connected to database
   Source: .env file
   Host: pg-xxx.aivencloud.com:10168

📁 Found 25 migration files in migrations/
✓ 25 migrations have been applied to database
```

### 3. Admin Seeding ([scripts/seed-admin.js](scripts/seed-admin.js))

**Output:**
```bash
$ npm run seed:admin

📝 Environment loaded from: .env file
📦 Database host: pg-xxx.aivencloud.com:10168

🌱 Starting admin user seeding...
✅ Admin user created successfully!
```

### 4. Server Startup ([src/config/postgres.db.ts](src/config/postgres.db.ts))

**Output:**
```bash
$ npm start

🔍 Database Configuration:
   Mode: DEVELOPMENT
   Environment source: .env file
   Host: pg-xxx.aivencloud.com:10168
   SSL: Enabled

✅ Connected to PostgreSQL
```

## Platform-Specific Examples

### Local Development

**Setup:**
```bash
# server/.env
DATABASE_URL=postgres://user:pass@localhost:5432/db
NODE_ENV=development
```

**What Happens:**
- Reads from `.env` file
- Logs: "Environment source: .env file"
- Perfect for local testing

### Render.com Deployment

**Setup in Render Dashboard:**
```
DATABASE_URL=postgres://...render.com/db?ssl=true
NODE_ENV=production
```

**What Happens:**
- No `.env` file in container
- Reads from system environment
- Logs: "Environment source: system environment variables (production)"
- ✅ Works perfectly!

### Vercel Deployment

**Setup in Vercel Dashboard:**
```
Environment Variables →
  DATABASE_URL: postgres://...
  NODE_ENV: production
```

**What Happens:**
- Variables injected at runtime
- No `.env` file needed
- Logs: "Using: system environment variables (production mode)"
- ✅ Works perfectly!

### Docker Container

**Option 1: Environment Variables**
```bash
docker run -e DATABASE_URL=postgres://... \
           -e NODE_ENV=production \
           your-app
```
Result: Uses system variables ✅

**Option 2: Mount .env File**
```bash
docker run -v $(pwd)/.env:/app/.env your-app
```
Result: Reads from .env file ✅

**Both work!**

### AWS/GCP with Secrets Manager

```javascript
// Platform injects secrets as environment variables
process.env.DATABASE_URL = 'postgres://...'
process.env.NODE_ENV = 'production'

// Our code reads from process.env
// Logs: "system environment variables (production)"
```
✅ Works perfectly!

## Code Pattern Used

### Smart Loading Pattern

```javascript
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import path from 'path';

const envPath = path.join(__dirname, '../.env');
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction && existsSync(envPath)) {
  // Development with .env file
  dotenv.config({ path: envPath });
  console.log('📝 Loaded from: .env file');
} else if (isProduction) {
  // Production - use system variables
  console.log('🚀 Using: System environment variables');
} else {
  // Fallback - system variables
  console.log('⚠️  No .env file, using system variables');
}

// Validate it worked
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found!');
  process.exit(1);
}
```

## Benefits

### 1. **Works Everywhere**
- ✅ Your laptop with `.env` file
- ✅ Render.com with dashboard variables
- ✅ Vercel with environment tab
- ✅ Heroku with config vars
- ✅ AWS/GCP with secrets manager
- ✅ Docker with `-e` flags or mounted `.env`

### 2. **Security**
- No credentials in code
- Production variables never overridden
- `.env` files in `.gitignore`
- Clear audit trail of variable sources

### 3. **Debugging**
Every script tells you exactly where it got DATABASE_URL from:
```
✅ Connected to database
   Source: .env file
   Host: pg-xxx.aivencloud.com:10168
```

No more guessing if variables are loaded correctly!

### 4. **Best Practices**
Follows the same pattern as:
- 12-Factor App methodology
- Heroku's config vars
- Vercel's environment variables
- Docker's environment injection
- Kubernetes secrets

## Testing the Setup

### Test 1: Local Development
```bash
cd server
npm run migrate:status

# Expected output:
# ✅ Connected to database
#    Source: .env file
#    Host: [your-db-host]
```

### Test 2: Production Simulation
```bash
cd server
export NODE_ENV=production
export DATABASE_URL=postgres://user:pass@host/db
npm run migrate:status

# Expected output:
# ✅ Connected to database
#    Source: system environment variables (production)
#    Host: host
```

### Test 3: No .env File (Fallback)
```bash
cd server
mv .env .env.backup
npm run migrate:status

# Expected output:
# ⚠️  No .env file found, using system variables
# ✅ Connected to database
#    Source: system environment variables (fallback)
```

## Troubleshooting

### Issue: "DATABASE_URL not found"

**Check:**
1. Is `.env` file in `server/` directory?
2. Does `.env` have `DATABASE_URL=...`?
3. Or are system variables set? Check with: `echo $DATABASE_URL`

**Solution:**
```bash
# For local dev:
cp server/.env.example server/.env
# Edit .env and add your DATABASE_URL

# For production:
# Set variables in platform dashboard
```

### Issue: Using wrong DATABASE_URL

**Check logs for:**
```
📦 Database Connection:
   Source: [this tells you where it came from]
   Host: [this shows which database]
```

**If wrong source:**
- Development: Check `.env` file contents
- Production: Check platform environment variables

### Issue: SSL errors

**Check logs for:**
```
🔍 Database Configuration:
   SSL: Enabled/Disabled
```

**If SSL is disabled but needed:**
- Add `?sslmode=require` or `?ssl=true` to DATABASE_URL
- The app auto-detects SSL from URL

## Migration from Old Setup

### What Changed

**Before (Problematic):**
```javascript
// Always used override
dotenv.config({ override: true });

// Would fail in production
if (result.error) {
  process.exit(1); // ❌ Dies if no .env
}
```

**After (Production-Ready):**
```javascript
// Smart loading
if (!isProduction && existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // Use system variables
}

// Validates from either source
if (!process.env.DATABASE_URL) {
  process.exit(1);
}
```

### No Breaking Changes

✅ Existing local development: Still works with `.env`
✅ Existing production: Now works with system variables
✅ All platforms: Compatible

## Summary

This smart environment loading system:

1. **Detects environment** (production vs development)
2. **Loads variables** from appropriate source
3. **Validates** DATABASE_URL exists
4. **Logs clearly** where it came from
5. **Works everywhere** (local, Render, Vercel, AWS, Docker)

You never have to guess where your environment variables are coming from. Every script tells you exactly what it's using! 🎉

---

**For more details:**
- [DATABASE_SETUP.md](DATABASE_SETUP.md) - Database setup guide
- [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) - Deployment instructions
- [.env.example](.env.example) - Environment variable template
