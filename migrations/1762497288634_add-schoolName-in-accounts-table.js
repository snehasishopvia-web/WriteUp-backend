/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
const shorthands = undefined;

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
const up = (pgm) => {
  pgm.addColumn('accounts', {
    school_name: { type: 'varchar(200)', notNull: true, default: '' },
  });
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
const down = (pgm) => {
  pgm.dropColumn('accounts', 'school_name');
};

module.exports = {
  shorthands,
  up,
  down,
};
