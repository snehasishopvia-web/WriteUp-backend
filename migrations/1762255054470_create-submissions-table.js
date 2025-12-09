/**
 * Migration: Create submissions table
 *
 * Students submit their work for assignments through this table
 * Follows multi-tenant design with school_id
 * Links: school -> class -> assignment -> submission
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
  // Create submission status enum
  pgm.createType('submission_status_enum', [
    'draft',
    'submitted',
    'under_review',
    'graded',
    'returned',
    'resubmitted'
  ]);

  // Create submissions table
  pgm.createTable('submissions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
      comment: 'Unique submission identifier'
    },
    school_id: {
      type: 'uuid',
      notNull: true,
      references: 'schools',
      onDelete: 'CASCADE',
      comment: 'School for multi-tenancy - must match assignment school'
    },
    class_id: {
      type: 'uuid',
      notNull: true,
      references: 'classes',
      onDelete: 'CASCADE',
      comment: 'Class this submission belongs to'
    },
    assignment_id: {
      type: 'uuid',
      notNull: true,
      references: 'assignments',
      onDelete: 'CASCADE',
      comment: 'Assignment being submitted'
    },
    student_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
      comment: 'Student who made the submission'
    },
    document_id: {
      type: 'uuid',
      notNull: false,
      references: 'documents',
      onDelete: 'SET NULL',
      comment: 'Optional link to document in documents table'
    },
    content: {
      type: 'text',
      notNull: false,
      comment: 'Submission text content (if not using document_id)'
    },
    status: {
      type: 'submission_status_enum',
      notNull: true,
      default: 'draft',
      comment: 'Current status of submission'
    },
    submitted_at: {
      type: 'timestamp',
      notNull: false,
      comment: 'When student clicked submit (null for drafts)'
    },
    score: {
      type: 'numeric(5, 2)',
      notNull: false,
      comment: 'Points awarded (null until graded)'
    },
    feedback: {
      type: 'text',
      notNull: false,
      comment: 'Teacher general feedback/comments'
    },
    graded_by: {
      type: 'uuid',
      notNull: false,
      references: 'users',
      onDelete: 'SET NULL',
      comment: 'Teacher who graded the submission'
    },
    graded_at: {
      type: 'timestamp',
      notNull: false,
      comment: 'When the submission was graded'
    },
    word_count: {
      type: 'integer',
      notNull: false,
      comment: 'Actual word count of submission'
    },
    page_count: {
      type: 'integer',
      notNull: false,
      comment: 'Actual page count of submission'
    },
    submission_metadata: {
      type: 'jsonb',
      notNull: false,
      comment: 'Additional metadata (file attachments, citations, etc.)'
    },
    is_late: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Whether submission was after due date'
    },
    version: {
      type: 'integer',
      notNull: true,
      default: 1,
      comment: 'Submission version (for resubmissions)'
    },
    previous_submission_id: {
      type: 'uuid',
      notNull: false,
      references: 'submissions',
      onDelete: 'SET NULL',
      comment: 'Link to previous version if resubmitted'
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
      comment: 'When submission was created'
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
      comment: 'Last update timestamp'
    }
  });

  // Create indexes for performance
  pgm.createIndex('submissions', 'school_id', {
    name: 'submissions_school_id_idx'
  });

  pgm.createIndex('submissions', 'class_id', {
    name: 'submissions_class_id_idx'
  });

  pgm.createIndex('submissions', 'assignment_id', {
    name: 'submissions_assignment_id_idx'
  });

  pgm.createIndex('submissions', 'student_id', {
    name: 'submissions_student_id_idx'
  });

  pgm.createIndex('submissions', 'status', {
    name: 'submissions_status_idx'
  });

  pgm.createIndex('submissions', 'graded_by', {
    name: 'submissions_graded_by_idx'
  });

  // Compound indexes for common query patterns
  pgm.createIndex('submissions', ['school_id', 'status'], {
    name: 'submissions_school_status_idx'
  });

  pgm.createIndex('submissions', ['assignment_id', 'student_id'], {
    name: 'submissions_assignment_student_idx',
    unique: false // Allow multiple versions per student
  });

  pgm.createIndex('submissions', ['assignment_id', 'status'], {
    name: 'submissions_assignment_status_idx'
  });

  pgm.createIndex('submissions', ['class_id', 'student_id'], {
    name: 'submissions_class_student_idx'
  });

  pgm.createIndex('submissions', ['student_id', 'status'], {
    name: 'submissions_student_status_idx'
  });

  // Index for versioning
  pgm.createIndex('submissions', 'previous_submission_id', {
    name: 'submissions_previous_version_idx'
  });

  // Constraint: score must be within valid range
  pgm.addConstraint('submissions', 'submissions_score_check', {
    check: 'score >= 0 AND score <= 9999.99'
  });

  // Constraint: if submitted, must have submitted_at timestamp
  pgm.addConstraint('submissions', 'submissions_submitted_at_check', {
    check: "(status = 'draft') OR (status != 'draft' AND submitted_at IS NOT NULL)"
  });

  // Constraint: if graded, must have graded_by and graded_at
  pgm.addConstraint('submissions', 'submissions_graded_check', {
    check: "(status != 'graded') OR (status = 'graded' AND graded_by IS NOT NULL AND graded_at IS NOT NULL)"
  });

  // Create updated_at trigger
  pgm.createFunction(
    'update_submissions_updated_at',
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

  pgm.createTrigger('submissions', 'submissions_updated_at_trigger', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_submissions_updated_at',
    level: 'ROW'
  });

  // Create function to auto-set submitted_at when status changes to submitted
  pgm.createFunction(
    'set_submission_submitted_at',
    [],
    {
      returns: 'trigger',
      language: 'plpgsql',
      replace: true
    },
    `
    BEGIN
      -- If status is changing to submitted and submitted_at is null, set it
      IF NEW.status != 'draft' AND OLD.status = 'draft' AND NEW.submitted_at IS NULL THEN
        NEW.submitted_at = current_timestamp;
      END IF;
      RETURN NEW;
    END;
    `
  );

  pgm.createTrigger('submissions', 'submissions_submitted_at_trigger', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'set_submission_submitted_at',
    level: 'ROW'
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
const down = (pgm) => {
  // Drop triggers
  pgm.dropTrigger('submissions', 'submissions_submitted_at_trigger', { ifExists: true });
  pgm.dropTrigger('submissions', 'submissions_updated_at_trigger', { ifExists: true });

  // Drop functions
  pgm.dropFunction('set_submission_submitted_at', [], { ifExists: true });
  pgm.dropFunction('update_submissions_updated_at', [], { ifExists: true });

  // Drop table (cascades to indexes and constraints)
  pgm.dropTable('submissions', { ifExists: true });

  // Drop enum type
  pgm.dropType('submission_status_enum', { ifExists: true });
};

module.exports = {
  shorthands,
  up,
  down,
};
