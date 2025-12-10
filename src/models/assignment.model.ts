import { PoolClient } from "pg";
import { pool } from "../config/postgres.db.js";

export interface GradingCriterion {
  title: string;
  description?: string;
  points: number;
}

export interface Assignment {
  id: string;
  title: string;
  description?: string | null;
  class_id: string;
  created_by: string;
  school_id: string;
  assign_date?: Date | null;
  due_date?: Date | null;
  max_score: number;
  min_word_count?: number | null;
  word_count?: number | null;
  max_word_count?: number | null;
  page_count?: number | null;
  assignment_type?: string | null;
  citation_style?: string | null;
  allow_late_submission: boolean;
  status: "active" | "inactive";
  grading_criteria?: GradingCriterion[] | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAssignmentDTO {
  title: string;
  description?: string;
  class_id: string;
  created_by: string;
  school_id: string;
  assign_date?: Date | string;
  due_date?: Date | string;
  max_score?: number;
  min_word_count?: number;
  word_count?: number;
  max_word_count?: number;
  page_count?: number;
  assignment_type?: string;
  citation_style?: string;
  allow_late_submission?: boolean;
  status?: Assignment["status"];
  grading_criteria?: GradingCriterion[];
}

export interface UpdateAssignmentDTO {
  title?: string;
  description?: string;
  assign_date?: Date | string | null;
  due_date?: Date | string | null;
  max_score?: number;
  min_word_count?: number | null;
  word_count?: number | null;
  max_word_count?: number | null;
  page_count?: number | null;
  assignment_type?: string | null;
  citation_style?: string | null;
  allow_late_submission?: boolean;
  status?: Assignment["status"];
  grading_criteria?: GradingCriterion[] | null;
  class_id?: string;
  school_id?: string;
}

export class AssignmentModel {
  static async create(
    data: CreateAssignmentDTO,
    client?: PoolClient
  ): Promise<Assignment> {
    const db = client || pool;
    const result = await db.query(
      `INSERT INTO assignments (
        title, description, class_id, created_by, school_id,
        assign_date, due_date, max_score, min_word_count, word_count,
        max_word_count, page_count, assignment_type, citation_style,
        allow_late_submission, status, grading_criteria
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
      ) RETURNING *`,
      [
        data.title,
        data.description || null,
        data.class_id,
        data.created_by,
        data.school_id,
        data.assign_date ? new Date(data.assign_date) : null,
        data.due_date ? new Date(data.due_date) : null,
        data.max_score ?? 100,
        data.min_word_count ?? null,
        data.word_count ?? null,
        data.max_word_count ?? null,
        data.page_count ?? null,
        data.assignment_type ?? null,
        data.citation_style ?? null,
        data.allow_late_submission ?? false,
        data.status ?? "inactive",
        data.grading_criteria ? JSON.stringify(data.grading_criteria) : null,
      ]
    );

    return result.rows[0];
  }

  static async findById(id: string): Promise<Assignment | null> {
    const result = await pool.query("SELECT * FROM assignments WHERE id = $1", [
      id,
    ]);
    return result.rows[0] || null;
  }

  
    // Assignment List with filters & pagination
    // filtered by class_id, school_id, status, created_by, search (title)
  
  static async list(opts: {
    limit?: number;
    offset?: number;
    class_id?: string;
    school_id?: string;
    status?: string;
    created_by?: string;
    search?: string;
  }): Promise<{ rows: Assignment[]; total: number }> {
    const {
      limit = 20,
      offset = 0,
      class_id,
      school_id,
      status,
      created_by,
      search,
    } = opts;

    const where: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (class_id) {
      where.push(`class_id = $${idx++}`);
      values.push(class_id);
    }
    if (school_id) {
      where.push(`school_id = $${idx++}`);
      values.push(school_id);
    }
    if (status) {
      where.push(`status = $${idx++}`);
      values.push(status);
    }
    if (created_by) {
      where.push(`created_by = $${idx++}`);
      values.push(created_by);
    }
    if (search) {
      where.push(`title ILIKE $${idx++}`);
      values.push(`%${search}%`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countQuery = `SELECT COUNT(*)::int as total FROM assignments ${whereClause}`;
    const countResult = await pool.query(countQuery, values);
    const total = countResult.rows[0]?.total ?? 0;

    const listQuery = `
      SELECT * FROM assignments
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    values.push(limit, offset);

    const listResult = await pool.query(listQuery, values);

    return { rows: listResult.rows, total };
  }

  static async update(
    id: string,
    data: UpdateAssignmentDTO
  ): Promise<Assignment | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    Object.entries(data).forEach(([key, value]) => {
      
      if (value === undefined) return;
      fields.push(`${key} = $${idx++}`);
      if (key === "assign_date" || key === "due_date") {
        values.push(value ? new Date(value as any) : null);
      } else if (key === "grading_criteria") {
        values.push(value ? JSON.stringify(value) : null);
      } else {
        values.push(value);
      }
    });

    if (fields.length === 0) {
      return await AssignmentModel.findById(id);
    }
    fields.push(`updated_at = current_timestamp`);

    const query = `
      UPDATE assignments
      SET ${fields.join(", ")}
      WHERE id = $${idx}
      RETURNING *
    `;
    values.push(id);

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }


  
    // Hard delete(permanetly)
  
  static async hardDelete(id: string): Promise<boolean> {
    const result = await pool.query(`DELETE FROM assignments WHERE id = $1`, [
      id,
    ]);
    return (result.rowCount ?? 0) > 0;
  }
  //update the assignment status
  static async updateStatus(id: string, status: "active" | "inactive"): Promise<boolean> {
  const result = await pool.query(
    `
    UPDATE assignments
    SET status = $1
    WHERE id = $2
    RETURNING id
    `,
    [status, id]
  );
  return (result.rowCount ?? 0) > 0;
}

}
