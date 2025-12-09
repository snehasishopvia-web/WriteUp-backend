# Database Setup Guide

This guide explains how to set up and manage the PostgreSQL database for the WriteUp application.

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database (local or cloud-hosted)
- npm or yarn package manager

## Environment Configuration

### 1. Create Environment File

Copy the example environment file:

```bash
cp .env.example .env
```

### 2. Configure Database Connection

Edit `.env` and set your `DATABASE_URL`:

#### For Cloud Databases (Aiven, Render, AWS RDS, etc.)

```env
# Aiven PostgreSQL
DATABASE_URL=postgres://avnadmin:password@host.aivencloud.com:port/defaultdb?sslmode=require

# Render PostgreSQL
DATABASE_URL=postgresql://user:password@host.render.com/db?ssl=true

# AWS RDS PostgreSQL
DATABASE_URL=postgresql://user:password@host.rds.amazonaws.com:5432/db?sslmode=require
```

#### For Local PostgreSQL

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/writeup
```

### 3. SSL Configuration

The application automatically detects if SSL is required based on the DATABASE_URL:
- URLs with `sslmode=require` or `ssl=true`
- URLs containing `.aivencloud.com`, `.render.com`, etc.

For self-signed certificates, set:
```env
NODE_TLS_REJECT_UNAUTHORIZED=0
```

⚠️ **Warning**: Only use `NODE_TLS_REJECT_UNAUTHORIZED=0` in development. For production, use proper SSL certificates.

## Database Migrations

### Run Migrations

Apply all pending migrations to create database tables:

```bash
npm run migrate:up
```

This will:
- Create all necessary tables (users, plans, schools, classes, documents, etc.)
- Set up indexes and constraints
- Apply any pending schema changes

### Check Migration Status

See which migrations have been applied:

```bash
npm run migrate:status
```

### Rollback Migrations

Rollback the last migration:

```bash
npm run migrate:down
```

### Create New Migration

Create a new migration file:

```bash
npm run migrate:create -- migration-name
```

## Seed Data

### Create Admin User

After running migrations, seed the default admin user:

```bash
npm run seed:admin
```

Default admin credentials:
- Email: `admin@admin.com`
- Password: `Admin@1234`

⚠️ **Important**: Change the admin password after first login in production!

### Complete Setup

Run both migrations and seeding in one command:

```bash
npm run setup
```

## Troubleshooting

### SSL Certificate Errors

If you see errors like:
```
self-signed certificate in certificate chain
```

**Solution**: Add `NODE_TLS_REJECT_UNAUTHORIZED=0` to your `.env` file (development only).

### Connection Refused

If you see:
```
ECONNREFUSED
```

**Check**:
1. Database host and port are correct
2. Database is running
3. Firewall allows connections
4. IP is whitelisted (for cloud databases)

### Authentication Failed

If you see:
```
password authentication failed
```

**Check**:
1. Username and password are correct
2. User has access to the specified database
3. Connection string format is correct

### Cached Environment Variables

If your changes to `.env` aren't being picked up:

**Solution**: Close your terminal and open a new one, or unset the cached variable:

```bash
# Bash/Git Bash
unset DATABASE_URL

# PowerShell
Remove-Item Env:DATABASE_URL

# CMD
set DATABASE_URL=
```

## Production Deployment

### Environment Variables

For production deployments (Render, Heroku, Vercel, etc.):

1. Set environment variables through the platform's dashboard
2. Never commit `.env` files to git
3. Use proper SSL certificates (remove `NODE_TLS_REJECT_UNAUTHORIZED`)

### Migration Strategy

1. **Before Deployment**: Test migrations locally
2. **During Deployment**: Run migrations automatically via build script
3. **After Deployment**: Verify migration status

Example build script for Render:
```bash
npm install
npm run migrate:up
npm run build
```

### Database Backups

Always backup your database before running migrations in production:

```bash
# PostgreSQL backup
pg_dump $DATABASE_URL > backup.sql

# Restore if needed
psql $DATABASE_URL < backup.sql
```

## Database Schema

The application uses the following main tables:

- **users**: User accounts (admin, teacher, student, parent)
- **accounts**: Organization accounts with subscription plans
- **schools**: Educational institutions
- **plans**: Subscription plans and pricing
- **classes**: Course/class information
- **assignments**: Student assignments
- **documents**: Document storage with versioning
- **folders**: File organization structure
- **submissions**: Student assignment submissions
- **payments**: Stripe payment records

For detailed schema information, see the migration files in `/migrations/`.

## Support

If you encounter issues:
1. Check migration status: `npm run migrate:status`
2. Review error logs
3. Verify environment variables are loaded correctly
4. Ensure database connection is working

For self-signed certificate issues in development, the scripts automatically handle SSL configuration when you use `override: true` in dotenv.config().
