/**
 * Migration: Create accounts and schools tables
 *
 * Creates independent accounts and schools tables.
 * Note: schools.admin_id is just a UUID field (no FK) to avoid circular dependency.
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
const up = (pgm) => {
  // Create accounts table
  pgm.createTable('accounts', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    owner_email: {
      type: 'varchar(255)',
      notNull: true,
      unique: true
    },
    owner_name: {
      type: 'varchar(200)',
      notNull: true
    },
    company_name: {
      type: 'varchar(200)',
      notNull: false
    },
    plan_id: {
      type: 'uuid',
      notNull: true,
      references: 'plans',
      onDelete: 'RESTRICT'
    },
    subscription_status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'trial'
    },
    subscription_start_date: {
      type: 'date',
      notNull: true,
      default: pgm.func('current_date')
    },
    subscription_end_date: {
      type: 'date',
      notNull: false
    },
    billing_cycle: {
      type: 'varchar(10)',
      notNull: true,
      default: 'monthly'
    },
    phone: {
      type: 'varchar(20)',
      notNull: false
    },
    address: {
      type: 'text',
      notNull: false
    },
    timezone: {
      type: 'varchar(50)',
      notNull: true,
      default: 'UTC'
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  // Accounts indexes
  pgm.createIndex('accounts', 'owner_email');
  pgm.createIndex('accounts', 'plan_id');
  pgm.createIndex('accounts', 'is_active');
  pgm.createIndex('accounts', ['subscription_status', 'is_active']);

  // Create schools table (without FK to users.admin_id to avoid circular dependency)
  pgm.createTable('schools', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    name: {
      type: 'varchar(200)',
      notNull: true
    },
    school_type: {
      type: 'varchar(50)',
      notNull: true
    },
    class_structure_type: {
      type: 'varchar(20)',
      notNull: true
    },
    additional_programs: {
      type: 'jsonb',
      notNull: true,
      default: '[]'
    },
    admin_id: {
      type: 'uuid',
      notNull: true
      // NO FK constraint here - just a plain UUID field
    },
    timezone: {
      type: 'varchar(100)',
      notNull: true,
      default: 'UTC'
    },
    onboarding_completed: {
      type: 'boolean',
      notNull: true,
      default: false
    },
    teachers_uploaded: {
      type: 'boolean',
      notNull: true,
      default: false
    },
    students_uploaded: {
      type: 'boolean',
      notNull: true,
      default: false
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  // Schools unique constraint
  pgm.addConstraint('schools', 'schools_name_admin_id_unique', {
    unique: ['name', 'admin_id']
  });

  // Schools indexes
  pgm.createIndex('schools', 'admin_id');
  pgm.createIndex('schools', 'school_type');
  pgm.createIndex('schools', 'timezone');
  pgm.createIndex('schools', 'onboarding_completed');
  pgm.createIndex('schools', ['admin_id', 'onboarding_completed']);

  // Schools check constraints for valid enum values
  pgm.addConstraint('schools', 'schools_school_type_check', {
    check: `school_type IN (
      'elementary', 'middle-2', 'middle-3', 'middle-4', 'high-4',
      'college-university-1', 'college-university-2', 'college-university-3',
      'college-university-4', 'graduate', 'other'
    )`
  });

  pgm.addConstraint('schools', 'schools_class_structure_type_check', {
    check: "class_structure_type IN ('semester', 'quarter', 'yearly')"
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
const down = (pgm) => {
  pgm.dropTable('schools');
  pgm.dropTable('accounts');
};

module.exports = {
  shorthands,
  up,
  down,
};
