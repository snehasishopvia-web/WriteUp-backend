/** @type {import('node-pg-migrate').MigrationBuilder} */
const up = async (pgm) => {
  // Step 1: Add the column as nullable first
  pgm.addColumn("schools", {
    unique_key: { type: "varchar(4)" },
  });

  // Step 2: Fill all existing schools with random unique 4-digit keys
  pgm.sql(`
    WITH updated AS (
      SELECT id, LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0') AS gen_key
      FROM schools
    )
    UPDATE schools s
    SET unique_key = u.gen_key
    FROM updated u
    WHERE s.id = u.id;
  `);

  // Step 3: Add NOT NULL + UNIQUE constraint
  pgm.alterColumn("schools", "unique_key", { notNull: true });
  pgm.addConstraint("schools", "schools_unique_key_unique", {
    unique: ["unique_key"],
  });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
const down = (pgm) => {
  pgm.dropConstraint("schools", "schools_unique_key_unique");
  pgm.dropColumn("schools", "unique_key");
};

module.exports = {
  up,
  down,
};
