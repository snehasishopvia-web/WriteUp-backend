import { pool } from "../config/postgres.db.js";
import { Pool, PoolClient } from "pg";
import {
  School,
  SaveOnboardingDataDTO,
  UploadSummary,
  calculateOnboardingProgress,
  isBasicInfoComplete,
  getSchoolTypeLabel,
  getClassStructureLabel,
} from "../types/school.types.js";

export class SchoolModel {

   static async generateUniqueKey(): Promise<string> {
    let key: string;
    let exists: boolean;

    do {
      // Generate a random 4-digit key
      key = String(Math.floor(1000 + Math.random() * 9000));

      // Check if key already exists in DB
      const result = await pool.query("SELECT 1 FROM schools WHERE unique_key = $1 LIMIT 1", [key]);
      exists = (result.rowCount ?? 0) > 0;
    } while (exists);

    return key;
  }
  /**
   * Create or update school for admin
   */
  static async createOrUpdate(
    adminId: string | null,
    data: SaveOnboardingDataDTO,
    client?: PoolClient
  ): Promise<{ school: School; created: boolean }> {
    const dbClient = client || pool;

    const existingSchool = adminId ? await this.findByAdmin(adminId, dbClient) : null;

    if (existingSchool) {
      const result = await dbClient.query(
        `UPDATE schools
         SET name = $1,
             school_type = $2,
             class_structure_type = $3,
             additional_programs = $4,
             timezone = $5,
             updated_at = NOW()
         WHERE admin_id = $6
         RETURNING *`,
        [
          data.name,
          data.school_type,
          data.class_structure_type,
          JSON.stringify(data.additional_programs || []),
          data.timezone,
          adminId,
        ]
      );

      return { school: result.rows[0], created: false };
    } else {
      const uniqueKey = await this.generateUniqueKey();
      const result = await dbClient.query(
        `INSERT INTO schools (
           name, school_type, class_structure_type,
           additional_programs, timezone, admin_id, unique_key
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          data.name,
          data.school_type,
          data.class_structure_type,
          JSON.stringify(data.additional_programs || []),
          data.timezone,
          adminId,
          uniqueKey,
        ]
      );

      return { school: result.rows[0], created: true };
    }
  }

  /**
   * Find school by admin ID
   */
  static async findByAdmin(
    adminId: string,
    client?: PoolClient | Pool
  ): Promise<School | null> {
    const dbClient = client || pool;

    const result = await dbClient.query(
      "SELECT * FROM schools WHERE admin_id = $1",
      [adminId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find school by ID
   */
  static async findById(
    schoolId: string,
    client?: PoolClient
  ): Promise<School | null> {
    const dbClient = client || pool;

    const result = await dbClient.query("SELECT * FROM schools WHERE id = $1", [
      schoolId,
    ]);

    return result.rows[0] || null;
  }

  /**
   * Update additional programs
   */
  static async updatePrograms(
    adminId: string,
    programs: string[]
  ): Promise<School | null> {
    const cleanedPrograms = programs
      .map((p) => (typeof p === "string" ? p.trim() : ""))
      .filter((p) => p.length > 0);

    const result = await pool.query(
      `UPDATE schools
       SET additional_programs = $1,
           updated_at = NOW()
       WHERE admin_id = $2
       RETURNING *`,
      [JSON.stringify(cleanedPrograms), adminId]
    );

    return result.rows[0] || null;
  }

  /**
   * Update onboarding step completion flags
   */
  static async updateStepCompletion(
    adminId: string,
    step: "teachers" | "students" | "complete",
    completed: boolean
  ): Promise<School | null> {
    let updateField: string;

    switch (step) {
      case "teachers":
        updateField = "teachers_uploaded";
        break;
      case "students":
        updateField = "students_uploaded";
        break;
      case "complete":
        updateField = "onboarding_completed";
        break;
      default:
        return null;
    }

    const result = await pool.query(
      `UPDATE schools
       SET ${updateField} = $1,
           updated_at = NOW()
       WHERE admin_id = $2
       RETURNING *`,
      [completed, adminId]
    );

    return result.rows[0] || null;
  }

  /**
   * Set teachers uploaded flag
   */
  static async setTeachersUploaded(
    schoolId: string,
    client?: PoolClient
  ): Promise<void> {
    const dbClient = client || pool;

    await dbClient.query(
      `UPDATE schools
       SET teachers_uploaded = true,
           updated_at = NOW()
       WHERE id = $1`,
      [schoolId]
    );
  }

  /**
   * Set students uploaded flag
   */
  static async setStudentsUploaded(
    schoolId: string,
    client?: PoolClient
  ): Promise<void> {
    const dbClient = client || pool;

    await dbClient.query(
      `UPDATE schools
       SET students_uploaded = true,
           updated_at = NOW()
       WHERE id = $1`,
      [schoolId]
    );
  }

  /**
   * Save teacher file upload information
   */
  static async saveTeacherUpload(
    schoolId: string,
    fileName: string,
    summary: UploadSummary,
    client?: PoolClient
  ): Promise<School | null> {
    const dbClient = client || pool;

    const result = await dbClient.query(
      `UPDATE schools
       SET teacher_file_name = $1,
           teacher_upload_date = NOW(),
           teacher_upload_summary = $2,
           teachers_uploaded = true,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [fileName, JSON.stringify(summary), schoolId]
    );

    return result.rows[0] || null;
  }

  /**
   * Save student file upload information
   */
  static async saveStudentUpload(
    schoolId: string,
    fileName: string,
    summary: UploadSummary,
    client?: PoolClient
  ): Promise<School | null> {
    const dbClient = client || pool;

    const result = await dbClient.query(
      `UPDATE schools
       SET student_file_name = $1,
           student_upload_date = NOW(),
           student_upload_summary = $2,
           students_uploaded = true,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [fileName, JSON.stringify(summary), schoolId]
    );

    return result.rows[0] || null;
  }

  /**
   * Delete teacher file upload information
   */
  static async deleteTeacherUpload(
    adminId: string,
    client?: PoolClient
  ): Promise<School | null> {
    const dbClient = client || pool;

    const result = await dbClient.query(
      `UPDATE schools
       SET teacher_file_name = NULL,
           teacher_upload_date = NULL,
           teacher_upload_summary = NULL,
           teachers_uploaded = false,
           updated_at = NOW()
       WHERE admin_id = $1
       RETURNING *`,
      [adminId]
    );

    return result.rows[0] || null;
  }

  /**
   * Delete student file upload information
   */
  static async deleteStudentUpload(
    adminId: string,
    client?: PoolClient
  ): Promise<School | null> {
    const dbClient = client || pool;

    const result = await dbClient.query(
      `UPDATE schools
       SET student_file_name = NULL,
           student_upload_date = NULL,
           student_upload_summary = NULL,
           students_uploaded = false,
           updated_at = NOW()
       WHERE admin_id = $1
       RETURNING *`,
      [adminId]
    );

    return result.rows[0] || null;
  }

  /**
   * Sanitize school data for response (parse JSON fields)
   */
  static sanitizeSchool(school: School) {
    // Parse file upload summaries if they exist
    let teacherUploadInfo = null;
    if (school.teacher_file_name && school.teacher_upload_summary) {
      teacherUploadInfo = {
        fileName: school.teacher_file_name,
        uploadDate: school.teacher_upload_date?.toISOString() || "",
        summary:
          typeof school.teacher_upload_summary === "string"
            ? JSON.parse(school.teacher_upload_summary)
            : school.teacher_upload_summary,
      };
    }

    let studentUploadInfo = null;
    if (school.student_file_name && school.student_upload_summary) {
      studentUploadInfo = {
        fileName: school.student_file_name,
        uploadDate: school.student_upload_date?.toISOString() || "",
        summary:
          typeof school.student_upload_summary === "string"
            ? JSON.parse(school.student_upload_summary)
            : school.student_upload_summary,
      };
    }

    return {
      id: school.id,
      school_id: school.id,
      name: school.name,
      school_type: school.school_type,
      school_type_display: getSchoolTypeLabel(school.school_type),
      class_structure_type: school.class_structure_type,
      class_structure_display: getClassStructureLabel(
        school.class_structure_type
      ),
      additional_programs:
        typeof school.additional_programs === "string"
          ? JSON.parse(school.additional_programs)
          : school.additional_programs || [],
      timezone: school.timezone,
      onboarding_completed: school.onboarding_completed,
      teachers_uploaded: school.teachers_uploaded,
      students_uploaded: school.students_uploaded,

      teacher_upload_info: teacherUploadInfo,
      teacher_file_name: school.teacher_file_name,
      teacher_upload_date: school.teacher_upload_date,
      teacher_upload_summary: school.teacher_upload_summary,

      student_upload_info: studentUploadInfo,
      student_file_name: school.student_file_name,
      student_upload_date: school.student_upload_date,
      student_upload_summary: school.student_upload_summary,
      unique_key: school.unique_key,

      onboarding_progress: calculateOnboardingProgress(school),
      is_basic_info_complete: isBasicInfoComplete(school),
      created_at: school.created_at,
      updated_at: school.updated_at,
    };
  }

   static async findByUniqueKey(key: string) {
    const result = await pool.query(
      "SELECT * FROM schools WHERE unique_key = $1",
      [key]
    );
    return result.rows[0] || null;
  }
static async findByAccountId(accountId: string) {
  const result = await pool.query(
    `SELECT id, name FROM schools WHERE account_id = $1`,
    [accountId]
  );
  return result.rows[0] || null;
}

}
