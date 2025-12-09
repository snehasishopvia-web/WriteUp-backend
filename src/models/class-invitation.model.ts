import { pool } from "../config/postgres.db.js";
import {
  ClassInvitation,
  CreateInvitationDTO,
} from "../types/class.types.js";

export class ClassInvitationModel {
  /**
   * Create a new invitation
   */
  static async create(
    classId: string,
    invitedBy: string,
    invitationData: CreateInvitationDTO
  ): Promise<ClassInvitation> {
    // Default expiry: 7 days from now
    const expiresAt =
      invitationData.expires_at ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = await pool.query(
      `INSERT INTO class_invitations (
        class_id, invited_by, invited_email, role, expires_at
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        classId,
        invitedBy,
        invitationData.invited_email,
        invitationData.role,
        expiresAt,
      ]
    );

    return result.rows[0];
  }

  /**
   * Find invitation by ID
   */
  static async findById(
    invitationId: string
  ): Promise<ClassInvitation | null> {
    const result = await pool.query(
      "SELECT * FROM class_invitations WHERE id = $1",
      [invitationId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find invitations for a class
   */
  static async findByClassId(classId: string): Promise<ClassInvitation[]> {
    const result = await pool.query(
      "SELECT * FROM class_invitations WHERE class_id = $1 ORDER BY created_at DESC",
      [classId]
    );
    return result.rows;
  }

  /**
   * Find pending invitations by email
   */
  static async findPendingByEmail(
    email: string
  ): Promise<ClassInvitation[]> {
    const result = await pool.query(
      `SELECT * FROM class_invitations
       WHERE invited_email = $1 AND status = 'pending' AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [email]
    );
    return result.rows;
  }

  /**
   * Accept an invitation
   */
  static async accept(invitationId: string): Promise<ClassInvitation | null> {
    const result = await pool.query(
      `UPDATE class_invitations
       SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'pending' AND expires_at > NOW()
       RETURNING *`,
      [invitationId]
    );
    return result.rows[0] || null;
  }

  /**
   * Revoke an invitation
   */
  static async revoke(invitationId: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE class_invitations
       SET status = 'revoked', updated_at = NOW()
       WHERE id = $1 AND status = 'pending'`,
      [invitationId]
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Mark expired invitations
   */
  static async markExpired(): Promise<number> {
    const result = await pool.query(
      `UPDATE class_invitations
       SET status = 'expired', updated_at = NOW()
       WHERE status = 'pending' AND expires_at <= NOW()`
    );
    return result.rowCount || 0;
  }

  /**
   * Check if email has pending invitation for class
   */
  static async hasPendingInvitation(
    classId: string,
    email: string
  ): Promise<boolean> {
    const result = await pool.query(
      `SELECT id FROM class_invitations
       WHERE class_id = $1 AND invited_email = $2 AND status = 'pending' AND expires_at > NOW()`,
      [classId, email]
    );
    return result.rows.length > 0;
  }
}
