/**
 * Migration: Add file upload tracking to schools table
 *
 * Adds columns to track uploaded teacher and student CSV files
 * with their upload results for display in the onboarding flow.
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
  // Add teacher file upload tracking columns
  pgm.addColumns('schools', {
    teacher_file_name: {
      type: 'varchar(255)',
      notNull: false,
      comment: 'Original filename of uploaded teacher CSV'
    },
    teacher_upload_date: {
      type: 'timestamp',
      notNull: false,
      comment: 'Timestamp when teachers CSV was uploaded'
    },
    teacher_upload_summary: {
      type: 'jsonb',
      notNull: false,
      comment: 'Summary of teacher upload results (created_count, updated_count, failed_count, total_rows_processed)'
    }
  });

  // Add student file upload tracking columns
  pgm.addColumns('schools', {
    student_file_name: {
      type: 'varchar(255)',
      notNull: false,
      comment: 'Original filename of uploaded student CSV'
    },
    student_upload_date: {
      type: 'timestamp',
      notNull: false,
      comment: 'Timestamp when students CSV was uploaded'
    },
    student_upload_summary: {
      type: 'jsonb',
      notNull: false,
      comment: 'Summary of student upload results (created_count, updated_count, failed_count, total_rows_processed)'
    }
  });

  // Create indexes for faster queries
  pgm.createIndex('schools', 'teacher_upload_date');
  pgm.createIndex('schools', 'student_upload_date');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
const down = (pgm) => {
  // Drop indexes first
  pgm.dropIndex('schools', 'teacher_upload_date');
  pgm.dropIndex('schools', 'student_upload_date');

  // Drop columns
  pgm.dropColumns('schools', [
    'teacher_file_name',
    'teacher_upload_date',
    'teacher_upload_summary',
    'student_file_name',
    'student_upload_date',
    'student_upload_summary'
  ]);
};

module.exports = {
  shorthands,
  up,
  down,
};
