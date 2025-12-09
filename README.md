# Server Setup Guide

This is the backend server for the WriteUp application built with Node.js, Express, and PostgreSQL.

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v13 or higher)
- npm or yarn package manager

## Initial Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Database Setup

Create a PostgreSQL database for the project:

```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE writeup_db;

# Exit PostgreSQL
\q
```

### 3. Environment Configuration

Create a `.env` file in the `server` directory with the following variables:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/writeup_db

# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Secret (use a strong random string)
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# Other configurations (add as needed)
```

**Note:** Replace `username` and `password` with your PostgreSQL credentials. The `.env` file is not tracked in git for security reasons.

### 4. Run Database Migrations

Run migrations to create all database tables:

```bash
npm run migrate:up
```

To check migration status:

```bash
npm run migrate:status
```

To rollback the last migration (if needed):

```bash
npm run migrate:down
```

## Running the Server

### Development Mode

```bash
npm run start
```

The server will start on `http://localhost:8192` (or the PORT specified in `.env`)

### Production Mode

```bash
npm run start:prod
```

## Available Scripts

- `npm run start` - Start server in development mode with auto-reload
- `npm run start:prod` - Start server in production mode
- `npm run migrate:up` - Run all pending migrations
- `npm run migrate:down` - Rollback the last migration
- `npm run migrate:status` - Check migration status
- `npm run migrate:create <migration-name>` - Create a new migration file

## Project Structure

```
server/
├── migrations/        # Database migration files
├── src/              # Source code
│   ├── routes/       # API routes
│   ├── controllers/  # Route controllers
│   ├── models/       # Database models
│   ├── middleware/   # Custom middleware
│   └── config/       # Configuration files
├── .env              # Environment variables (not tracked in git)
├── package.json      # Project dependencies
└── README.md         # This file
```

## Troubleshooting

### Migration Errors

If you encounter migration errors:

1. Check that PostgreSQL is running
2. Verify database credentials in `.env`
3. Check migration status: `npm run migrate:status`
4. Ensure all migration files are present in the `migrations` folder

### Connection Issues

- Verify PostgreSQL is running: `psql -U postgres`
- Check DATABASE_URL in `.env` file
- Ensure the database exists: `psql -U postgres -c "\l"`

## Contributing

When creating new features that require database changes:

1. Create a new migration: `npm run migrate:create <descriptive-name>`
2. Edit the generated migration file in `migrations/` folder
3. Test the migration: `npm run migrate:up`
4. Commit the migration file to git

**Important:** Always commit migration files so other developers can sync their database schema.
