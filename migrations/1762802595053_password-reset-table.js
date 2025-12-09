/**
 * Migration: Create password_resets table
 */
const up = (pgm) => {
  pgm.createTable("password_resets", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },
    token: {
      type: "varchar(255)",
      notNull: true,
      unique: true,
    },
    expires_at: {
      type: "timestamp",
      notNull: true,
    },
    used: {
      type: "boolean",
      notNull: true,
      default: false,
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("password_resets", "user_id");
  pgm.createIndex("password_resets", "token");
  pgm.createIndex("password_resets", "expires_at");
};

const down = (pgm) => {
  pgm.dropTable("password_resets");
};

module.exports = {
  up,
  down,
};
