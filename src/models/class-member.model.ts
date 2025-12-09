import { pool } from "../config/postgres.db.js";
import {
  ClassMember,
  AddClassMemberDTO,
  ClassMemberRole,
} from "../types/class.types.js";

export class ClassMemberModel {
  /**
   * Add a member to a class
   */
  static async add(
    classId: string,
    memberData: AddClassMemberDTO
  ): Promise<ClassMember> {
    const result = await pool.query(
      `INSERT INTO class_members (
        class_id, user_id, role, joined_via
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [classId, memberData.user_id, memberData.role, memberData.joined_via]
    );

    return result.rows[0];
  }

  /**
   * Get member by class and user ID
   */
  static async findByClassAndUser(
    classId: string,
    userId: string
  ): Promise<ClassMember | null> {
    const result = await pool.query(
      "SELECT * FROM class_members WHERE class_id = $1 AND user_id = $2",
      [classId, userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all members of a class
   */
  // static async findByClassId(classId: string): Promise<ClassMember[]> {
  //   const result = await pool.query(
  //     "SELECT * FROM class_members WHERE class_id = $1 ORDER BY joined_at DESC",
  //     [classId]
  //   );
  //   return result.rows;
  // }
  
static async findByClassId(classId: string): Promise<any[]> {
  const result = await pool.query(
    `
    SELECT 
      cm.id AS member_id,
      cm.class_id,
      cm.user_id,
      cm.role,
      cm.joined_at,
      u.first_name,
      u.last_name,
      u.email,
      u.user_type,
      u.profile_image
    FROM class_members cm
    JOIN users u ON cm.user_id = u.id
    WHERE cm.class_id = $1
    ORDER BY cm.joined_at DESC
    `,
    [classId]
  );
  return result.rows;
}




  /**
   * Get members by role
   */
  static async findByClassIdAndRole(
    classId: string,
    role: ClassMemberRole
  ): Promise<ClassMember[]> {
    const result = await pool.query(
      `SELECT * FROM class_members
       WHERE class_id = $1 AND role = $2 AND status = 'active'
       ORDER BY joined_at DESC`,
      [classId, role]
    );
    return result.rows;
  }

  /**
   * Get all classes for a user
   */
  static async findByUserId(userId: string): Promise<ClassMember[]> {
    const result = await pool.query(
      `SELECT * FROM class_members
       WHERE user_id = $1 AND status = 'active'
       ORDER BY joined_at DESC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Remove a member from a class
   */
  static async remove(classId: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE class_members
       SET status = 'removed', updated_at = NOW()
       WHERE class_id = $1 AND user_id = $2`,
      [classId, userId]
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Check if user is a member of a class
   */
  static async isMember(classId: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT id FROM class_members
       WHERE class_id = $1 AND user_id = $2 AND status = 'active'`,
      [classId, userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Check if user has a specific role in a class
   */
  static async hasRole(
    classId: string,
    userId: string,
    role: ClassMemberRole
  ): Promise<boolean> {
    const result = await pool.query(
      `SELECT id FROM class_members
       WHERE class_id = $1 AND user_id = $2 AND role = $3 AND status = 'active'`,
      [classId, userId, role]
    );
    return result.rows.length > 0;
  }

  /**
   * Update member role
   */
  static async updateRole(
    classId: string,
    userId: string,
    role: ClassMemberRole
  ): Promise<ClassMember | null> {
    const result = await pool.query(
      `UPDATE class_members
       SET role = $1, updated_at = NOW()
       WHERE class_id = $2 AND user_id = $3
       RETURNING *`,
      [role, classId, userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Remove user from all non-completed classes
   * Used when soft deleting a user - removes them from active classes only
   * @param userId - ID of the user to remove from classes
   * @returns Promise<number> - Number of class memberships removed
   */
  static async removeFromNonCompletedClasses(userId: string): Promise<number> {
    const result = await pool.query(
      `DELETE FROM class_members cm
       USING classes c
       WHERE cm.class_id = c.id
         AND cm.user_id = $1
         AND c.status NOT IN ('completed', 'archived')`,
      [userId]
    );
    return result.rowCount || 0;
  }

  /**
   * Get count of user's active class memberships by class status
   * Useful for auditing before user deletion
   * @param userId - ID of the user
   * @returns Promise with counts of completed and non-completed classes
   */
  static async getUserClassStats(
    userId: string
  ): Promise<{
    total_classes: number;
    completed_classes: number;
    active_classes: number;
  }> {
    const result = await pool.query(
      `SELECT
         COUNT(*) as total_classes,
         COUNT(CASE WHEN c.status IN ('completed', 'archived') THEN 1 END) as completed_classes,
         COUNT(CASE WHEN c.status NOT IN ('completed', 'archived') THEN 1 END) as active_classes
       FROM class_members cm
       INNER JOIN classes c ON cm.class_id = c.id
       WHERE cm.user_id = $1 AND cm.status = 'active'`,
      [userId]
    );

    return {
      total_classes: parseInt(result.rows[0]?.total_classes || "0"),
      completed_classes: parseInt(result.rows[0]?.completed_classes || "0"),
      active_classes: parseInt(result.rows[0]?.active_classes || "0"),
    };
  }
}
