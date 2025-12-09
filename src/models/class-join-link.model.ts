import { pool } from "../config/postgres.db.js";
import crypto from "crypto";
import {
  ClassJoinLink,
  CreateJoinLinkDTO,
  JoinLinkUsage,
} from "../types/class.types.js";

export class ClassJoinLinkModel {
  /**
   * Generate a unique token
   */
  private static generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Create a new join link
   */
  static async create(
    classId: string,
    createdBy: string,
    linkData: CreateJoinLinkDTO
  ): Promise<ClassJoinLink> {
    // Deactivate any existing active links for this class-role combination
    await pool.query(
      `UPDATE class_join_links
       SET is_active = false, updated_at = NOW()
       WHERE class_id = $1 AND role = $2 AND is_active = true`,
      [classId, linkData.role]
    );

    // Default expiry: 30 days from now
    const expiresAt =
      linkData.expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const token = ClassJoinLinkModel.generateToken();

    const result = await pool.query(
      `INSERT INTO class_join_links (
        class_id, role, token, created_by, max_uses, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        classId,
        linkData.role,
        token,
        createdBy,
        linkData.max_uses || null,
        expiresAt,
      ]
    );

    return result.rows[0];
  }

  /**
   * Find join link by token
   */
  static async findByToken(token: string): Promise<ClassJoinLink | null> {
    const result = await pool.query(
      "SELECT * FROM class_join_links WHERE token = $1",
      [token]
    );
    return result.rows[0] || null;
  }

  /**
   * Find active join link for class and role
   */
  static async findActiveByClassAndRole(
    classId: string,
    role: "teacher" | "student"
  ): Promise<ClassJoinLink | null> {
    const result = await pool.query(
      `SELECT * FROM class_join_links
       WHERE class_id = $1 AND role = $2 AND is_active = true AND expires_at > NOW()`,
      [classId, role]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all join links for a class
   */
  static async findByClassId(classId: string): Promise<ClassJoinLink[]> {
    const result = await pool.query(
      "SELECT * FROM class_join_links WHERE class_id = $1 ORDER BY created_at DESC",
      [classId]
    );
    return result.rows;
  }

  /**
   * Increment usage count
   */
  static async incrementUsage(linkId: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE class_join_links
       SET current_uses = current_uses + 1, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [linkId]
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Record link usage
   */
  static async recordUsage(
    linkId: string,
    userId: string
  ): Promise<JoinLinkUsage> {
    const result = await pool.query(
      `INSERT INTO join_link_usage (join_link_id, user_id)
       VALUES ($1, $2)
       RETURNING *`,
      [linkId, userId]
    );
    return result.rows[0];
  }

  /**
   * Check if link is valid and can be used
   */
  static async isValid(token: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT id FROM class_join_links
       WHERE token = $1 AND is_active = true AND expires_at > NOW()
       AND (max_uses IS NULL OR current_uses < max_uses)`,
      [token]
    );
    return result.rows.length > 0;
  }

  /**
   * Deactivate a join link
   */
  static async deactivate(linkId: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE class_join_links
       SET is_active = false, updated_at = NOW()
       WHERE id = $1`,
      [linkId]
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Get usage history for a link
   */
  static async getUsageHistory(linkId: string): Promise<JoinLinkUsage[]> {
    const result = await pool.query(
      "SELECT * FROM join_link_usage WHERE join_link_id = $1 ORDER BY used_at DESC",
      [linkId]
    );
    return result.rows;
  }

  /**
   * Check if user has already used a link
   */
  static async hasUserUsedLink(
    linkId: string,
    userId: string
  ): Promise<boolean> {
    const result = await pool.query(
      "SELECT id FROM join_link_usage WHERE join_link_id = $1 AND user_id = $2",
      [linkId, userId]
    );
    return result.rows.length > 0;
  }
}
