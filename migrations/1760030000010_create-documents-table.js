/**
 * Migration: Create documents table
 *
 * Creates documents table with versioning support for conflict resolution,
 * rich metadata (citations, research notes, outline), and assignment tracking
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
const up = (pgm) => {
  pgm.createTable('documents', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },

    // Basic document info
    title: {
      type: 'varchar(255)',
      notNull: true,
      default: 'Untitled Document'
    },
    content: {
      type: 'text',
      notNull: true,
      default: ''
    },
    content_format: {
      type: 'varchar(20)',
      notNull: true,
      default: 'plain',
      comment: 'Format of content: plain, markdown, html, json'
    },

    // Document type and academic features
    document_type: {
      type: 'varchar(20)',
      notNull: true,
      default: 'text',
      comment: 'Type: text, presentation, spreadsheet, notes'
    },
    citation_style: {
      type: 'varchar(20)',
      notNull: true,
      default: 'mla',
      comment: 'Citation format: mla, apa, chicago'
    },

    // Rich metadata stored as JSON
    assets: {
      type: 'jsonb',
      notNull: true,
      default: '[]',
      comment: 'Array of document assets (images, files, etc.)'
    },
    outline: {
      type: 'jsonb',
      notNull: true,
      default: '[]',
      comment: 'Document structure/outline'
    },
    research_notes: {
      type: 'jsonb',
      notNull: true,
      default: '[]',
      comment: 'Research notes for academic work'
    },
    edit_history: {
      type: 'jsonb',
      notNull: true,
      default: '[]',
      comment: 'History of edits made to document'
    },
    sources: {
      type: 'jsonb',
      notNull: true,
      default: '[]',
      comment: 'Bibliography/sources cited'
    },

    // Version control for conflict resolution
    version: {
      type: 'integer',
      notNull: true,
      default: 1,
      comment: 'Version number for optimistic locking'
    },

    // Relationships
    folder_id: {
      type: 'uuid',
      notNull: false,
      references: 'folders',
      onDelete: 'SET NULL',
      comment: 'Parent folder (NULL if in root)'
    },
    owner_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
      comment: 'User who owns this document'
    },
    last_modified_by: {
      type: 'uuid',
      notNull: false,
      references: 'users',
      onDelete: 'SET NULL',
      comment: 'User who last modified document'
    },

    // Multi-tenancy and context
    school_id: {
      type: 'uuid',
      notNull: false,
      references: 'schools',
      onDelete: 'CASCADE',
      comment: 'School context for multi-tenancy (NULL for personal docs)'
    },
    class_id: {
      type: 'uuid',
      notNull: false,
      references: 'classes',
      onDelete: 'SET NULL',
      comment: 'Class context (for class assignments)'
    },
    assignment_id: {
      type: 'uuid',
      notNull: false,
      references: 'assignments',
      onDelete: 'SET NULL',
      comment: 'Assignment this document is for (NULL if not an assignment)'
    },

    // Timestamps
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    last_modified_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  // Create indexes for efficient queries
  pgm.createIndex('documents', 'owner_id');
  pgm.createIndex('documents', 'folder_id');
  pgm.createIndex('documents', 'school_id');
  pgm.createIndex('documents', 'class_id');
  pgm.createIndex('documents', 'assignment_id');
  pgm.createIndex('documents', 'version');

  // Composite indexes for common queries
  pgm.createIndex('documents', ['owner_id', 'last_modified_at'], {
    name: 'idx_documents_owner_modified',
    method: 'btree'
  });
  pgm.createIndex('documents', ['owner_id', 'folder_id'], {
    name: 'idx_documents_owner_folder'
  });
  pgm.createIndex('documents', ['school_id', 'class_id'], {
    name: 'idx_documents_school_class'
  });
  pgm.createIndex('documents', ['assignment_id', 'owner_id'], {
    name: 'idx_documents_assignment_owner'
  });

  // Check constraints
  pgm.addConstraint('documents', 'documents_content_format_check', {
    check: "content_format IN ('plain', 'markdown', 'html', 'json')"
  });

  pgm.addConstraint('documents', 'documents_document_type_check', {
    check: "document_type IN ('text', 'presentation', 'spreadsheet', 'notes')"
  });

  pgm.addConstraint('documents', 'documents_citation_style_check', {
    check: "citation_style IN ('mla', 'apa', 'chicago')"
  });

  pgm.addConstraint('documents', 'documents_version_positive', {
    check: 'version > 0'
  });

  // Create updated_at trigger
  pgm.createFunction(
    'update_documents_last_modified_at',
    [],
    {
      returns: 'trigger',
      language: 'plpgsql',
      replace: true
    },
    `
    BEGIN
      NEW.last_modified_at = current_timestamp;
      RETURN NEW;
    END;
    `
  );

  pgm.createTrigger('documents', 'documents_last_modified_at_trigger', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_documents_last_modified_at',
    level: 'ROW'
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
const down = (pgm) => {
  pgm.dropTrigger('documents', 'documents_last_modified_at_trigger', { ifExists: true });
  pgm.dropFunction('update_documents_last_modified_at', [], { ifExists: true });
  pgm.dropTable('documents');
};

module.exports = {
  shorthands,
  up,
  down,
};
