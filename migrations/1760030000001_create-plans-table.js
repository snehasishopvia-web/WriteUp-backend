/**
 * Migration: Create plans table
 *
 * This table stores subscription plan information for the platform.
 * Plans define resource limits and features available to accounts.
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
  pgm.createTable('plans', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    name: {
      type: 'varchar(100)',
      notNull: true,
      unique: true
    },
    slug: {
      type: 'varchar(100)',
      notNull: true,
      unique: true
    },
    description: {
      type: 'text',
      notNull: false
    },
    price_monthly: {
      type: 'decimal(10,2)',
      notNull: true
    },
    features: {
      type: "jsonb",
      notNull: true,
      default: "[]",
    },
    price_yearly: {
      type: 'decimal(10,2)',
      notNull: true
    },
    max_schools: {
      type: 'integer',
      notNull: true,
      default: 1
    },
    max_students_per_school: {
      type: 'integer',
      notNull: true,
      default: 100
    },
    max_teachers_per_school: {
      type: 'integer',
      notNull: true,
      default: 20
    },
    max_classes_per_school: {
      type: 'integer',
      notNull: true,
      default: 10
    },
    max_storage_gb: {
      type: 'integer',
      notNull: true,
      default: 5
    },
    allow_custom_branding: {
      type: 'boolean',
      notNull: true,
      default: false
    },
    allow_api_access: {
      type: 'boolean',
      notNull: true,
      default: false
    },
    allow_advanced_reports: {
      type: 'boolean',
      notNull: true,
      default: false
    },
    allow_parent_portal: {
      type: 'boolean',
      notNull: true,
      default: false
    },
    display_order: {
      type: 'integer',
      notNull: true,
      default: 0
    },
    is_featured: {
      type: 'boolean',
      notNull: true,
      default: false
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

  // Create indexes
  pgm.createIndex('plans', 'slug');
  pgm.createIndex('plans', 'is_active');
  pgm.createIndex('plans', 'display_order');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
const down = (pgm) => {
  pgm.dropTable('plans');
};

module.exports = {
  shorthands,
  up,
  down,
};
