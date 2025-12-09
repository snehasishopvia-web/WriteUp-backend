/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
const up = (pgm) => {
  pgm.addColumns("users", {
    total_students: { type: "integer", notNull: false, default: 0 },
    total_teachers: { type: "integer", notNull: false, default: 0 },
    total_classes: { type: "integer", notNull: false, default: 0 },
    total_schools: { type: "integer", notNull: false, default: 0 },
  });
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
const down = (pgm) => {
  pgm.dropColumns("users", [
    "total_students",
    "total_teachers",
    "total_classes",
    "total_schools",
  ]);
};

module.exports = {
  up,
  down,
};
