/**
 * Migration: Add formatting column to documents table
 *
 * Adds a JSONB column to store rich text formatting separately from content.
 * Format structure:
 * {
 *   "ranges": [{ startOffset, endOffset, attributes }],
 *   "paragraphs": { "0": { textAlign, lineHeight }, ... }
 * }
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // Add formatting column to store rich text formatting
  pgm.addColumn('documents', {
    formatting: {
      type: 'jsonb',
      notNull: true,
      default: '{"ranges": [], "paragraphs": {}}',
      comment: 'Rich text formatting: ranges (character-level) and paragraphs (paragraph-level)'
    }
  });

  // Create GIN index for efficient JSONB querying
  pgm.createIndex('documents', 'formatting', {
    name: 'idx_documents_formatting',
    method: 'gin'
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropIndex('documents', 'formatting', { name: 'idx_documents_formatting' });
  pgm.dropColumn('documents', 'formatting');
};
