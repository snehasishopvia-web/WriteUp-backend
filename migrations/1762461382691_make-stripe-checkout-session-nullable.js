/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
const up = (pgm) => {
  // Drop the existing NOT NULL constraint
  pgm.alterColumn("payments", "stripe_checkout_session_id", {
    notNull: false,
  });

  // ✅ Make unique only for non-null values
  pgm.dropConstraint("payments", "payments_checkout_session_id_unique");
  pgm.addConstraint("payments", "payments_checkout_session_id_unique_not_null", {
    unique: ["stripe_checkout_session_id"],
    deferrable: false,
    initiallyDeferred: false,
  });
};

const down = (pgm) => {
  pgm.dropConstraint("payments", "payments_checkout_session_id_unique_not_null");
  pgm.alterColumn("payments", "stripe_checkout_session_id", {
    notNull: true,
  });
  pgm.addConstraint("payments", "payments_checkout_session_id_unique", {
    unique: ["stripe_checkout_session_id"],
  });
};

module.exports = {
  up,
  down,
};
