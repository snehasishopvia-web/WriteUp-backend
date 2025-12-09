/** @type {import('node-pg-migrate').MigrationBuilder} */
const up = (pgm) => {
  pgm.addColumn("accounts", {
    has_used_trial: {
      type: "boolean",
      notNull: true,
      default: false,
    },
  });

  pgm.addColumn("accounts", {
    last_subscription_type: {
      type: "text",
    },
  });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
const down = (pgm) => {
  pgm.dropColumn("accounts", "has_used_trial");
  pgm.dropColumn("accounts", "last_subscription_type");
};

module.exports = {
  up,
  down,
};
