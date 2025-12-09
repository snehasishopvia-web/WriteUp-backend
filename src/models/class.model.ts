import { pool } from "../config/postgres.db.js";
import {
  Class,
  CreateClassDTO,
  UpdateClassDTO,
} from "../types/class.types.js";

export class ClassModel {
  /**
   * Create a new class
   */
  static async create(
    classData: CreateClassDTO,
    creatorId: string,
    schoolId: string
  ): Promise<Class> {
    const result = await pool.query(
      `INSERT INTO classes (
        class_name, department_id, semester, description,
        creator_id, school_id, max_students, status,
        start_date, end_date, schedule_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        classData.class_name,
        classData.department_id,
        classData.semester,
        classData.description || null,
        creatorId,
        schoolId,
        classData.max_students || 30,
        classData.status || "draft",
        classData.start_date || null,
        classData.end_date || null,
        classData.schedule_time ? JSON.stringify(classData.schedule_time) : null,
      ]
    );

    return result.rows[0];
  }

  /**
   * Get class by ID
   */
  static async findById(classId: string): Promise<Class | null> {
    const result = await pool.query("SELECT * FROM classes WHERE id = $1", [
      classId,
    ]);
    return result.rows[0] || null;
  }

  /**
   * Get all classes for a school
   */
  static async findBySchoolId(schoolId: string): Promise<Class[]> {
    const result = await pool.query(
      "SELECT * FROM classes WHERE school_id = $1 ORDER BY created_at DESC",
      [schoolId]
    );
    return result.rows;
  }

  /**
   * Get classes created by a specific user
   */
  static async findByCreatorId(creatorId: string): Promise<Class[]> {
    const result = await pool.query(
      "SELECT * FROM classes WHERE creator_id = $1 ORDER BY created_at DESC",
      [creatorId]
    );
    return result.rows;
  }

  /**
   * Update a class
   */
  static async update(
    classId: string,
    classData: UpdateClassDTO
  ): Promise<Class | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(classData).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === "schedule_time") {
          fields.push(`${key} = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    });

    if (fields.length === 0) return await ClassModel.findById(classId);

    fields.push(`updated_at = $${paramIndex}`);
    values.push(new Date());
    values.push(classId);

    const query = `
      UPDATE classes
      SET ${fields.join(", ")}
      WHERE id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete a class (soft delete)
   */
  static async delete(classId: string): Promise<boolean> {
    const result = await pool.query(
      "UPDATE classes SET is_active = false, updated_at = NOW() WHERE id = $1",
      [classId]
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Hard delete a class
   */
  static async hardDelete(classId: string): Promise<boolean> {
    const result = await pool.query("DELETE FROM classes WHERE id = $1", [
      classId,
    ]);
    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Get current student count in a class
   */
  static async getStudentCount(classId: string): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM class_members
       WHERE class_id = $1 AND role = 'student' AND status = 'active'`,
      [classId]
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Check if class is full
   */
  static async isFull(classId: string): Promise<boolean> {
    const classData = await ClassModel.findById(classId);
    if (!classData) return false;

    const studentCount = await ClassModel.getStudentCount(classId);
    return studentCount >= classData.max_students;
  }

  /**
   * Get classes where user is a member, optionally filtered by semester
   */
  static async findByUserIdAndSemester(
    userId: string,
    semester?: string
  ): Promise<Class[]> {
    let query = `
      SELECT DISTINCT c.*
      FROM classes c
      INNER JOIN class_members cm ON c.id = cm.class_id
      WHERE cm.user_id = $1 AND cm.status = 'active' AND c.is_active = true
    `;

    const params: any[] = [userId];

    if (semester) {
      query += ` AND c.semester = $2`;
      params.push(semester);
    }

    query += ` ORDER BY c.created_at DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  }
}
