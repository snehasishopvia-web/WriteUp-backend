import { Request, Response } from "express";
import {
  AssignmentModel,
  CreateAssignmentDTO,
  UpdateAssignmentDTO,
} from "../models/assignment.model.js";
import { pool } from "../config/postgres.db.js";
import { validateSubscriptionBySchoolId } from "../utils/subscription.utils.js";

function validateCreatePayload(body: any): {
  valid: boolean;
  message?: string;
} {
  if (!body) return { valid: false, message: "Missing request body" };
  if (!body.title || typeof body.title !== "string")
    return { valid: false, message: "title is required" };
  if (!body.class_id || typeof body.class_id !== "string")
    return { valid: false, message: "class_id is required" };
  if (!body.created_by || typeof body.created_by !== "string")
    return { valid: false, message: "created_by is required" };
  if (!body.school_id || typeof body.school_id !== "string")
    return { valid: false, message: "school_id is required" };
  return { valid: true };
}

export class AssignmentController {
  static async create(req: Request, res: Response): Promise<void> {
    const payload = req.body;
    const validation = validateCreatePayload(payload);
    if (!validation.valid) {
      res.status(400).json({ success: false, message: validation.message });
      return;
    }

    // Check if subscription is active
    const schoolId = payload.school_id || req.schoolId;
    if (schoolId) {
      try {
        await validateSubscriptionBySchoolId(schoolId);
      } catch (error: any) {
        res.status(error.statusCode || 403).json({
          success: false,
          message: error.message || "Subscription expired"
        });
        return;
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const dto: CreateAssignmentDTO = {
        title: String(payload.title),
        description: payload.description ?? null,
        class_id: String(payload.class_id),
        created_by: String(payload.created_by),
        school_id: String(payload.school_id),
        assign_date: payload.assign_date ?? null,
        due_date: payload.due_date ?? null,
        max_score: payload.max_score ?? 100,
        min_word_count: payload.min_word_count ?? null,
        word_count: payload.word_count ?? null,
        max_word_count: payload.max_word_count ?? null,
        page_count: payload.page_count ?? null,
        assignment_type: payload.assignment_type ?? null,
        citation_style: payload.citation_style ?? null,
        allow_late_submission: payload.allow_late_submission ?? false,
        status: payload.status ?? "active",
        grading_criteria: payload.grading_criteria ?? null,
      };

      const assignment = await AssignmentModel.create(dto, client);

      await client.query("COMMIT");

      res.status(201).json({ success: true, data: assignment });
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error("Error creating assignment:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        detail: error.detail,
        constraint: error.constraint,
        stack: error.stack,
      });
      res.status(500).json({
        success: false,
        message: "Failed to create assignment",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
        details: process.env.NODE_ENV === "development" ? error.detail : undefined,
      });
    } finally {
      client.release();
    }
  }

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const assignment = await AssignmentModel.findById(id as string);
      if (!assignment) {
        res
          .status(404)
          .json({ success: false, message: "Assignment not found" });
        return;
      }
      res.status(200).json({ success: true, data: assignment });
    } catch (error) {
      console.error("Error fetching assignment:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch assignment" });
    }
  }

  static async list(req: Request, res: Response): Promise<void> {
    try {
      const limit = Math.min(Number(req.query.limit ?? 20), 100);
      const page = Math.max(Number(req.query.page ?? 1), 1);
      const offset = (page - 1) * limit;

      const filters = {
        limit,
        offset,
        class_id: req.query.class_id as string | undefined,
        school_id: req.query.school_id as string | undefined,
        status: req.query.status as string | undefined,
        created_by: req.query.created_by as string | undefined,
        search: req.query.search as string | undefined,
      };

      const { rows, total } = await AssignmentModel.list(filters);

      res.status(200).json({
        success: true,
        data: rows,
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error listing assignments:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to list assignments" });
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const body: UpdateAssignmentDTO = req.body;

      const existing = await AssignmentModel.findById(id as string);
      if (!existing) {
        res
          .status(404)
          .json({ success: false, message: "Assignment not found" });
        return;
      }

      const updated = await AssignmentModel.update(id as string, body);
      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("Error updating assignment:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to update assignment" });
    }
  }

  static async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const existing = await AssignmentModel.findById(id as string);
      if (!existing) {
        res
          .status(404)
          .json({ success: false, message: "Assignment not found" });
        return;
      }

      // if the status is inactive then delete permanently
      if (existing.status === "inactive") {
        const deleted = await AssignmentModel.hardDelete(id as string);
        if (deleted) {
          res.status(200).json({
            success: true,
            message: "Assignment permanently deleted",
          });
        } else {
          res.status(500).json({
            success: false,
            message: "Failed to permanently delete assignment",
          });
        }
        return;
      }

      //if stutus active then soft delete means updated the status first
      await AssignmentModel.updateStatus(id as string, "inactive");
      res.status(200).json({
        success: true,
        message: "Assignment marked inactive successfully",
      });
    } catch (error) {
      console.error("Error deleting assignment:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete assignment",
      });
    }
  }

  static async listActive(req: Request, res: Response): Promise<void> {
    try {
      const limit = Math.min(Number(req.query.limit ?? 20), 100);
      const page = Math.max(Number(req.query.page ?? 1), 1);
      const offset = (page - 1) * limit;

      const filters = {
        limit,
        offset,
        class_id: req.query.class_id as string | undefined,
        school_id: req.query.school_id as string | undefined,
        created_by: req.query.created_by as string | undefined,
        search: req.query.search as string | undefined,
        status: "active",
      };

      const { rows, total } = await AssignmentModel.list(filters);

      res.status(200).json({
        success: true,
        data: rows,
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error listing active assignments:", error);
      res.status(500).json({
        success: false,
        message: "Failed to list active assignments",
      });
    }
  }

  static async listByClass(req: Request, res: Response): Promise<void> {
    try {
      const { class_id } = req.params;
      if (!class_id) {
        res.status(400).json({ success: false, message: "class_id is required" });
        return;
      }

      const limit = Math.min(Number(req.query.limit ?? 20), 100);
      const page = Math.max(Number(req.query.page ?? 1), 1);
      const offset = (page - 1) * limit;

      const { rows, total } = await AssignmentModel.list({
        class_id,
        limit,
        offset,
      });

      res.status(200).json({
        success: true,
        data: rows,
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error listing assignments by class:", error);
      res.status(500).json({
        success: false,
        message: "Failed to list assignments by class",
      });
    }
  }

  /**
  * Get assignments for the authenticated student
  * Fetches active assignments from classes the student is enrolled in
  */
  static async listForStudent(req: Request, res: Response): Promise<void> {
    const client = await pool.connect();

    try {
      // Get authenticated user context
      const studentId = req.user?.id;
      const schoolId = req.schoolId;

      if (!studentId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      if (!schoolId) {
        res.status(403).json({
          success: false,
          message: "School context is required",
        });
        return;
      }

      // Parse pagination parameters
      const limit = Math.min(Number(req.query.limit ?? 20), 100);
      const page = Math.max(Number(req.query.page ?? 1), 1);
      const offset = (page - 1) * limit;
      const search = req.query.search as string | undefined;

      // Build WHERE clause for search
      const searchCondition = search
        ? `AND a.title ILIKE $4`
        : "";
      const searchParams = search ? [`%${search}%`] : [];

      // Get total count of assignments for student's classes
      const countQuery = `
        SELECT COUNT(DISTINCT a.id)::int as total
        FROM assignments a
        INNER JOIN class_members cm ON a.class_id = cm.class_id
        WHERE cm.user_id = $1
          AND a.school_id = $2
          AND a.status = 'active'
          AND cm.status = 'active'
          ${searchCondition}
      `;

      const countResult = await client.query(
        countQuery,
        [studentId, schoolId, ...searchParams]
      );
      const total = countResult.rows[0]?.total ?? 0;

      // Get paginated assignments
      const listQuery = `
        SELECT DISTINCT
          a.id,
          a.title,
          a.description,
          a.class_id,
          a.due_date,
          a.assign_date,
          a.max_score,
          a.min_word_count,
          a.max_word_count,
          a.page_count,
          a.assignment_type,
          a.citation_style,
          a.created_at
        FROM assignments a
        INNER JOIN class_members cm ON a.class_id = cm.class_id
        WHERE cm.user_id = $1
          AND a.school_id = $2
          AND a.status = 'active'
          AND cm.status = 'active'
          ${searchCondition}
        ORDER BY a.created_at DESC
        LIMIT $${searchParams.length + 3} OFFSET $${searchParams.length + 4}
      `;

      const listResult = await client.query(
        listQuery,
        [studentId, schoolId, ...searchParams, limit, offset]
      );

      res.status(200).json({
        success: true,
        data: listResult.rows,
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error listing student assignments:", error);
      res.status(500).json({
        success: false,
        message: "Failed to list student assignments",
      });
    } finally {
      client.release();
    }
  }
}
