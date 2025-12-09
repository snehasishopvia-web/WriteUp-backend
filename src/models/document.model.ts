import { pool } from "../config/postgres.db.js";
import { PoolClient } from "pg";

export type ContentFormat = "plain" | "markdown" | "html" | "json";
export type DocumentType = "text" | "presentation" | "spreadsheet" | "notes";
export type CitationStyle = "mla" | "apa" | "chicago";

/**
 * Text formatting attributes (character-level)
 */
export interface TextAttributes {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSize?: number;
}

/**
 * Paragraph formatting attributes
 */
export interface ParagraphAttributes {
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
}

/**
 * Format range for character-level formatting
 */
export interface FormatRange {
  startOffset: number;
  endOffset: number;
  attributes: TextAttributes;
}

/**
 * Document formatting structure
 */
export interface DocumentFormatting {
  ranges: FormatRange[];
  paragraphs: Record<number, ParagraphAttributes>;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  content_format: ContentFormat;
  document_type: DocumentType;
  citation_style: CitationStyle;
  formatting: DocumentFormatting;
  assets: any[];
  outline: any[];
  research_notes: any[];
  edit_history: any[];
  sources: any[];
  version: number;
  folder_id?: string;
  owner_id: string;
  last_modified_by?: string;
  school_id?: string;
  class_id?: string;
  assignment_id?: string;
  created_at: Date;
  last_modified_at: Date;
}

export interface CreateDocumentDTO {
  title?: string;
  content?: string;
  content_format?: ContentFormat;
  document_type?: DocumentType;
  citation_style?: CitationStyle;
  folder_id?: string;
  school_id?: string;
  class_id?: string;
  assignment_id?: string;
}

export interface UpdateDocumentDTO {
  title?: string;
  content?: string;
  content_format?: ContentFormat;
  formatting?: DocumentFormatting;
  assets?: any[];
  outline?: any[];
  research_notes?: any[];
  edit_history?: any[];
  sources?: any[];
  citation_style?: CitationStyle;
  document_type?: DocumentType;
  folder_id?: string;
  client_version: number; // Required for conflict detection
}

