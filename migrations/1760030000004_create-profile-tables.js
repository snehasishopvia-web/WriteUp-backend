/**
 * Migration: Create teacher_profiles and student_profiles tables
 *
 * Extended profile information for teachers and students.
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
  // Create teacher_profiles table
  pgm.createTable('teacher_profiles', {
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
    user_id: {
      type: 'uuid',
      notNull: true,
      unique: true,
      references: 'users',
      onDelete: 'CASCADE'
    },
    employee_id: {
      type: 'varchar(50)',
      notNull: true
    },
    department_id: {
      type: 'uuid',
      notNull: false
      // FK will be added later after departments table is created
    },
    qualification: {
      type: 'varchar(200)',
      notNull: true
    },
    specialization: {
      type: 'varchar(200)',
      notNull: false
    },
    experience_years: {
      type: 'integer',
      notNull: true,
      default: 0
    },
    join_date: {
      type: 'date',
      notNull: true
    },
    employment_type: {
      type: 'varchar(20)',
      notNull: true,
      default: 'full_time'
    },
    salary: {
      type: 'decimal(10,2)',
      notNull: false
    },
    bio: {
      type: 'text',
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

  // Teacher profiles indexes
  pgm.createIndex('teacher_profiles', 'school_id');
  pgm.createIndex('teacher_profiles', 'user_id');
  pgm.createIndex('teacher_profiles', 'employee_id');

  // Teacher profiles unique constraint
  pgm.addConstraint('teacher_profiles', 'teacher_profiles_school_employee_unique', {
    unique: ['school_id', 'employee_id']
  });

  // Create student_profiles table
  pgm.createTable('student_profiles', {
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
    user_id: {
      type: 'uuid',
      notNull: true,
      unique: true,
      references: 'users',
      onDelete: 'CASCADE'
    },
    admission_number: {
      type: 'varchar(50)',
      notNull: true
    },
    admission_date: {
      type: 'date',
      notNull: true
    },
    roll_number: {
      type: 'varchar(20)',
      notNull: false
    },
    current_class_id: {
      type: 'uuid',
      notNull: false
      // FK will be added later after classes table is created
    },
    father_name: {
      type: 'varchar(200)',
      notNull: false
    },
    father_phone: {
      type: 'varchar(20)',
      notNull: false
    },
    father_email: {
      type: 'varchar(254)',
      notNull: false
    },
    father_occupation: {
      type: 'varchar(100)',
      notNull: false
    },
    mother_name: {
      type: 'varchar(200)',
      notNull: false
    },
    mother_phone: {
      type: 'varchar(20)',
      notNull: false
    },
    mother_email: {
      type: 'varchar(254)',
      notNull: false
    },
    mother_occupation: {
      type: 'varchar(100)',
      notNull: false
    },
    guardian_name: {
      type: 'varchar(200)',
      notNull: false
    },
    guardian_phone: {
      type: 'varchar(20)',
      notNull: false
    },
    guardian_email: {
      type: 'varchar(254)',
      notNull: false
    },
    guardian_relation: {
      type: 'varchar(50)',
      notNull: false
    },
    blood_group: {
      type: 'varchar(5)',
      notNull: false
    },
    medical_conditions: {
      type: 'text',
      notNull: false
    },
    allergies: {
      type: 'text',
      notNull: false
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'active'
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

  // Student profiles indexes
  pgm.createIndex('student_profiles', 'school_id');
  pgm.createIndex('student_profiles', 'user_id');
  pgm.createIndex('student_profiles', 'admission_number');
  pgm.createIndex('student_profiles', 'status');
  pgm.createIndex('student_profiles', ['school_id', 'current_class_id', 'status']);

  // Student profiles unique constraint
  pgm.addConstraint('student_profiles', 'student_profiles_school_admission_unique', {
    unique: ['school_id', 'admission_number']
  });

  // Student status check constraint
  pgm.addConstraint('student_profiles', 'student_profiles_status_check', {
    check: "status IN ('active', 'graduated', 'transferred', 'dropped', 'suspended')"
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
const down = (pgm) => {
  pgm.dropTable('student_profiles');
  pgm.dropTable('teacher_profiles');
};

module.exports = {
  shorthands,
  up,
  down,
};
