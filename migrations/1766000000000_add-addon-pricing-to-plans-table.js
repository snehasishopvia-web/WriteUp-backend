/**
 * Migration: Add addon pricing columns to plans table
 *
 * This migration adds pricing columns for extra teachers and students
 * to the plans table, allowing each plan to have its own addon pricing
 * instead of using hardcoded values.
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
  // Add addon pricing columns
  pgm.addColumns('plans', {
    extra_student_price_monthly: {
      type: 'decimal(10,2)',
      notNull: true,
      default: 3.00,
      comment: 'Price per extra student for monthly subscriptions'
    },
    extra_student_price_yearly: {
      type: 'decimal(10,2)',
      notNull: true,
      default: 36.00,
      comment: 'Price per extra student for yearly subscriptions'
    },
    extra_teacher_price_monthly: {
      type: 'decimal(10,2)',
      notNull: true,
      default: 5.00,
      comment: 'Price per extra teacher for monthly subscriptions'
    },
    extra_teacher_price_yearly: {
      type: 'decimal(10,2)',
      notNull: true,
      default: 60.00,
      comment: 'Price per extra teacher for yearly subscriptions'
    }
  });

  // Update existing plans with appropriate pricing based on current hardcoded logic
  // Multi-class plan: $25/month or $240/year per teacher
  pgm.sql(`
    UPDATE plans 
    SET 
      extra_teacher_price_monthly = 25.00,
      extra_teacher_price_yearly = 240.00
    WHERE slug = 'multi-class'
  `);

  // Department plan: $15/month or $100/year per teacher
  pgm.sql(`
    UPDATE plans 
    SET 
      extra_teacher_price_monthly = 15.00,
      extra_teacher_price_yearly = 100.00
    WHERE slug = 'department'
  `);

  // All other plans keep default: $5/month or $60/year per teacher
  // Student pricing remains $3/month or $36/year across all plans
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
const down = (pgm) => {
  pgm.dropColumns('plans', [
    'extra_student_price_monthly',
    'extra_student_price_yearly',
    'extra_teacher_price_monthly',
    'extra_teacher_price_yearly'
  ]);
};

module.exports = {
  up,
  down,
  shorthands,
};