export class DocumentModel {
  /**
   * Create a new document
   */
  static async create(
    owner_id: string,
    data: CreateDocumentDTO,
    client?: PoolClient
  ): Promise<Document> {
    const dbClient = client || pool;

    const result = await dbClient.query(
      `INSERT INTO documents (
        title, content, content_format, document_type, citation_style,
        folder_id, owner_id, last_modified_by, school_id, class_id, assignment_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        data.title || "Untitled Document",
        data.content || "",
        data.content_format || "plain",
        data.document_type || "text",
        data.citation_style || "mla",
        data.folder_id || null,
        owner_id,
        owner_id, // last_modified_by = creator initially
        data.school_id || null,
        data.class_id || null,
        data.assignment_id || null,
      ]
    );

    return result.rows[0];
  }

  /**
   * Find document by ID
   */
  static async findById(id: string): Promise<Document | null> {
    const result = await pool.query("SELECT * FROM documents WHERE id = $1", [
      id,
    ]);
    return result.rows[0] || null;
  }

  /**
   * Find documents by owner
   * @param owner_id - User ID
   * @param school_id - Optional school filter for multi-tenancy
   */
  static async findByOwner(
    owner_id: string,
    school_id?: string
  ): Promise<Document[]> {
    let query = "SELECT * FROM documents WHERE owner_id = $1";
    const params: any[] = [owner_id];

    if (school_id !== undefined) {
      query += " AND school_id = $2";
      params.push(school_id);
    }

    query += " ORDER BY last_modified_at DESC";

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Find documents in a folder
   */
  static async findByFolder(
    folder_id: string | null,
    owner_id: string
  ): Promise<Document[]> {
    const result = await pool.query(
      `SELECT * FROM documents
       WHERE folder_id ${folder_id ? "= $1" : "IS NULL"}
       AND owner_id = $2
       ORDER BY last_modified_at DESC`,
      folder_id ? [folder_id, owner_id] : [owner_id]
    );
    return result.rows;
  }

  /**
   * Update document with version conflict detection
   * This implements optimistic concurrency control
   *
   * @returns Updated document or null if version conflict
   */
  static async updateWithVersion(
    id: string,
    owner_id: string,
    data: UpdateDocumentDTO,
    client?: PoolClient
  ): Promise<{ document: Document | null; conflict: boolean }> {
    const dbClient = client || pool;

    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build dynamic update query
    if (data.title !== undefined) {
      fields.push(`title = $${paramIndex++}`);
      values.push(data.title);
    }

    if (data.content !== undefined) {
      fields.push(`content = $${paramIndex++}`);
      values.push(data.content);
    }

    if (data.content_format !== undefined) {
      fields.push(`content_format = $${paramIndex++}`);
      values.push(data.content_format);
    }

    if (data.document_type !== undefined) {
      fields.push(`document_type = $${paramIndex++}`);
      values.push(data.document_type);
    }

    if (data.citation_style !== undefined) {
      fields.push(`citation_style = $${paramIndex++}`);
      values.push(data.citation_style);
    }

    if (data.assets !== undefined) {
      fields.push(`assets = $${paramIndex++}`);
      values.push(JSON.stringify(data.assets));
    }

    if (data.outline !== undefined) {
      fields.push(`outline = $${paramIndex++}`);
      values.push(JSON.stringify(data.outline));
    }

    if (data.research_notes !== undefined) {
      fields.push(`research_notes = $${paramIndex++}`);
      values.push(JSON.stringify(data.research_notes));
    }

    if (data.edit_history !== undefined) {
      fields.push(`edit_history = $${paramIndex++}`);
      values.push(JSON.stringify(data.edit_history));
    }

    if (data.sources !== undefined) {
      fields.push(`sources = $${paramIndex++}`);
      values.push(JSON.stringify(data.sources));
    }

    if (data.formatting !== undefined) {
      fields.push(`formatting = $${paramIndex++}`);
      values.push(JSON.stringify(data.formatting));
    }

    if (data.folder_id !== undefined) {
      fields.push(`folder_id = $${paramIndex++}`);
      values.push(data.folder_id);
    }

    // Always update version and last_modified_by
    fields.push(`version = version + 1`);
    fields.push(`last_modified_by = $${paramIndex++}`);
    values.push(owner_id);
    fields.push(`last_modified_at = current_timestamp`);

    // Add WHERE conditions
    values.push(id, owner_id, data.client_version);

    const result = await dbClient.query(
      `UPDATE documents
       SET ${fields.join(", ")}
       WHERE id = $${paramIndex++}
         AND owner_id = $${paramIndex++}
         AND version = $${paramIndex++}
       RETURNING *`,
      values
    );

    // If no rows updated, version conflict occurred
    if (result.rowCount === 0) {
      return { document: null, conflict: true };
    }

    return { document: result.rows[0], conflict: false };
  }

  /**
   * Delete document
   */
  static async delete(id: string, owner_id: string): Promise<boolean> {
    const result = await pool.query(
      "DELETE FROM documents WHERE id = $1 AND owner_id = $2",
      [id, owner_id]
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Move document to different folder
   */
  static async moveToFolder(
    document_id: string,
    folder_id: string | null,
    owner_id: string
  ): Promise<Document | null> {
    const result = await pool.query(
      `UPDATE documents
       SET folder_id = $1
       WHERE id = $2 AND owner_id = $3
       RETURNING *`,
      [folder_id, document_id, owner_id]
    );

    return result.rows[0] || null;
  }

  /**
   * Check if document exists and user owns it
   */
  static async isOwner(document_id: string, user_id: string): Promise<boolean> {
    const result = await pool.query(
      "SELECT id FROM documents WHERE id = $1 AND owner_id = $2",
      [document_id, user_id]
    );
    return result.rows.length > 0;
  }

  /**
   * Get document with folder path
   */
  static async getDocumentWithPath(
    id: string,
    owner_id: string
  ): Promise<any | null> {
    const result = await pool.query(
      `SELECT
         d.*,
         f.name as folder_name
       FROM documents d
       LEFT JOIN folders f ON d.folder_id = f.id
       WHERE d.id = $1 AND d.owner_id = $2`,
      [id, owner_id]
    );

    return result.rows[0] || null;
  }

  /**
   * Get documents by assignment (for teachers to see all submissions)
   * Added for multi-tenancy: school_id filter
   */
  static async findByAssignment(
    assignment_id: string,
    school_id: string
  ): Promise<Document[]> {
    const result = await pool.query(
      `SELECT d.*,
              u.first_name,
              u.last_name,
              u.email
       FROM documents d
       JOIN users u ON d.owner_id = u.id
       WHERE d.assignment_id = $1
         AND d.school_id = $2
       ORDER BY d.created_at DESC`,
      [assignment_id, school_id]
    );

    return result.rows;
  }

  /**
   * Get documents by class (for class-wide document sharing)
   * Added for multi-tenancy: school_id filter
   */
  static async findByClass(
    class_id: string,
    school_id: string
  ): Promise<Document[]> {
    const result = await pool.query(
      `SELECT d.*,
              u.first_name,
              u.last_name
       FROM documents d
       JOIN users u ON d.owner_id = u.id
       WHERE d.class_id = $1
         AND d.school_id = $2
       ORDER BY d.last_modified_at DESC`,
      [class_id, school_id]
    );

    return result.rows;
  }
}
