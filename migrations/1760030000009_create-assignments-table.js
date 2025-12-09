/**
 * Migration: Create assignments table
 *
 * Creates assignments table for teachers to assign work to students
 * Assignments are class-scoped with due dates and grading criteria
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
  pgm.createTable('assignments', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    title: {
      type: 'varchar(255)',
      notNull: true
    },
    description: {
      type: 'text',
      notNull: false,
      comment: 'Assignment instructions and requirements'
    },
    class_id: {
      type: 'uuid',
      notNull: true,
      references: 'classes',
      onDelete: 'CASCADE',
      comment: 'Which class this assignment belongs to'
    },
    created_by: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
      comment: 'Teacher who created this assignment'
    },
    school_id: {
      type: 'uuid',
      notNull: true,
      references: 'schools',
      onDelete: 'CASCADE',
      comment: 'School for multi-tenancy'
    },
    due_date: {
      type: 'timestamp',
      notNull: false,
      comment: 'Deadline for submission'
    },
    assign_date:{
      type:"timestamp",
      notNull: false,
      comment: 'Assign date for submission'
    },
    max_score: {
      type: 'integer',
      notNull: true,
      default: 100,
      comment: 'Maximum points possible'
    },
    min_word_count: {
      type: 'integer',
      notNull: false,
      comment: 'Minimum words required (optional)'
    },
    word_count:{
      type: 'integer',
      notNull: false,
      comment: 'Total word count'
    },
    max_word_count: {
      type: 'integer',
      notNull: false,
      comment: 'Maximum words allowed (optional)'
    },
    page_count:{
      type: 'integer',
      notNull: false,
      comment: 'total page requirement'
    },
    assignment_type:{
      type: 'text',
      notNull: false,
      comment: 'Assignment Type like eassy, presentation, research paper'
    },
    citation_style:{
      type: 'text',
      notNull: false,
      comment: 'Citation styles like apa, mla'
    },
    allow_late_submission: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Allow submissions after due date'
    },
    status: {
     type: 'text',
     notNull: true,
     default: 'active',
     comment: 'Assignment status: active (editing), inactive (temporarily hidden), completed(assignment is completed)'
    },
    grading_criteria: {
     type: 'jsonb',   
     nullable: true,
     comment: 'Grading criteria (title + description)'
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
  pgm.createIndex('assignments', 'class_id');
  pgm.createIndex('assignments', 'created_by');
  pgm.createIndex('assignments', 'school_id');
  pgm.createIndex('assignments', 'status');
  pgm.createIndex('assignments', ['class_id', 'status']);
  pgm.createIndex('assignments', ['school_id', 'status']);

  // Check constraint for status
  pgm.addConstraint('assignments', 'assignments_status_check', {
    check: "status IN ('active', 'inactive', 'completed')"
  });

  // Create updated_at trigger
  pgm.createFunction(
    'update_assignments_updated_at',
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

  pgm.createTrigger('assignments', 'assignments_updated_at_trigger', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_assignments_updated_at',
    level: 'ROW'
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
const down = (pgm) => {
  pgm.dropTrigger('assignments', 'assignments_updated_at_trigger', { ifExists: true });
  pgm.dropFunction('update_assignments_updated_at', [], { ifExists: true });
  pgm.dropTable('assignments');
};

module.exports = {
  shorthands,
  up,
  down,
};
