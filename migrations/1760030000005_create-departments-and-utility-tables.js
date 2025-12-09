/**
 * Migration: Create departments, document_categories, and time_slots tables
 *
 * Utility tables for school management.
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
  // Create departments table
  pgm.createTable('departments', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    school_id: {
      type: 'uuid',
      notNull: true,
      references: 'schools',
      onDelete: 'CASCADE'
    },
    name: {
      type: 'varchar(100)',
      notNull: true
    },
    code: {
      type: 'varchar(20)',
      notNull: true
    },
    description: {
      type: 'text',
      notNull: false
    },
    head_id: {
      type: 'uuid',
      notNull: false,
      references: 'users',
      onDelete: 'SET NULL'
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

  // Departments indexes
  pgm.createIndex('departments', 'school_id');
  pgm.createIndex('departments', 'head_id');
  pgm.createIndex('departments', 'code');

  // Departments unique constraint
  pgm.addConstraint('departments', 'departments_school_code_unique', {
    unique: ['school_id', 'code']
  });

  // Now add FK from teacher_profiles to departments
  pgm.addConstraint('teacher_profiles', 'teacher_profiles_department_id_fkey', {
    foreignKeys: {
      columns: 'department_id',
      references: 'departments(id)',
      onDelete: 'SET NULL'
    }
  });

  // Create document_categories table
  pgm.createTable('document_categories', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    school_id: {
      type: 'uuid',
      notNull: true,
      references: 'schools',
      onDelete: 'CASCADE'
    },
    name: {
      type: 'varchar(100)',
      notNull: true
    },
    slug: {
      type: 'varchar(100)',
      notNull: true
    },
    description: {
      type: 'text',
      notNull: false
    },
    parent_id: {
      type: 'uuid',
      notNull: false,
      references: 'document_categories',
      onDelete: 'CASCADE'
    },
    icon: {
      type: 'varchar(50)',
      notNull: false
    },
    color: {
      type: 'varchar(7)',
      notNull: true,
      default: '#1976D2'
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

  // Document categories indexes
  pgm.createIndex('document_categories', 'school_id');
  pgm.createIndex('document_categories', 'slug');
  pgm.createIndex('document_categories', 'parent_id');

  // Document categories unique constraint
  pgm.addConstraint('document_categories', 'document_categories_school_slug_unique', {
    unique: ['school_id', 'slug']
  });

  // Create time_slots table
  pgm.createTable('time_slots', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    school_id: {
      type: 'uuid',
      notNull: true,
      references: 'schools',
      onDelete: 'CASCADE'
    },
    name: {
      type: 'varchar(50)',
      notNull: true
    },
    start_time: {
      type: 'time',
      notNull: true
    },
    end_time: {
      type: 'time',
      notNull: true
    },
    slot_type: {
      type: 'varchar(20)',
      notNull: true,
      default: 'class'
    },
    display_order: {
      type: 'integer',
      notNull: true,
      default: 0
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

  // Time slots indexes
  pgm.createIndex('time_slots', 'school_id');
  pgm.createIndex('time_slots', 'start_time');
  pgm.createIndex('time_slots', 'display_order');

  // Time slots unique constraint
  pgm.addConstraint('time_slots', 'time_slots_school_start_end_unique', {
    unique: ['school_id', 'start_time', 'end_time']
  });

  // Time slots check constraint
  pgm.addConstraint('time_slots', 'time_slots_slot_type_check', {
    check: "slot_type IN ('class', 'break', 'lunch', 'assembly', 'other')"
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
const down = (pgm) => {
  pgm.dropTable('time_slots');
  pgm.dropTable('document_categories');

  // Remove FK from teacher_profiles
  pgm.dropConstraint('teacher_profiles', 'teacher_profiles_department_id_fkey', {
    ifExists: true
  });

  pgm.dropTable('departments');
};

module.exports = {
  shorthands,
  up,
  down,
};
