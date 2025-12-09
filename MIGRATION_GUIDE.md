# PostgreSQL Migration Guide (node-pg-migrate)

## Table of Contents
1. [Understanding Migrations](#understanding-migrations)
2. [Common Commands](#common-commands)
3. [Modifying Existing Tables](#modifying-existing-tables)
4. [Migration Operations Reference](#migration-operations-reference)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

---

## Understanding Migrations

**Migrations** are version control for your database schema. They allow you to:
- Track changes to your database structure over time
- Apply changes in a consistent way across environments
- Rollback changes if needed
- Collaborate with team members without conflicts

### How It Works

1. **Migration Files**: Each file represents a single database change
2. **Tracking Table**: `pgmigrations` table stores which migrations have been run
3. **Sequential Execution**: Migrations run in order based on timestamp in filename
4. **Idempotent**: Once run, a migration won't run again (unless rolled back)

### File Naming Convention
```
1761552714444_add-word-count-to-documents.js
    ↑              ↑
  timestamp    description
```

---

## Common Commands

### Check Migration Status

**Method 1: Use the status script (Recommended)**
```bash
npm run migrate:status
```

This shows a clear summary of:
- ✅ Which migrations have been applied
- ⏳ Which migrations are pending
- Total count of each

**Method 2: Dry run**
```bash
npm run migrate:up -- --dry-run
```

Shows what migrations would be run and the exact SQL.

**Method 3: Check the database directly**
```bash
psql $DATABASE_URL -c "SELECT * FROM pgmigrations ORDER BY run_on;"
```

### Run Migrations
```bash
# Run all pending migrations
npm run migrate:up

# Dry run (see what would happen without executing)
npm run migrate:up -- --dry-run

# Run migrations in verbose mode
npm run migrate:up -- --verbose
```

### Create New Migration
```bash
# Create a new migration file
npm run migrate:create my-migration-name

# Example
npm run migrate:create add-status-to-users
```

### Rollback Migrations
```bash
# Rollback the last migration
npm run migrate:down

# Rollback multiple migrations
npm run migrate:down 3

# Dry run rollback
npm run migrate:down -- --dry-run
```

---

## Modifying Existing Tables

### ⚠️ CRITICAL RULE
**NEVER modify a migration file after it has been run in production!**

### Scenario 1: Pending Migrations (Not Yet Run)
✅ **You CAN modify the migration file directly**

```javascript
// migrations/1760030000010_create-documents-table.js
export const up = (pgm) => {
  pgm.createTable('documents', {
    title: { type: 'varchar(255)', notNull: true },
    // ADD YOUR NEW FIELD HERE
    description: { type: 'text', notNull: false }
  });
};
```

Then run:
```bash
npm run migrate:up
```

### Scenario 2: Migration Already Run (Most Common)
✅ **Create a NEW migration file**

1. **Create the migration:**
```bash
npm run migrate:create add-description-to-documents
```

2. **Edit the new file:**
```javascript
export const up = (pgm) => {
  pgm.addColumn('documents', {
    description: {
      type: 'text',
      notNull: false,
      comment: 'Document description'
    }
  });
};

export const down = (pgm) => {
  pgm.dropColumn('documents', 'description');
};
```

3. **Run it:**
```bash
npm run migrate:up
```

### Scenario 3: Development Environment (Rollback)
⚠️ **Only for development! Will delete data!**

```bash
# Rollback the migration
npm run migrate:down

# Edit the migration file
# Then run it again
npm run migrate:up
```

---

## Migration Operations Reference

### Table Operations

#### Create Table
```javascript
export const up = (pgm) => {
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    email: {
      type: 'varchar(255)',
      notNull: true,
      unique: true
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });
};

export const down = (pgm) => {
  pgm.dropTable('users');
};
```

#### Rename Table
```javascript
export const up = (pgm) => {
  pgm.renameTable('old_table_name', 'new_table_name');
};

export const down = (pgm) => {
  pgm.renameTable('new_table_name', 'old_table_name');
};
```

#### Drop Table
```javascript
export const up = (pgm) => {
  pgm.dropTable('table_name', { ifExists: true, cascade: true });
};
```

### Column Operations

#### Add Column
```javascript
export const up = (pgm) => {
  pgm.addColumn('users', {
    phone: {
      type: 'varchar(20)',
      notNull: false
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'active'
    }
  });
};

export const down = (pgm) => {
  pgm.dropColumn('users', ['phone', 'status']);
};
```

#### Drop Column
```javascript
export const up = (pgm) => {
  pgm.dropColumn('users', 'old_column');
  // Or drop multiple
  pgm.dropColumn('users', ['column1', 'column2']);
};

export const down = (pgm) => {
  // Add them back
  pgm.addColumn('users', {
    old_column: { type: 'text', notNull: false }
  });
};
```

#### Rename Column
```javascript
export const up = (pgm) => {
  pgm.renameColumn('users', 'old_name', 'new_name');
};

export const down = (pgm) => {
  pgm.renameColumn('users', 'new_name', 'old_name');
};
```

#### Alter Column Type
```javascript
export const up = (pgm) => {
  pgm.alterColumn('users', 'email', {
    type: 'varchar(500)',  // Change from 255 to 500
    notNull: true
  });
};

export const down = (pgm) => {
  pgm.alterColumn('users', 'email', {
    type: 'varchar(255)',
    notNull: true
  });
};
```

#### Set Column Default
```javascript
export const up = (pgm) => {
  pgm.alterColumn('users', 'status', {
    default: 'pending'
  });
};

export const down = (pgm) => {
  pgm.alterColumn('users', 'status', {
    default: null
  });
};
```

### Index Operations

#### Create Index
```javascript
export const up = (pgm) => {
  // Simple index
  pgm.createIndex('users', 'email');

  // Named index
  pgm.createIndex('users', 'username', {
    name: 'idx_users_username',
    unique: true
  });

  // Composite index
  pgm.createIndex('users', ['school_id', 'user_type'], {
    name: 'idx_users_school_type'
  });

  // Partial index
  pgm.createIndex('users', 'deleted_at', {
    name: 'idx_users_deleted',
    where: 'deleted_at IS NOT NULL'
  });
};

export const down = (pgm) => {
  pgm.dropIndex('users', 'email');
  pgm.dropIndex('users', 'username', { name: 'idx_users_username' });
  pgm.dropIndex('users', ['school_id', 'user_type'], {
    name: 'idx_users_school_type'
  });
  pgm.dropIndex('users', 'deleted_at', { name: 'idx_users_deleted' });
};
```

### Constraint Operations

#### Add Check Constraint
```javascript
export const up = (pgm) => {
  pgm.addConstraint('users', 'users_status_check', {
    check: "status IN ('active', 'inactive', 'suspended')"
  });
};

export const down = (pgm) => {
  pgm.dropConstraint('users', 'users_status_check');
};
```

#### Add Unique Constraint
```javascript
export const up = (pgm) => {
  // Simple unique
  pgm.addConstraint('users', 'users_email_unique', {
    unique: 'email'
  });

  // Composite unique
  pgm.addConstraint('users', 'users_school_username_unique', {
    unique: ['school_id', 'username']
  });

  // Partial unique (only for non-null values)
  pgm.addConstraint('users', 'users_email_key', {
    unique: 'email',
    where: 'email IS NOT NULL'
  });
};

export const down = (pgm) => {
  pgm.dropConstraint('users', 'users_email_unique');
  pgm.dropConstraint('users', 'users_school_username_unique');
  pgm.dropConstraint('users', 'users_email_key');
};
```

#### Add Foreign Key
```javascript
export const up = (pgm) => {
  pgm.addConstraint('documents', 'documents_owner_fk', {
    foreignKeys: {
      columns: 'owner_id',
      references: 'users(id)',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    }
  });
};

export const down = (pgm) => {
  pgm.dropConstraint('documents', 'documents_owner_fk');
};
```

### Data Operations

#### Insert Data
```javascript
export const up = (pgm) => {
  pgm.sql(`
    INSERT INTO plans (name, description, price)
    VALUES
      ('Free', 'Basic plan', 0),
      ('Pro', 'Professional plan', 29.99),
      ('Enterprise', 'Enterprise plan', 99.99)
  `);
};

export const down = (pgm) => {
  pgm.sql(`DELETE FROM plans WHERE name IN ('Free', 'Pro', 'Enterprise')`);
};
```

#### Update Data
```javascript
export const up = (pgm) => {
  // Update existing data
  pgm.sql(`
    UPDATE users
    SET status = 'active'
    WHERE status IS NULL
  `);

  // Then make it not null
  pgm.alterColumn('users', 'status', {
    notNull: true,
    default: 'active'
  });
};
```

### Function & Trigger Operations

#### Create Function and Trigger
```javascript
export const up = (pgm) => {
  // Create function
  pgm.createFunction(
    'update_updated_at',
    [],
    {
      returns: 'trigger',
      language: 'plpgsql',
      replace: true
    },
    `
    BEGIN
      NEW.updated_at = current_timestamp;
      RETURN NEW;
    END;
    `
  );

  // Create trigger
  pgm.createTrigger('users', 'users_updated_at_trigger', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_updated_at',
    level: 'ROW'
  });
};

export const down = (pgm) => {
  pgm.dropTrigger('users', 'users_updated_at_trigger', { ifExists: true });
  pgm.dropFunction('update_updated_at', [], { ifExists: true });
};
```

---

## Best Practices

### 1. Always Write `down()` Functions
Even if you don't plan to rollback, write proper `down()` functions. They serve as documentation.

```javascript
export const up = (pgm) => {
  pgm.addColumn('users', { phone: { type: 'varchar(20)' } });
};

export const down = (pgm) => {
  pgm.dropColumn('users', 'phone');
};
```

### 2. Use Transactions
Migrations run in transactions by default. Keep them atomic - one logical change per migration.

### 3. Test Rollbacks
Always test your `down()` function:

```bash
npm run migrate:up -- --dry-run
npm run migrate:down -- --dry-run
```

### 4. Add Comments
Document complex migrations:

```javascript
export const up = (pgm) => {
  // Add soft delete support to users table
  // This allows us to mark users as deleted without losing data
  pgm.addColumn('users', {
    deleted_at: {
      type: 'timestamp',
      notNull: false,
      comment: 'Timestamp when user was soft deleted'
    }
  });
};
```

### 5. Handle Existing Data
When making columns NOT NULL, update existing data first:

```javascript
export const up = (pgm) => {
  // First, set default for existing rows
  pgm.sql(`UPDATE users SET status = 'active' WHERE status IS NULL`);

  // Then make it not null
  pgm.alterColumn('users', 'status', {
    notNull: true,
    default: 'active'
  });
};
```

### 6. Use `ifExists` for Safety
```javascript
export const down = (pgm) => {
  pgm.dropIndex('users', 'email', { ifExists: true });
  pgm.dropColumn('users', 'phone', { ifExists: true });
};
```

### 7. Naming Conventions
- **Tables**: Plural, lowercase, underscores: `users`, `class_enrollments`
- **Columns**: Lowercase, underscores: `first_name`, `created_at`
- **Indexes**: `idx_table_column`: `idx_users_email`
- **Constraints**: `table_column_type`: `users_email_unique`, `users_status_check`
- **Foreign Keys**: `table_referenced_fk`: `documents_owner_fk`

---

## Troubleshooting

### Migration Already Run But I Need to Change It

**DON'T**: Modify the existing migration file
**DO**: Create a new migration with the changes

```bash
npm run migrate:create fix-user-email-length
```

### Reset Database (Development Only)

```bash
# Rollback all migrations
npm run migrate:down 0

# Drop the database
psql -c "DROP DATABASE writeup;"
psql -c "CREATE DATABASE writeup;"

# Run migrations again
npm run migrate:up
```

### Check What's Been Run

```sql
-- Connect to database
psql $DATABASE_URL

-- View migration history
SELECT * FROM pgmigrations ORDER BY run_on;

-- Check table structure
\d+ documents

-- List all tables
\dt

-- Exit
\q
```

### Migration Failed Mid-Way

Migrations run in transactions, so partial failures should rollback automatically. If not:

```bash
# Check status
npm run migrate:up -- --dry-run

# Manual rollback
npm run migrate:down

# Fix the migration file
# Run again
npm run migrate:up
```

### Can't Connect to Database

Check your `.env` file:
```bash
DATABASE_URL=postgresql://user:password@localhost:5433/writeup
```

Test connection:
```bash
psql $DATABASE_URL -c "SELECT version();"
```

### TypeError: "path" argument must be of type string

**Error:**
```
TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string. Received undefined
    at validateString (node:internal/validators:162:11)
    at join (node:path:433:7)
```

**Cause:** Missing migrations directory configuration in package.json scripts

**Solution:** Ensure your `package.json` scripts include `--migrations-dir migrations`:

```json
{
  "scripts": {
    "migrate:create": "node-pg-migrate create --migrations-dir migrations",
    "migrate:up": "node-pg-migrate up --migrations-dir migrations",
    "migrate:down": "node-pg-migrate down --migrations-dir migrations"
  }
}
```

**Why this is needed:** When using ES modules (`"type": "module"` in package.json), node-pg-migrate needs explicit configuration via command-line flags.

**Alternative (not recommended):** Create a config file, but this causes issues with ES module imports in newer Node.js versions.

---

## Real-World Examples

### Example 1: Add a Field to Existing Table

**Scenario**: Add a `bio` field to users table

```bash
npm run migrate:create add-bio-to-users
```

```javascript
// migrations/XXXXX_add-bio-to-users.js
export const up = (pgm) => {
  pgm.addColumn('users', {
    bio: {
      type: 'text',
      notNull: false,
      comment: 'User biography/description'
    }
  });
};

export const down = (pgm) => {
  pgm.dropColumn('users', 'bio');
};
```

### Example 2: Remove a Field

**Scenario**: Remove `edit_history` from documents

```bash
npm run migrate:create remove-edit-history-from-documents
```

```javascript
export const up = (pgm) => {
  pgm.dropColumn('documents', 'edit_history');
};

export const down = (pgm) => {
  // Restore the column (data will be lost!)
  pgm.addColumn('documents', {
    edit_history: {
      type: 'jsonb',
      notNull: true,
      default: '[]',
      comment: 'History of edits made to document'
    }
  });
};
```

### Example 3: Rename a Field

**Scenario**: Rename `birth_year` to `date_of_birth`

```bash
npm run migrate:create rename-birth-year-to-date-of-birth
```

```javascript
export const up = (pgm) => {
  // Rename the column
  pgm.renameColumn('users', 'birth_year', 'date_of_birth');

  // If changing type too:
  pgm.alterColumn('users', 'date_of_birth', {
    type: 'date'
  });
};

export const down = (pgm) => {
  pgm.alterColumn('users', 'date_of_birth', {
    type: 'integer'
  });
  pgm.renameColumn('users', 'date_of_birth', 'birth_year');
};
```

### Example 4: Add Multiple Related Changes

**Scenario**: Add status tracking to documents

```bash
npm run migrate:create add-status-tracking-to-documents
```

```javascript
export const up = (pgm) => {
  // Add status column
  pgm.addColumn('documents', {
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'draft',
      comment: 'Document status: draft, published, archived'
    },
    published_at: {
      type: 'timestamp',
      notNull: false,
      comment: 'When document was published'
    },
    archived_at: {
      type: 'timestamp',
      notNull: false,
      comment: 'When document was archived'
    }
  });

  // Add check constraint
  pgm.addConstraint('documents', 'documents_status_check', {
    check: "status IN ('draft', 'published', 'archived')"
  });

  // Add indexes
  pgm.createIndex('documents', 'status');
  pgm.createIndex('documents', ['owner_id', 'status']);
};

export const down = (pgm) => {
  pgm.dropConstraint('documents', 'documents_status_check');
  pgm.dropIndex('documents', 'status');
  pgm.dropIndex('documents', ['owner_id', 'status']);
  pgm.dropColumn('documents', ['status', 'published_at', 'archived_at']);
};
```

---

## Quick Reference Card

```bash
# Create migration
npm run migrate:create <name>

# Run migrations
npm run migrate:up

# Dry run
npm run migrate:up -- --dry-run

# Rollback last
npm run migrate:down

# Rollback N
npm run migrate:down <N>
```

**Common Operations:**
```javascript
// Add column
pgm.addColumn('table', { col: { type: 'text' } });

// Remove column
pgm.dropColumn('table', 'col');

// Rename column
pgm.renameColumn('table', 'old', 'new');

// Alter column
pgm.alterColumn('table', 'col', { type: 'varchar(500)' });

// Add index
pgm.createIndex('table', 'col');

// Add constraint
pgm.addConstraint('table', 'name', { check: "col IN ('a', 'b')" });
```

---

## Additional Resources

- [node-pg-migrate Documentation](https://salsita.github.io/node-pg-migrate/)
- [PostgreSQL Data Types](https://www.postgresql.org/docs/current/datatype.html)
- [PostgreSQL Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)

---

**Remember**:
- ✅ Create new migrations for changes
- ❌ Don't modify existing migrations (after they're run)
- 🔄 Always test your `down()` functions
- 📝 Document complex migrations
- 🧪 Use `--dry-run` before applying
