/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
const up = (pgm) => {
  pgm.addColumn("payments", {
    addons: {
      type: "jsonb",
      notNull: false,
      default: pgm.func("'{}'::jsonb"),
    },
  });
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
const down = (pgm) => {
  pgm.dropColumn("payments", "addons");
};

module.exports = {
  up,
  down,
};
