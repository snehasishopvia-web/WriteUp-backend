import { pool } from "../config/postgres.db.js";
import { PoolClient } from "pg";

export interface Folder {
  id: string;
  name: string;
  parent_id?: string;
  owner_id: string;
  school_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateFolderDTO {
  name: string;
  parent_id?: string;
  school_id?: string;
}

export interface UpdateFolderDTO {
  name?: string;
  parent_id?: string;
}

export class FolderModel {
  /**
   * Create a new folder
   */
  static async create(
    owner_id: string,
    data: CreateFolderDTO,
    client?: PoolClient
  ): Promise<Folder> {
    const dbClient = client || pool;

    const result = await dbClient.query(
      `INSERT INTO folders (name, parent_id, owner_id, school_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.name, data.parent_id || null, owner_id, data.school_id || null]
    );

    return result.rows[0];
  }

  /**
   * Find folder by ID
   */
  static async findById(id: string): Promise<Folder | null> {
    const result = await pool.query("SELECT * FROM folders WHERE id = $1", [
      id,
    ]);
    return result.rows[0] || null;
  }

  /**
   * Find folders by owner
   * @param owner_id - User ID
   * @param school_id - Optional school filter for multi-tenancy
   */
  static async findByOwner(
    owner_id: string,
    school_id?: string
  ): Promise<Folder[]> {
    let query = "SELECT * FROM folders WHERE owner_id = $1";
    const params: any[] = [owner_id];

    if (school_id !== undefined) {
      query += " AND school_id = $2";
      params.push(school_id);
    }

    query += " ORDER BY name";

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Find child folders of a parent
   */
  static async findChildren(
    parent_id: string | null,
    owner_id: string
  ): Promise<Folder[]> {
    const result = await pool.query(
      `SELECT * FROM folders
       WHERE parent_id ${parent_id ? "= $1" : "IS NULL"}
       AND owner_id = $2
       ORDER BY name`,
      parent_id ? [parent_id, owner_id] : [owner_id]
    );
    return result.rows;
  }

  /**
   * Update folder
   */
  static async update(
    id: string,
    owner_id: string,
    data: UpdateFolderDTO
  ): Promise<Folder | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }

    if (data.parent_id !== undefined) {
      fields.push(`parent_id = $${paramIndex++}`);
      values.push(data.parent_id);
    }

    if (fields.length === 0) {
      return await FolderModel.findById(id);
    }

    values.push(id, owner_id);

    const result = await pool.query(
      `UPDATE folders
       SET ${fields.join(", ")}
       WHERE id = $${paramIndex++} AND owner_id = $${paramIndex++}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete folder
   * Note: Cascade delete will remove child folders
   * Documents in this folder will have folder_id set to NULL (per migration)
   */
  static async delete(id: string, owner_id: string): Promise<boolean> {
    const result = await pool.query(
      "DELETE FROM folders WHERE id = $1 AND owner_id = $2",
      [id, owner_id]
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Get full path of folder (e.g., "Parent/Child/Grandchild")
   */
  static async getPath(id: string): Promise<string> {
    const folder = await FolderModel.findById(id);
    if (!folder) return "";

    if (!folder.parent_id) {
      return folder.name;
    }

    const parentPath = await FolderModel.getPath(folder.parent_id);
    return `${parentPath}/${folder.name}`;
  }

  /**
   * Get all descendant folders recursively
   */
  static async getDescendants(id: string): Promise<Folder[]> {
    const descendants: Folder[] = [];

    const children = await pool.query(
      "SELECT * FROM folders WHERE parent_id = $1",
      [id]
    );

    for (const child of children.rows) {
      descendants.push(child);
      const childDescendants = await FolderModel.getDescendants(child.id);
      descendants.push(...childDescendants);
    }

    return descendants;
  }

  /**
   * Check if folder can be moved to target parent
   * Prevents circular references (e.g., moving folder into its own child)
   */
  static async canMoveTo(
    folder_id: string,
    target_parent_id: string | null
  ): Promise<boolean> {
    // Moving to root is always allowed
    if (!target_parent_id) {
      return true;
    }

    // Cannot move folder into itself
    if (folder_id === target_parent_id) {
      return false;
    }

    // Cannot move folder into its descendants
    const descendants = await FolderModel.getDescendants(folder_id);
    const descendantIds = descendants.map((d) => d.id);

    if (descendantIds.includes(target_parent_id)) {
      return false;
    }

    return true;
  }

  /**
   * Get folder with counts of children and documents
   */
  static async getFolderWithCounts(
    id: string,
    owner_id: string
  ): Promise<any | null> {
    const result = await pool.query(
      `SELECT
         f.*,
         (SELECT COUNT(*) FROM folders WHERE parent_id = f.id) as children_count,
         (SELECT COUNT(*) FROM documents WHERE folder_id = f.id) as documents_count
       FROM folders f
       WHERE f.id = $1 AND f.owner_id = $2`,
      [id, owner_id]
    );

    return result.rows[0] || null;
  }

  /**
   * Check if folder exists and user owns it
   */
  static async isOwner(folder_id: string, user_id: string): Promise<boolean> {
    const result = await pool.query(
      "SELECT id FROM folders WHERE id = $1 AND owner_id = $2",
      [folder_id, user_id]
    );
    return result.rows.length > 0;
  }
}
