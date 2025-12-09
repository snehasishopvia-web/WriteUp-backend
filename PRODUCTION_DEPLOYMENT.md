# Production Deployment Guide

This document explains how to deploy the WriteUp server to production environments.

## Quick Summary of Changes

### Files Modified for Production-Ready Deployment

1. **`src/config/postgres.db.ts`** - Auto-detects SSL requirements + shows environment source
2. **`scripts/check-migration-status.js`** - Smart env loading + shows database source
3. **`scripts/seed-admin.js`** - Smart env loading + shows database source
4. **`scripts/run-migration.js`** - Smart env loading with detailed logging
5. **`.node-pg-migraterc.json`** - SSL configuration for migrations
6. **`package.json`** - Updated migration commands to use helper script

### Smart Environment Loading

All scripts now use smart environment loading that:
- ✅ **Development mode**: Loads from `.env` file if it exists
- ✅ **Production mode**: Uses system environment variables only
- ✅ **Fallback**: Uses system variables if no `.env` file found
- ✅ **Clear logging**: Shows exactly where DATABASE_URL came from
- ✅ **Safe**: Production variables never overridden by accidental `.env` files

## Environment Variables Setup

### Required Environment Variables

```env
# Server
PORT=8192
NODE_ENV=production

# Database - Must include SSL parameters for cloud databases
DATABASE_URL=postgres://user:password@host:port/db?sslmode=require

# JWT
JWT_ACCESS_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_EXPIRY=1800
JWT_REFRESH_EXPIRY=2592000

# Stripe
STRIPE_SECRET_KEY=sk_live_xxxxx

# Email
KICKBOX_API_KEY=your-kickbox-key

# CORS
CORS_ORIGIN=https://yourdomain.com
ALLOWED_HOSTS=yourdomain.com
```

### Important Notes

1. **Never set `NODE_TLS_REJECT_UNAUTHORIZED=0` in production**
2. **Always use `sslmode=require` or `ssl=true` in DATABASE_URL for cloud databases**
3. **Use proper SSL certificates for production databases**

## Deployment Platforms

### Render.com

1. **Create Web Service**
   - Runtime: Node
   - Build Command: `cd server && npm install && npm run migrate:up && npm run build`
   - Start Command: `cd server && npm run start:prod`

2. **Environment Variables**
   - Add all required variables in Render dashboard
   - DATABASE_URL is automatically provided by Render for PostgreSQL

3. **Database**
   - Use Render's managed PostgreSQL
   - SSL is automatically configured

### Heroku

1. **Add Buildpack**
   ```bash
   heroku buildpacks:add heroku/nodejs
   ```

2. **Procfile**
   ```
   web: cd server && npm run start:prod
   release: cd server && npm run migrate:up
   ```

3. **Environment Variables**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set JWT_ACCESS_SECRET=xxxxx
   # ... other variables
   ```

### Vercel

1. **vercel.json** (in server directory)
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "dist/server.js",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/(.*)",
         "dest": "dist/server.js"
       }
     ]
   }
   ```

2. **Environment Variables**
   - Set in Vercel dashboard
   - Add DATABASE_URL from your PostgreSQL provider

### AWS EC2 / VPS

1. **Install Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Clone Repository**
   ```bash
   git clone your-repo-url
   cd WriteUp/server
   npm install
   ```

3. **Setup Environment**
   ```bash
   cp .env.example .env
   nano .env  # Edit with production values
   ```

4. **Run Migrations**
   ```bash
   npm run migrate:up
   npm run seed:admin
   ```

5. **Start with PM2**
   ```bash
   npm install -g pm2
   pm2 start npm --name "writeup-api" -- start
   pm2 save
   pm2 startup
   ```

## Database Providers

### Aiven PostgreSQL

1. **Connection String Format**
   ```
   postgres://avnadmin:password@host.aivencloud.com:port/defaultdb?sslmode=require
   ```

2. **SSL**: Automatically handled by our code
3. **Backups**: Enabled by default in Aiven

### Render PostgreSQL

1. **Connection String Format**
   ```
   postgresql://user:password@host.render.com/db?ssl=true
   ```

2. **SSL**: Automatically handled
3. **Free Tier**: Available with limitations

### AWS RDS PostgreSQL

1. **Enable SSL**
   - Download RDS certificate
   - Add to connection: `?sslmode=require`

2. **Connection String**
   ```
   postgresql://user:password@instance.rds.amazonaws.com:5432/db?sslmode=require
   ```

### Supabase PostgreSQL

1. **Connection String Format**
   ```
   postgresql://postgres:password@db.supabase.co:5432/postgres?sslmode=require
   ```

2. **Direct Connection**: Use the direct connection string, not pooler

## Migration Strategy

### Development → Staging

1. Test migrations locally:
   ```bash
   npm run migrate:status
   npm run migrate:up
   ```

2. Commit migration files:
   ```bash
   git add migrations/
   git commit -m "Add new migration"
   git push
   ```

3. Deploy to staging:
   - Migrations run automatically via build script

### Staging → Production

1. **Backup Production Database**
   ```bash
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
   ```

2. **Test on Staging First**
   - Verify all migrations work
   - Test critical functionality

3. **Deploy to Production**
   - Enable maintenance mode (optional)
   - Deploy application
   - Migrations run automatically
   - Verify deployment
   - Disable maintenance mode

### Rollback Plan

If migration fails:

```bash
# Restore from backup
psql $DATABASE_URL < backup.sql

# Or rollback specific migration
npm run migrate:down
```

## Security Checklist

- [ ] Change default admin password
- [ ] Use strong JWT secrets (32+ characters)
- [ ] Enable CORS only for your domains
- [ ] Use HTTPS for all connections
- [ ] Don't commit `.env` files
- [ ] Use proper SSL certificates (no self-signed in production)
- [ ] Enable database connection pooling
- [ ] Set up database backups
- [ ] Monitor failed login attempts
- [ ] Use rate limiting for APIs

## Monitoring

### Database Connection

The application logs:
```
✅ Connected to PostgreSQL
```

If connection fails:
```
❌ Unexpected DB error
```

### Check Migration Status

```bash
npm run migrate:status
```

### Logs

- **Render**: View in dashboard
- **Heroku**: `heroku logs --tail`
- **PM2**: `pm2 logs writeup-api`

## Troubleshooting

### SSL Issues in Production

**Problem**: `self-signed certificate` error

**Solution**:
1. Verify your database provider supports SSL
2. Check DATABASE_URL includes `sslmode=require` or `ssl=true`
3. Ensure production database has valid SSL certificate

### Migration Failures

**Problem**: Migration hangs or fails

**Solution**:
1. Check database connection: `npm run migrate:status`
2. Verify DATABASE_URL is correct
3. Check database user has CREATE TABLE permissions
4. Review migration file for syntax errors

### Environment Variables Not Loading

**Problem**: Server uses wrong configuration

**Solution**:
1. Verify `.env` exists (local) or variables are set (cloud)
2. Check for typos in variable names
3. Restart the application after changes
4. Clear any cached environment variables

## Performance Optimization

### Database Connection Pooling

Already configured in `src/config/postgres.db.ts`:
- Automatic connection pooling via `pg.Pool`
- Handles connection reuse

### Recommended Pool Settings for Production

```typescript
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,           // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: requiresSSL ? { rejectUnauthorized: false } : false,
});
```

## Support

For issues:
1. Check logs for error messages
2. Verify environment variables
3. Test database connection: `npm run migrate:status`
4. Review migration files in `/migrations/`

---

**Last Updated**: 2024-12-09
