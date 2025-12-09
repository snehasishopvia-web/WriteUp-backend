/**
 * Migration: Create Teacher Feedbacks Table
 *
 * This table stores all types of feedback that teachers provide on student submissions.
 * Follows multi-tenant design with school_id to ensure data isolation.
 * It supports 5 different feedback types, each with specific data structures stored in
 * a single JSONB 'feedback_data' field for efficiency:
 *
 * 1. MULTI-LINE: Multiple text selections across the document
 *    - feedback_data: {selectedTextRanges: TextSelection[]}
 *
 * 2. MULTI-PARA: Multiple paragraph selections
 *    - feedback_data: {selectedParagraphs: number[]}
 *
 * 3. DELETE: Single text selection to be deleted
 *    - feedback_data: {deleteSelection: TextSelection}
 *
 * 4. INSERT: Insertion point for new content
 *    - feedback_data: {insertPosition: {paragraphIndex, offset, visualX}}
 *
 * 5. MOVE: Text to be moved from one location to another
 *    - feedback_data: {moveSelection: {textSelection, destinationPosition, isWaitingForDestination}}
 *
 * Design Benefits:
 * - Single JSONB field instead of 5 nullable fields = more efficient storage
 * - GIN index on feedback_data enables fast JSONB queries
 * - No sparse data (no rows with 4 NULL fields)
 * - Simpler schema, easier to maintain
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
  // Create enum type for feedback types
  pgm.createType('feedback_type_enum', ['multi-line', 'multi-para', 'delete', 'insert', 'move']);

  // Create teacher_feedbacks table
  pgm.createTable("teacher_feedbacks", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()")
    },
    school_id: {
      type: "uuid",
      notNull: true,
      references: "schools",
      onDelete: "CASCADE",
      comment: "School for multi-tenancy - must match submission school"
    },
    teacher_id: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
      comment: "Teacher who created the feedback"
    },
    student_id: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
      comment: "Student receiving the feedback"
    },
    assignment_id: {
      type: "uuid",
      notNull: true,
      references: "assignments",
      onDelete: "CASCADE",
    },
    submission_id: {
      type: "uuid",
      notNull: true,
      references: "submissions",
      onDelete: "CASCADE",
    },
    feedback_type: {
      type: 'feedback_type_enum',
      notNull: true,
      comment: "Type of feedback: multi-line, multi-para, delete, insert, or move"
    },
    title: {
      type: 'varchar(255)',
      notNull: true,
      comment: "Brief title for the feedback"
    },
    description: {
      type: 'text',
      notNull: true,
      comment: "Detailed description of the feedback"
    },
    // Single JSONB field to store all feedback-specific data
    // This is more efficient than having 5 separate nullable JSONB fields
    feedback_data: {
      type: 'jsonb',
      notNull: true,
      comment: `Stores type-specific data:
        - multi-line: {selectedTextRanges: TextSelection[]}
        - multi-para: {selectedParagraphs: number[]}
        - delete: {deleteSelection: TextSelection}
        - insert: {insertPosition: {paragraphIndex, offset, visualX}}
        - move: {moveSelection: {textSelection, destinationPosition, isWaitingForDestination}}`
    },
    // Metadata fields
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
    updated_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  // Create indexes for better query performance
  pgm.createIndex('teacher_feedbacks', 'school_id');
  pgm.createIndex('teacher_feedbacks', 'teacher_id');
  pgm.createIndex('teacher_feedbacks', 'student_id');
  pgm.createIndex('teacher_feedbacks', 'assignment_id');
  pgm.createIndex('teacher_feedbacks', 'submission_id');
  pgm.createIndex('teacher_feedbacks', 'feedback_type');
  pgm.createIndex('teacher_feedbacks', ['submission_id', 'feedback_type']);

  // Create compound indexes for common query patterns
  pgm.createIndex('teacher_feedbacks', ['school_id', 'teacher_id']);
  pgm.createIndex('teacher_feedbacks', ['school_id', 'assignment_id']);
  pgm.createIndex('teacher_feedbacks', ['student_id', 'assignment_id', 'submission_id']);

  // Create GIN index on feedback_data JSONB field for efficient querying
  pgm.createIndex('teacher_feedbacks', 'feedback_data', {
    method: 'gin'
  });

  // Add trigger to automatically update updated_at timestamp
  pgm.createFunction(
    'update_teacher_feedbacks_updated_at',
    [],
    {
      returns: 'trigger',
      language: 'plpgsql',
      replace: true,
    },
    `
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
    `
  );

  pgm.createTrigger(
    'teacher_feedbacks',
    'teacher_feedbacks_updated_at_trigger',
    {
      when: 'BEFORE',
      operation: 'UPDATE',
      function: 'update_teacher_feedbacks_updated_at',
      level: 'ROW',
    }
  );
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
const down = (pgm) => {
  // Drop trigger and function
  pgm.dropTrigger('teacher_feedbacks', 'teacher_feedbacks_updated_at_trigger', { ifExists: true });
  pgm.dropFunction('update_teacher_feedbacks_updated_at', [], { ifExists: true });

  // Drop table (this will automatically drop indexes and constraints)
  pgm.dropTable('teacher_feedbacks', { ifExists: true });

  // Drop enum type
  pgm.dropType('feedback_type_enum', { ifExists: true });
};

module.exports = {
  shorthands,
  up,
  down,
};
