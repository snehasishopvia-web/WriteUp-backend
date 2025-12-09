/**
 * Migration: Create folders table
 *
 * Creates folders table for hierarchical document organization
 * with support for personal and school-scoped folders
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
  pgm.createTable('folders', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    name: {
      type: 'varchar(255)',
      notNull: true
    },
    parent_id: {
      type: 'uuid',
      notNull: false,
      references: 'folders',
      onDelete: 'CASCADE',
      comment: 'Parent folder for hierarchical structure'
    },
    owner_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
      comment: 'User who owns this folder'
    },
    school_id: {
      type: 'uuid',
      notNull: false,
      references: 'schools',
      onDelete: 'CASCADE',
      comment: 'School context for multi-tenancy (NULL for personal folders)'
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

  // Create indexes for efficient queries
  pgm.createIndex('folders', 'owner_id');
  pgm.createIndex('folders', 'parent_id');
  pgm.createIndex('folders', 'school_id');
  pgm.createIndex('folders', ['owner_id', 'parent_id']);
  pgm.createIndex('folders', ['school_id', 'owner_id']);

  // Unique constraint: same name cannot exist under same parent for same owner
  pgm.addConstraint('folders', 'folders_name_parent_owner_unique', {
    unique: ['name', 'parent_id', 'owner_id']
  });

  // Create updated_at trigger
  pgm.createFunction(
    'update_folders_updated_at',
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

  pgm.createTrigger('folders', 'folders_updated_at_trigger', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_folders_updated_at',
    level: 'ROW'
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
const down = (pgm) => {
  pgm.dropTrigger('folders', 'folders_updated_at_trigger', { ifExists: true });
  pgm.dropFunction('update_folders_updated_at', [], { ifExists: true });
  pgm.dropTable('folders');
};

module.exports = {
  shorthands,
  up,
  down,
};
