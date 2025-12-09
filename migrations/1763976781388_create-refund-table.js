/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const up = (pgm) => {
  pgm.sql(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

  pgm.createTable("refund_requests", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    payment_id: {
      type: "uuid",
      notNull: true,
      references: "payments(id)",
      onDelete: "CASCADE",
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    account_id: {
      type: "uuid",
      notNull: true,
      references: "accounts(id)",
      onDelete: "CASCADE",
    },
    stripe_refund_id: { type: "text", notNull: false },
    amount: { type: "numeric(10,2)", notNull: true },
    status: { type: "varchar(50)", notNull: true, default: "pending" },
    reason: { type: "text", notNull: false },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
    approved_at: { type: "timestamptz", notNull: false },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  pgm.addConstraint(
    "refund_requests",
    "unique_payment_refund",
    "UNIQUE(payment_id)"
  );
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const down = (pgm) => {
  pgm.dropTable("refund_requests");
};

module.exports = {
  up,
  down,
  shorthands,
};
