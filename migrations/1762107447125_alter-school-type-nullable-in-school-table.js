const up = (pgm) => {
  pgm.alterColumn('schools', 'school_type', { notNull: false });
  pgm.alterColumn('schools', 'class_structure_type', { notNull: false });
};

const down = (pgm) => {
  pgm.alterColumn('schools', 'school_type', { notNull: true });
  pgm.alterColumn('schools', 'class_structure_type', { notNull: true });
};

module.exports = {
  up,
  down,
};
