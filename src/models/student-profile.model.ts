import { pool } from "../config/postgres.db.js";
import { QueryResult, PoolClient } from "pg";
import {
  StudentProfile,
  CreateStudentProfileDTO,
  UpdateStudentProfileDTO,
  StudentStatus,
} from "../types/profile.types.js";

export class StudentProfileModel {
  /**
   * Find student profile by user ID
   */
  static async findByUserId(
    userId: string,
    client?: PoolClient
  ): Promise<StudentProfile | null> {
    const dbClient = client || pool;

    const result: QueryResult<StudentProfile> = await dbClient.query(
      "SELECT * FROM student_profiles WHERE user_id = $1",
      [userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find student profile by ID
   */
  static async findById(
    id: string,
    schoolId?: string
  ): Promise<StudentProfile | null> {
    let query = "SELECT * FROM student_profiles WHERE id = $1";
    const params: string[] = [id];

    if (schoolId) {
      query += " AND school_id = $2";
      params.push(schoolId);
    }

    const result: QueryResult<StudentProfile> = await pool.query(query, params);
    return result.rows[0] || null;
  }

  /**
   * Find all student profiles for a school
   */
  static async findAll(
    schoolId: string,
    activeOnly = true,
    status?: StudentStatus
  ): Promise<StudentProfile[]> {
    let query = "SELECT * FROM student_profiles WHERE school_id = $1";
    const params: any[] = [schoolId];
    let paramCount = 2;

    if (activeOnly) {
      query += " AND is_active = true";
    }

    if (status) {
      query += ` AND status = $${paramCount++}`;
      params.push(status);
    }

    query += " ORDER BY created_at DESC";

    const result: QueryResult<StudentProfile> = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Create student profile
   */
  static async create(
    schoolId: string,
    data: CreateStudentProfileDTO,
    client?: PoolClient
  ): Promise<StudentProfile> {
    const dbClient = client || pool;

    const result: QueryResult<StudentProfile> = await dbClient.query(
      `INSERT INTO student_profiles (
        school_id, user_id, admission_number, admission_date, roll_number,
        current_class_id, father_name, father_phone, father_email, father_occupation,
        mother_name, mother_phone, mother_email, mother_occupation,
        guardian_name, guardian_phone, guardian_email, guardian_relation,
        blood_group, medical_conditions, allergies, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *`,
      [
        schoolId,
        data.user_id,
        data.admission_number,
        data.admission_date,
        data.roll_number || null,
        data.current_class_id || null,
        data.father_name || null,
        data.father_phone || null,
        data.father_email || null,
        data.father_occupation || null,
        data.mother_name || null,
        data.mother_phone || null,
        data.mother_email || null,
        data.mother_occupation || null,
        data.guardian_name || null,
        data.guardian_phone || null,
        data.guardian_email || null,
        data.guardian_relation || null,
        data.blood_group || null,
        data.medical_conditions || null,
        data.allergies || null,
        data.status || "active",
      ]
    );

    if (!result.rows[0]) throw new Error("Failed to create student profile");

    return result.rows[0];
  }

  /**
   * Update student profile
   */
  static async update(
    id: string,
    schoolId: string,
    data: UpdateStudentProfileDTO
  ): Promise<StudentProfile | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    // Build dynamic update query
    const updateFields = [
      'admission_number', 'admission_date', 'roll_number', 'current_class_id',
      'father_name', 'father_phone', 'father_email', 'father_occupation',
      'mother_name', 'mother_phone', 'mother_email', 'mother_occupation',
      'guardian_name', 'guardian_phone', 'guardian_email', 'guardian_relation',
      'blood_group', 'medical_conditions', 'allergies', 'status', 'is_active'
    ];

    for (const field of updateFields) {
      if (data[field as keyof UpdateStudentProfileDTO] !== undefined) {
        fields.push(`${field} = $${paramCount++}`);
        values.push(data[field as keyof UpdateStudentProfileDTO]);
      }
    }

    if (fields.length === 0) return await this.findById(id, schoolId);

    fields.push(`updated_at = NOW()`);
    values.push(id, schoolId);

    const query = `
      UPDATE student_profiles
      SET ${fields.join(", ")}
      WHERE id = $${paramCount++} AND school_id = $${paramCount++}
      RETURNING *
    `;

    const result: QueryResult<StudentProfile> = await pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete student profile (soft delete)
   */
  static async delete(id: string, schoolId: string): Promise<boolean> {
    const result = await pool.query(
      "UPDATE student_profiles SET is_active = false, updated_at = NOW() WHERE id = $1 AND school_id = $2",
      [id, schoolId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Find by admission number
   */
  static async findByAdmissionNumber(
    admissionNumber: string,
    schoolId: string
  ): Promise<StudentProfile | null> {
    const result: QueryResult<StudentProfile> = await pool.query(
      "SELECT * FROM student_profiles WHERE school_id = $1 AND admission_number = $2",
      [schoolId, admissionNumber]
    );
    return result.rows[0] || null;
  }

  /**
   * Find by class
   */
  static async findByClass(
    classId: string,
    schoolId: string
  ): Promise<StudentProfile[]> {
    const result: QueryResult<StudentProfile> = await pool.query(
      "SELECT * FROM student_profiles WHERE school_id = $1 AND current_class_id = $2 AND is_active = true ORDER BY roll_number, created_at",
      [schoolId, classId]
    );
    return result.rows;
  }

  /**
   * Update student status
   */
  static async updateStatus(
    id: string,
    schoolId: string,
    status: StudentStatus
  ): Promise<StudentProfile | null> {
    const result: QueryResult<StudentProfile> = await pool.query(
      "UPDATE student_profiles SET status = $1, updated_at = NOW() WHERE id = $2 AND school_id = $3 RETURNING *",
      [status, id, schoolId]
    );
    return result.rows[0] || null;
  }
}
