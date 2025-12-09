/**
 * Migration: Create class system tables
 *
 * Tables: classes, class_members, class_invitations, class_join_links, join_link_usage
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
  // Create classes table
  pgm.createTable('classes', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    class_name: {
      type: 'varchar(200)',
      notNull: true
    },
    department_id: {
      type: 'uuid',
      notNull: true,
      references: 'departments',
      onDelete: 'RESTRICT'
    },
    semester: {
      type: 'varchar(50)',
      notNull: true
    },
    description: {
      type: 'text',
      notNull: false
    },
    creator_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT'
    },
    school_id: {
      type: 'uuid',
      notNull: true,
      references: 'schools',
      onDelete: 'CASCADE'
    },
    max_students: {
      type: 'integer',
      notNull: true,
      default: 30
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'draft'
    },
    start_date: {
      type: 'timestamp',
      notNull: false
    },
    end_date: {
      type: 'timestamp',
      notNull: false
    },
    schedule_time: {
      type: 'jsonb',
      notNull: false
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

  // Classes indexes
  pgm.createIndex('classes', 'school_id');
  pgm.createIndex('classes', 'department_id');
  pgm.createIndex('classes', 'creator_id');
  pgm.createIndex('classes', 'status');
  pgm.createIndex('classes', ['school_id', 'status']);
  pgm.createIndex('classes', ['department_id', 'semester']);

  // Classes check constraint
  pgm.addConstraint('classes', 'classes_status_check', {
    check: "status IN ('draft', 'scheduled', 'active', 'completed', 'archived', 'cancelled')"
  });

  // Now add FK from student_profiles to classes
  pgm.addConstraint('student_profiles', 'student_profiles_current_class_id_fkey', {
    foreignKeys: {
      columns: 'current_class_id',
      references: 'classes(id)',
      onDelete: 'SET NULL'
    }
  });

  // Create class_members table
  pgm.createTable('class_members', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    class_id: {
      type: 'uuid',
      notNull: true,
      references: 'classes',
      onDelete: 'CASCADE'
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE'
    },
    role: {
      type: 'varchar(20)',
      notNull: true
    },
    joined_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    joined_via: {
      type: 'varchar(20)',
      notNull: true
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'active'
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

  // Class members indexes
  pgm.createIndex('class_members', 'class_id');
  pgm.createIndex('class_members', 'user_id');
  pgm.createIndex('class_members', ['class_id', 'role']);
  pgm.createIndex('class_members', ['class_id', 'status']);
  pgm.createIndex('class_members', ['user_id', 'status']);

  // Class members unique constraint
  pgm.addConstraint('class_members', 'class_members_class_user_unique', {
    unique: ['class_id', 'user_id']
  });

  // Class members check constraints
  pgm.addConstraint('class_members', 'class_members_role_check', {
    check: "role IN ('teacher', 'student', 'admin')"
  });

  pgm.addConstraint('class_members', 'class_members_joined_via_check', {
    check: "joined_via IN ('invitation', 'join_link', 'direct_add')"
  });

  pgm.addConstraint('class_members', 'class_members_status_check', {
    check: "status IN ('active', 'removed', 'dropped')"
  });

  // Create class_invitations table
  pgm.createTable('class_invitations', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    class_id: {
      type: 'uuid',
      notNull: true,
      references: 'classes',
      onDelete: 'CASCADE'
    },
    invited_by: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE'
    },
    invited_email: {
      type: 'varchar(255)',
      notNull: true
    },
    role: {
      type: 'varchar(20)',
      notNull: true
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'pending'
    },
    expires_at: {
      type: 'timestamp',
      notNull: true
    },
    accepted_at: {
      type: 'timestamp',
      notNull: false
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

  // Class invitations indexes
  pgm.createIndex('class_invitations', 'class_id');
  pgm.createIndex('class_invitations', 'invited_by');
  pgm.createIndex('class_invitations', 'invited_email');
  pgm.createIndex('class_invitations', 'status');
  pgm.createIndex('class_invitations', ['class_id', 'invited_email', 'status']);

  // Class invitations check constraints
  pgm.addConstraint('class_invitations', 'class_invitations_role_check', {
    check: "role IN ('teacher', 'student')"
  });

  pgm.addConstraint('class_invitations', 'class_invitations_status_check', {
    check: "status IN ('pending', 'accepted', 'expired', 'revoked')"
  });

  // Create class_join_links table
  pgm.createTable('class_join_links', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    class_id: {
      type: 'uuid',
      notNull: true,
      references: 'classes',
      onDelete: 'CASCADE'
    },
    role: {
      type: 'varchar(20)',
      notNull: true
    },
    token: {
      type: 'varchar(255)',
      notNull: true,
      unique: true
    },
    created_by: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE'
    },
    max_uses: {
      type: 'integer',
      notNull: false
    },
    current_uses: {
      type: 'integer',
      notNull: true,
      default: 0
    },
    expires_at: {
      type: 'timestamp',
      notNull: true
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

  // Class join links indexes
  pgm.createIndex('class_join_links', 'class_id');
  pgm.createIndex('class_join_links', 'token');
  pgm.createIndex('class_join_links', 'created_by');
  pgm.createIndex('class_join_links', ['class_id', 'role', 'is_active']);

  // Class join links check constraint
  pgm.addConstraint('class_join_links', 'class_join_links_role_check', {
    check: "role IN ('teacher', 'student')"
  });

  // Class join links unique constraint - only one active link per class-role
  pgm.createIndex('class_join_links', ['class_id', 'role'], {
    unique: true,
    where: 'is_active = true',
    name: 'class_join_links_class_role_active_unique'
  });

  // Create join_link_usage table
  pgm.createTable('join_link_usage', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    join_link_id: {
      type: 'uuid',
      notNull: true,
      references: 'class_join_links',
      onDelete: 'CASCADE'
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE'
    },
    used_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  // Join link usage indexes
  pgm.createIndex('join_link_usage', 'join_link_id');
  pgm.createIndex('join_link_usage', 'user_id');
  pgm.createIndex('join_link_usage', ['join_link_id', 'user_id']);
  pgm.createIndex('join_link_usage', 'used_at');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
const down = (pgm) => {
  pgm.dropTable('join_link_usage');
  pgm.dropTable('class_join_links');
  pgm.dropTable('class_invitations');
  pgm.dropTable('class_members');

  // Remove FK from student_profiles
  pgm.dropConstraint('student_profiles', 'student_profiles_current_class_id_fkey', {
    ifExists: true
  });

  pgm.dropTable('classes');
};

module.exports = {
  shorthands,
  up,
  down,
};
