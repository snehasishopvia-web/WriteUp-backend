/**
 * Migration: Add onboarding and payment-related columns to accounts table
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const up = (pgm) => {
  pgm.addColumns('accounts', {
    onboarding_step: {
      type: 'integer',
      notNull: true,
      default: 1,
      comment:
        'Tracks progress through onboarding (1=signup, 2=verify email, 3=confirm plan, 4=payment complete)'
    },
    email_verified: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'True if email verification is complete'
    },
    password: {
      type: 'varchar(128)',
      notNull: true
    },
    payment_status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'pending',
      comment: 'pending | paid | failed | refunded'
    },
    signup_token: {
      type: 'varchar(255)',
      notNull: false,
      comment: 'Temporary token sent via email for verification/plan confirmation'
    },
    signup_completed_at: {
      type: 'timestamp',
      notNull: false,
      comment: 'Timestamp when the user fully completed signup & payment'
    }
  });

  // Optionally, create indexes for common queries
  pgm.createIndex('accounts', 'email_verified');
  pgm.createIndex('accounts', 'payment_status');
  pgm.createIndex('accounts', 'onboarding_step');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const down = (pgm) => {
  pgm.dropColumns('accounts', [
    'onboarding_step',
    'email_verified',
    'password',
    'payment_status',
    'signup_token',
    'signup_completed_at'
  ]);
};

module.exports = {
  shorthands,
  up,
  down,
};
