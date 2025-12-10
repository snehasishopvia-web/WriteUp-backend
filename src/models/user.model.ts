import { pool } from "../config/postgres.db.js";
import bcrypt from "bcryptjs";
import { PoolClient } from "pg";

export interface User {
  id: string;
  username: string;
  email: string | null;
  temp_email: boolean;
  password: string;
  first_name?: string;
  last_name?: string;
  user_type: string;
  subject?: string;
  account_id?: string;
  school_id?: string;
  phone?: string;
  date_of_birth?: Date;
  gender?: string;
  profile_picture?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  timezone: string;
  language: string;
  last_login_ip?: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  deleted_at?: Date;
  deleted_by?: string;
  deletion_reason?: string;
  last_login?: Date;
  date_joined: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserDTO {
  username?: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  user_type?: string;
  phone?: string;
  date_of_birth?: Date;
  account_id?: string | null;
  address: string | null
}

export interface UpdateUserDTO {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  date_of_birth?: Date;
  gender?: string;
  address?: string | null;
  profile_picture?: string;
  timezone?: string;
  language?: string;
  total_students?: number;
  total_teachers?: number;
  total_classes?: number; 
  total_schools?: number; 
  reset_otp?: string;
  reset_otp_expires_at?: Date;
}

export class UserModel {
  /**
   * Create user with optional database client (for transactions)
   */
  static async create(
    userData: CreateUserDTO,
    client?: PoolClient
  ): Promise<User> {
    // const hashedPassword = await bcrypt.hash(userData.password, 12);
    const username = userData.username || userData.email;

    const dbClient = client || pool;

    const result = await dbClient.query(
      `INSERT INTO users (
        username, email, password, first_name, last_name,
        user_type, phone, date_of_birth, account_id, address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        username,
        userData.email,
        userData.password,
        userData.first_name || "",
        userData.last_name || "",
        userData.user_type,
        userData.phone || null,
        userData.date_of_birth || null,
        userData.account_id || null,
        userData.address || null
      ]
    );

    return result.rows[0];
  }

  static async findByEmail(email: string): Promise<User | null> {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    return result.rows[0] || null;
  }
  static async findByUsername(username: string): Promise<User | null> {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);
    return result.rows[0] || null;
  }

  static async findById(id: string): Promise<User | null> {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    return result.rows[0] || null;
  }

  static async findPrimaryByAccountId(
    accountId: string
  ): Promise<User | null> {
    const result = await pool.query(
      `SELECT *
       FROM users
       WHERE account_id = $1
         AND is_active = true
         AND deleted_at IS NULL
       ORDER BY created_at ASC
       LIMIT 1`,
      [accountId]
    );

    return result.rows[0] || null;
  }

  static async update(
    id: string,
    userData: UpdateUserDTO
  ): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(userData).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (fields.length === 0) return await UserModel.findById(id);

    fields.push(`updated_at = $${paramIndex}`);
    values.push(new Date());
    values.push(id);

    const query = `
      UPDATE users
      SET ${fields.join(", ")}
      WHERE id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  static async updateSchoolId(
    id: string,
    school_id: string
  ): Promise<User | null> {
    if (!school_id) return await UserModel.findById(id);

    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    fields.push(`school_id = $${paramIndex}`);
    values.push(school_id);
    paramIndex++;

    fields.push(`updated_at = $${paramIndex}`);
    values.push(new Date());
    paramIndex++;

    values.push(id);

    const query = `
    UPDATE users
    SET ${fields.join(", ")}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  static async updateLastLogin(id: string, ip?: string): Promise<void> {
    await pool.query(
      `UPDATE users
       SET last_login = $1, last_login_ip = $2
       WHERE id = $3`,
      [new Date(), ip || null, id]
    );
  }

  static async comparePassword(
    plainPassword: string,
    hashedPassword: string
  ): Promise<boolean> {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  static async changePassword(id: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await pool.query(
      "UPDATE users SET password = $1, updated_at = $2 WHERE id = $3",
      [hashedPassword, new Date(), id]
    );
  }

  static async findTeachersBySchoolId(schoolId: string): Promise<User[]> {
    const result = await pool.query(
      "SELECT * FROM users WHERE school_id = $1 AND user_type = $2 AND is_active = true AND deleted_at IS NULL ORDER BY created_at DESC",
      [schoolId, "teacher"]
    );
    return result.rows;
  }

  static async findStudentsBySchoolId(schoolId: string): Promise<User[]> {
    const result = await pool.query(
      "SELECT * FROM users WHERE school_id = $1 AND user_type = $2 AND is_active = true AND deleted_at IS NULL ORDER BY created_at DESC",
      [schoolId, "student"]
    );
    return result.rows;
  }

  static sanitizeUser(user: User): Partial<User> {
    const { password, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  /**
   * Soft delete a user
   * Sets is_active to false and records deletion metadata
   * @param userId - ID of the user to delete
   * @param deletedBy - ID of the admin performing the deletion
   * @param reason - Optional reason for deletion
   * @returns Promise<boolean> - true if deletion was successful
   */
  static async softDelete(
    userId: string,
    deletedBy: string,
    reason?: string
  ): Promise<boolean> {
    const result = await pool.query(
      `UPDATE users
       SET is_active = false,
           deleted_at = NOW(),
           deleted_by = $2,
           deletion_reason = $3,
           updated_at = NOW()
       WHERE id = $1 AND is_active = true AND deleted_at IS NULL`,
      [userId, deletedBy, reason || null]
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Restore a soft deleted user
   * Sets is_active back to true and clears deletion metadata
   * @param userId - ID of the user to restore
   * @returns Promise<boolean> - true if restoration was successful
   */
  static async restore(userId: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE users
       SET is_active = true,
           deleted_at = NULL,
           deleted_by = NULL,
           deletion_reason = NULL,
           updated_at = NOW()
       WHERE id = $1 AND is_active = false AND deleted_at IS NOT NULL`,
      [userId]
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Check if a user is deleted
   * @param userId - ID of the user to check
   * @returns Promise<boolean> - true if user is deleted
   */
  static async isDeleted(userId: string): Promise<boolean> {
    const result = await pool.query(
      "SELECT is_active, deleted_at FROM users WHERE id = $1",
      [userId]
    );
    if (result.rows.length === 0) return true; // User doesn't exist
    return !result.rows[0].is_active || result.rows[0].deleted_at !== null;
  }

  /**
   * Get all deleted users for a school (for admin audit purposes)
   * @param schoolId - ID of the school
   * @returns Promise<User[]> - List of deleted users
   */
  static async findDeletedUsersBySchoolId(schoolId: string): Promise<User[]> {
    const result = await pool.query(
      `SELECT u.*,
              admin.first_name as deleted_by_first_name,
              admin.last_name as deleted_by_last_name,
              admin.email as deleted_by_email
       FROM users u
       LEFT JOIN users admin ON u.deleted_by = admin.id
       WHERE u.school_id = $1
         AND u.is_active = false
         AND u.deleted_at IS NOT NULL
       ORDER BY u.deleted_at DESC`,
      [schoolId]
    );
    return result.rows;
  }
 


}
