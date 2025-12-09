import { pool } from "@/config/postgres.db";
import { QueryResult, PoolClient } from "pg";
import {
  Department,
  CreateDepartmentDTO,
  UpdateDepartmentDTO,
} from "../types/department.types.js";

export class DepartmentModel {
  /**
   * Find all departments for a school
   */
  static async findAll(
    schoolId: string,
    activeOnly = true
  ): Promise<Department[]> {
    const query = activeOnly
      ? "SELECT * FROM departments WHERE school_id = $1 AND is_active = true ORDER BY name"
      : "SELECT * FROM departments WHERE school_id = $1 ORDER BY name";

    const result: QueryResult<Department> = await pool.query(query, [schoolId]);
    return result.rows;
  }

  /**
   * Find department by ID
   */
  static async findById(
    id: string,
    schoolId?: string
  ): Promise<Department | null> {
    let query = "SELECT * FROM departments WHERE id = $1";
    const params: string[] = [id];

    if (schoolId) {
      query += " AND school_id = $2";
      params.push(schoolId);
    }

    const result: QueryResult<Department> = await pool.query(query, params);
    return result.rows[0] || null;
  }

  /**
   * Find department by code
   */
  static async findByCode(
    code: string,
    schoolId: string
  ): Promise<Department | null> {
    const result: QueryResult<Department> = await pool.query(
      "SELECT * FROM departments WHERE school_id = $1 AND code = $2",
      [schoolId, code]
    );
    return result.rows[0] || null;
  }

  /**
   * Create new department
   */
  static async create(
    schoolId: string,
    data: CreateDepartmentDTO,
    client?: PoolClient
  ): Promise<Department> {
    const dbClient = client || pool;

    const code =
      data.code ||
      data.name.substring(0, 20).toUpperCase().replace(/\s+/g, "_");

    const result: QueryResult<Department> = await dbClient.query(
      `INSERT INTO departments (
        school_id, name, code, description, head_id
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        schoolId,
        data.name,
        code,
        data.description || null,
        data.head_id || null,
      ]
    );

    if (!result.rows[0]) throw new Error("Failed to create department");

    return result.rows[0];
  }

  /**
   * Update department
   */
  static async update(
    id: string,
    schoolId: string,
    data: UpdateDepartmentDTO
  ): Promise<Department | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(data.name);
    }

    if (data.code !== undefined) {
      fields.push(`code = $${paramCount++}`);
      values.push(data.code);
    }

    if (data.description !== undefined) {
      fields.push(`description = $${paramCount++}`);
      values.push(data.description);
    }

    if (data.head_id !== undefined) {
      fields.push(`head_id = $${paramCount++}`);
      values.push(data.head_id);
    }

    if (data.is_active !== undefined) {
      fields.push(`is_active = $${paramCount++}`);
      values.push(data.is_active);
    }

    if (fields.length === 0) return await this.findById(id, schoolId);

    fields.push(`updated_at = NOW()`);
    values.push(id, schoolId);

    const query = `
      UPDATE departments
      SET ${fields.join(", ")}
      WHERE id = $${paramCount++} AND school_id = $${paramCount++}
      RETURNING *
    `;

    const result: QueryResult<Department> = await pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete department (soft delete)
   */
  static async delete(id: string, schoolId: string): Promise<boolean> {
    const result = await pool.query(
      "UPDATE departments SET is_active = false, updated_at = NOW() WHERE id = $1 AND school_id = $2",
      [id, schoolId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Hard delete department
   */
  static async hardDelete(id: string, schoolId: string): Promise<boolean> {
    const result = await pool.query(
      "DELETE FROM departments WHERE id = $1 AND school_id = $2",
      [id, schoolId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Bulk sync departments for a school
   * Deletes departments not in the provided list and creates new ones
   */
  static async syncDepartments(
    schoolId: string,
    departmentNames: string[]
  ): Promise<{ created: Department[]; deleted: number }> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Get all existing departments for this school //
      const existingResult: QueryResult<Department> = await client.query(
        "SELECT * FROM departments WHERE school_id = $1 AND is_active = true",
        [schoolId]
      );
      const existingDepartments = existingResult.rows;

      // Normalize department names for comparison (trim and lowercase)
      const normalizedNames = departmentNames.map((name) =>
        name.trim().toLowerCase()
      );
      const existingNames = existingDepartments.map((dept) =>
        dept.name.toLowerCase()
      );

      // Find departments to delete (exist in DB but not in payload)
      const toDelete = existingDepartments.filter(
        (dept) => !normalizedNames.includes(dept.name.toLowerCase())
      );

      // Find departments to create (in payload but not in DB)
      const toCreate = departmentNames.filter(
        (name) => !existingNames.includes(name.trim().toLowerCase())
      );

      let deletedCount = 0;
      const createdDepartments: Department[] = [];

      // Delete departments not in the list (soft delete)
      if (toDelete.length > 0) {
        const deleteIds = toDelete.map((dept) => dept.id);
        const deleteResult = await client.query(
          `UPDATE departments
           SET is_active = false, updated_at = NOW()
           WHERE id = ANY($1) AND school_id = $2`,
          [deleteIds, schoolId]
        );
        deletedCount = deleteResult.rowCount ?? 0;
      }

      // Create new departments
      for (const name of toCreate) {
        const trimmedName = name.trim();
        const code = trimmedName
          .substring(0, 20)
          .toUpperCase()
          .replace(/\s+/g, "_");

        const createResult: QueryResult<Department> = await client.query(
          `INSERT INTO departments (school_id, name, code)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [schoolId, trimmedName, code]
        );

        if (createResult.rows[0]) {
          createdDepartments.push(createResult.rows[0]);
        }
      }

      await client.query("COMMIT");

      return {
        created: createdDepartments,
        deleted: deletedCount,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
