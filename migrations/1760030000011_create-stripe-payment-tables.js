/**
 * Migration: Create Stripe helper tables for checkout flow
 *
 * Tables:
 *  - stripe_customers: link internal users to Stripe customer IDs
 *  - payments: track checkout sessions and resulting payment status
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
const shorthands = undefined;

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
const up = (pgm) => {
  pgm.createTable("stripe_customers", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    user_id: {
      type: "uuid",
      notNull: false,
      references: "users",
      onDelete: "CASCADE",
    },
    account_id: {
      type: "uuid",
      notNull: true,
      references: "accounts",
      onDelete: "SET NULL",
    },
    stripe_customer_id: {
      type: "text",
      notNull: true,
    },
    email: {
      type: "text",
      notNull: false,
    },
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

  pgm.addConstraint("stripe_customers", "stripe_customers_user_unique", {
    unique: ["user_id"],
  });
  pgm.addConstraint("stripe_customers", "stripe_customers_user_unique_account", {
    unique: ["account_id"],
  });

  pgm.addConstraint(
    "stripe_customers",
    "stripe_customers_customer_id_unique",
    {
      unique: ["stripe_customer_id"],
    }
  );

  pgm.createIndex("stripe_customers", "user_id");
  pgm.createIndex("stripe_customers", "account_id");

  pgm.createTable("payments", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    user_id: {
      type: "uuid",
      notNull: false,
      references: "users",
      onDelete: "SET NULL",
    },
    account_id: {
      type: "uuid",
      notNull: false,
      references: "accounts",
      onDelete: "SET NULL",
    },
    plan_id: {
      type: "uuid",
      notNull: false,
      references: "plans",
      onDelete: "SET NULL",
    },
    mode: {
      type: "varchar(20)",
      notNull: true,
      default: "one_time",
    },
    amount_cents: {
      type: "integer",
      notNull: true,
    },
    currency: {
      type: "varchar(10)",
      notNull: true,
      default: "usd",
    },
    status: {
      type: "varchar(30)",
      notNull: true,
      default: "pending",
    },
    stripe_checkout_session_id: {
      type: "text",
      notNull: true,
    },
    stripe_payment_intent_id: {
      type: "text",
      notNull: false,
    },
    stripe_subscription_id: {
      type: "text",
      notNull: false,
    },
    email_sent_at: {
      type: "timestamp",
      notNull: false,
    },
    fail_reason: {
      type: "text",
      notNull: false,
    },
    metadata: {
      type: "jsonb",
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
    },
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

  pgm.addConstraint(
    "payments",
    "payments_checkout_session_id_unique",
    {
      unique: ["stripe_checkout_session_id"],
    }
  );

  pgm.createIndex("payments", "user_id");
  pgm.createIndex("payments", "account_id");
  pgm.createIndex("payments", "plan_id");
  pgm.createIndex("payments", "status");
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
const down = (pgm) => {
  pgm.dropTable("payments");
  pgm.dropTable("stripe_customers");
};

module.exports = {
  shorthands,
  up,
  down,
};
