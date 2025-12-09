import { pool } from "../config/postgres.db.js";
import { QueryResult, PoolClient } from "pg";
import {
  TeacherProfile,
  CreateTeacherProfileDTO,
  UpdateTeacherProfileDTO,
} from "../types/profile.types.js";

export class TeacherProfileModel {
  /**
   * Find teacher profile by user ID
   */
  static async findByUserId(
    userId: string,
    client?: PoolClient
  ): Promise<TeacherProfile | null> {
    const dbClient = client || pool;

    const result: QueryResult<TeacherProfile> = await dbClient.query(
      "SELECT * FROM teacher_profiles WHERE user_id = $1",
      [userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find teacher profile by ID
   */
  static async findById(
    id: string,
    schoolId?: string
  ): Promise<TeacherProfile | null> {
    let query = "SELECT * FROM teacher_profiles WHERE id = $1";
    const params: string[] = [id];

    if (schoolId) {
      query += " AND school_id = $2";
      params.push(schoolId);
    }

    const result: QueryResult<TeacherProfile> = await pool.query(query, params);
    return result.rows[0] || null;
  }

  /**
   * Find all teacher profiles for a school
   */
  static async findAll(
    schoolId: string,
    activeOnly = true
  ): Promise<TeacherProfile[]> {
    const query = activeOnly
      ? "SELECT * FROM teacher_profiles WHERE school_id = $1 AND is_active = true ORDER BY created_at DESC"
      : "SELECT * FROM teacher_profiles WHERE school_id = $1 ORDER BY created_at DESC";

    const result: QueryResult<TeacherProfile> = await pool.query(query, [
      schoolId,
    ]);
    return result.rows;
  }

  /**
   * Create teacher profile
   */
  static async create(
    schoolId: string,
    data: CreateTeacherProfileDTO,
    client?: PoolClient
  ): Promise<TeacherProfile> {
    const dbClient = client || pool;

    const result: QueryResult<TeacherProfile> = await dbClient.query(
      `INSERT INTO teacher_profiles (
        school_id, user_id, employee_id, department_id, qualification,
        specialization, experience_years, join_date, employment_type, salary, bio
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        schoolId,
        data.user_id,
        data.employee_id,
        data.department_id || null,
        data.qualification,
        data.specialization || null,
        data.experience_years || 0,
        data.join_date,
        data.employment_type || "full_time",
        data.salary || null,
        data.bio || null,
      ]
    );

    if (!result.rows[0]) throw new Error("Failed to create teacher profile");

    return result.rows[0];
  }

  /**
   * Update teacher profile
   */
  static async update(
    id: string,
    schoolId: string,
    data: UpdateTeacherProfileDTO
  ): Promise<TeacherProfile | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.employee_id !== undefined) {
      fields.push(`employee_id = $${paramCount++}`);
      values.push(data.employee_id);
    }

    if (data.department_id !== undefined) {
      fields.push(`department_id = $${paramCount++}`);
      values.push(data.department_id);
    }

    if (data.qualification !== undefined) {
      fields.push(`qualification = $${paramCount++}`);
      values.push(data.qualification);
    }

    if (data.specialization !== undefined) {
      fields.push(`specialization = $${paramCount++}`);
      values.push(data.specialization);
    }

    if (data.experience_years !== undefined) {
      fields.push(`experience_years = $${paramCount++}`);
      values.push(data.experience_years);
    }

    if (data.join_date !== undefined) {
      fields.push(`join_date = $${paramCount++}`);
      values.push(data.join_date);
    }

    if (data.employment_type !== undefined) {
      fields.push(`employment_type = $${paramCount++}`);
      values.push(data.employment_type);
    }

    if (data.salary !== undefined) {
      fields.push(`salary = $${paramCount++}`);
      values.push(data.salary);
    }

    if (data.bio !== undefined) {
      fields.push(`bio = $${paramCount++}`);
      values.push(data.bio);
    }

    if (data.is_active !== undefined) {
      fields.push(`is_active = $${paramCount++}`);
      values.push(data.is_active);
    }

    if (fields.length === 0) return await this.findById(id, schoolId);

    fields.push(`updated_at = NOW()`);
    values.push(id, schoolId);

    const query = `
      UPDATE teacher_profiles
      SET ${fields.join(", ")}
      WHERE id = $${paramCount++} AND school_id = $${paramCount++}
      RETURNING *
    `;

    const result: QueryResult<TeacherProfile> = await pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete teacher profile (soft delete)
   */
  static async delete(id: string, schoolId: string): Promise<boolean> {
    const result = await pool.query(
      "UPDATE teacher_profiles SET is_active = false, updated_at = NOW() WHERE id = $1 AND school_id = $2",
      [id, schoolId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Find by employee ID
   */
  static async findByEmployeeId(
    employeeId: string,
    schoolId: string
  ): Promise<TeacherProfile | null> {
    const result: QueryResult<TeacherProfile> = await pool.query(
      "SELECT * FROM teacher_profiles WHERE school_id = $1 AND employee_id = $2",
      [schoolId, employeeId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find by department
   */
  static async findByDepartment(
    departmentId: string,
    schoolId: string
  ): Promise<TeacherProfile[]> {
    const result: QueryResult<TeacherProfile> = await pool.query(
      "SELECT * FROM teacher_profiles WHERE school_id = $1 AND department_id = $2 AND is_active = true ORDER BY created_at DESC",
      [schoolId, departmentId]
    );
    return result.rows;
  }
}
