import { Request, Response } from 'express';
import { pool } from '../config/postgres.db.js';
import type {
  SubmissionRow,
  CreateSubmissionDTO,
  UpdateSubmissionDTO,
  SubmissionResponse,
  SubmissionStatus,
} from '../types/submission.types.js';

/**
 * Transform database row to API response format
 */
const transformSubmissionForResponse = (row: SubmissionRow): SubmissionResponse => {
  return {
    id: row.id,
    schoolId: row.school_id,
    classId: row.class_id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    documentId: row.document_id,
    content: row.content,
    status: row.status,
    submittedAt: row.submitted_at,
    score: row.score,
    feedback: row.feedback,
    gradedBy: row.graded_by,
    gradedAt: row.graded_at,
    wordCount: row.word_count,
    pageCount: row.page_count,
    submissionMetadata: row.submission_metadata,
    isLate: row.is_late,
    version: row.version,
    previousSubmissionId: row.previous_submission_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export class SubmissionController {
  /**
   * CREATE /api/v1/submissions
   * Create a new submission
   */
  static async create(req: Request, res: Response): Promise<void> {
    const client = await pool.connect();

    try {
      const {
        class_id,
        assignment_id,
        student_id,
        document_id,
        content,
        status,
        word_count,
        page_count,
        submission_metadata,
        is_late,
      } = req.body as Partial<CreateSubmissionDTO>;

      // Get school_id from authenticated request (multi-tenant)
      const schoolId = req.schoolId;

      if (!schoolId) {
        res.status(403).json({
          success: false,
          message: 'School context is required',
        });
        return;
      }

      // Validate required fields
      if (!class_id || !assignment_id || !student_id) {
        res.status(400).json({
          success: false,
          message: 'class_id, assignment_id, and student_id are required',
        });
        return;
      }

      // Begin transaction
      await client.query('BEGIN');

      // Determine final status and submitted_at
      const finalStatus = status || 'draft';
      let submittedAt = null;

      // If status is NOT draft, set submitted_at to current timestamp
      if (finalStatus !== 'draft') {
        submittedAt = new Date();
      }

      // Insert submission
      const insertQuery = `
        INSERT INTO submissions (
          school_id,
          class_id,
          assignment_id,
          student_id,
          document_id,
          content,
          status,
          submitted_at,
          word_count,
          page_count,
          submission_metadata,
          is_late
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *;
      `;

      const values = [
        schoolId,
        class_id,
        assignment_id,
        student_id,
        document_id || null,
        content || null,
        finalStatus,
        submittedAt,
        word_count || null,
        page_count || null,
        submission_metadata ? JSON.stringify(submission_metadata) : null,
        is_late || false,
      ];

      const result = await client.query(insertQuery, values);
      const submission = transformSubmissionForResponse(result.rows[0]);

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: 'Submission created successfully',
        data: submission,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating submission:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create submission',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      client.release();
    }
  }

  /**
   * PUT /api/v1/submissions/:id
   * Update an existing submission
   */
  static async update(req: Request, res: Response): Promise<void> {
    const client = await pool.connect();

    try {
      const { id } = req.params;
      const schoolId = req.schoolId;
      const userId = (req as any).user?.userId || (req as any).user?.id;

      if (!schoolId) {
        res.status(403).json({
          success: false,
          message: 'School context is required',
        });
        return;
      }

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      // First, check if submission exists and belongs to the school
      const checkQuery = 'SELECT * FROM submissions WHERE id = $1 AND school_id = $2';
      const checkResult = await client.query(checkQuery, [id, schoolId]);

      if (checkResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Submission not found or you do not have permission to edit it',
        });
        return;
      }

      const existingSubmission = checkResult.rows[0] as SubmissionRow;
      const {
        content,
        status,
        score,
        feedback,
        graded_by,
        graded_at,
        word_count,
        page_count,
        submission_metadata,
        is_late,
      } = req.body as UpdateSubmissionDTO;

      // Build update query dynamically
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (content !== undefined) {
        updates.push(`content = $${paramCount++}`);
        values.push(content);
      }

      if (status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        values.push(status);

        // If changing to submitted and submitted_at is null, it will be set by trigger
        // If changing to graded, set graded_at if not provided
        if (status === 'graded' && !graded_at && existingSubmission.status !== 'graded') {
          updates.push(`graded_at = $${paramCount++}`);
          values.push(new Date());

          if (!graded_by) {
            updates.push(`graded_by = $${paramCount++}`);
            values.push(userId);
          }
        }
      }

      if (score !== undefined) {
        updates.push(`score = $${paramCount++}`);
        values.push(score);
      }

      if (feedback !== undefined) {
        updates.push(`feedback = $${paramCount++}`);
        values.push(feedback);
      }

      if (graded_by !== undefined) {
        updates.push(`graded_by = $${paramCount++}`);
        values.push(graded_by);
      }

      if (graded_at !== undefined) {
        updates.push(`graded_at = $${paramCount++}`);
        values.push(graded_at);
      }

      if (word_count !== undefined) {
        updates.push(`word_count = $${paramCount++}`);
        values.push(word_count);
      }

      if (page_count !== undefined) {
        updates.push(`page_count = $${paramCount++}`);
        values.push(page_count);
      }

      if (submission_metadata !== undefined) {
        updates.push(`submission_metadata = $${paramCount++}`);
        values.push(JSON.stringify(submission_metadata));
      }

      if (is_late !== undefined) {
        updates.push(`is_late = $${paramCount++}`);
        values.push(is_late);
      }

      if (updates.length === 0) {
        res.status(400).json({
          success: false,
          message: 'No fields to update',
        });
        return;
      }

      // Add id to values
      values.push(id);

      const updateQuery = `
        UPDATE submissions
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *;
      `;

      const result = await client.query(updateQuery, values);
      const submission = transformSubmissionForResponse(result.rows[0]);

      res.json({
        success: true,
        message: 'Submission updated successfully',
        data: submission,
      });
    } catch (error) {
      console.error('Error updating submission:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update submission',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      client.release();
    }
  }

  /**
   * DELETE /api/v1/submissions/:id
   * Delete a submission
   */
  static async delete(req: Request, res: Response): Promise<void> {
    const client = await pool.connect();

    try {
      const { id } = req.params;
      const schoolId = req.schoolId;
      const userId = (req as any).user?.userId || (req as any).user?.id;

      if (!schoolId) {
        res.status(403).json({
          success: false,
          message: 'School context is required',
        });
        return;
      }

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      // Check if submission exists and belongs to the school
      const checkQuery = 'SELECT * FROM submissions WHERE id = $1 AND school_id = $2';
      const checkResult = await client.query(checkQuery, [id, schoolId]);

      if (checkResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Submission not found or you do not have permission to delete it',
        });
        return;
      }

      // Delete the submission
      const deleteQuery = 'DELETE FROM submissions WHERE id = $1 AND school_id = $2 RETURNING id';
      const result = await client.query(deleteQuery, [id, schoolId]);

      res.json({
        success: true,
        message: 'Submission deleted successfully',
        data: { id: result.rows[0].id },
      });
    } catch (error) {
      console.error('Error deleting submission:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete submission',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      client.release();
    }
  }

  /**
   * GET /api/v1/submissions
   * List submissions with filters
   * Supports filtering by: class_id, student_id, assignment_id (+ school_id from auth)
   */
  static async list(req: Request, res: Response): Promise<void> {
    const client = await pool.connect();

    try {
      const schoolId = req.schoolId;

      if (!schoolId) {
        res.status(403).json({
          success: false,
          message: 'School context is required',
        });
        return;
      }

      const {
        class_id,
        student_id,
        assignment_id,
        status,
        limit = '50',
        offset = '0',
      } = req.query;

      // Build query dynamically based on filters
      const conditions: string[] = ['school_id = $1'];
      const values: any[] = [schoolId];
      let paramCount = 2;

      if (class_id) {
        conditions.push(`class_id = $${paramCount++}`);
        values.push(class_id);
      }

      if (student_id) {
        conditions.push(`student_id = $${paramCount++}`);
        values.push(student_id);
      }

      if (assignment_id) {
        conditions.push(`assignment_id = $${paramCount++}`);
        values.push(assignment_id);
      }

      if (status) {
        conditions.push(`status = $${paramCount++}`);
        values.push(status);
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM submissions WHERE ${whereClause}`;
      const countResult = await client.query(countQuery, values);
      const totalCount = parseInt(countResult.rows[0].count);

      // Get submissions with pagination
      const listQuery = `
        SELECT * FROM submissions
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramCount++}
        OFFSET $${paramCount++};
      `;

      values.push(parseInt(limit as string));
      values.push(parseInt(offset as string));

      const result = await client.query(listQuery, values);
      const submissions = result.rows.map((row) => transformSubmissionForResponse(row));

      res.json({
        success: true,
        message: 'Submissions retrieved successfully',
        data: submissions,
        count: submissions.length,
        total: totalCount,
      });
    } catch (error) {
      console.error('Error listing submissions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve submissions',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      client.release();
    }
  }

  /**
   * GET /api/v1/submissions/:id
   * Get a single submission by ID
   */
  static async getById(req: Request, res: Response): Promise<void> {
    const client = await pool.connect();

    try {
      const { id } = req.params;
      const schoolId = req.schoolId;

      if (!schoolId) {
        res.status(403).json({
          success: false,
          message: 'School context is required',
        });
        return;
      }

      const query = 'SELECT * FROM submissions WHERE id = $1 AND school_id = $2';
      const result = await client.query(query, [id, schoolId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Submission not found',
        });
        return;
      }

      const submission = transformSubmissionForResponse(result.rows[0]);

      res.json({
        success: true,
        message: 'Submission retrieved successfully',
        data: submission,
      });
    } catch (error) {
      console.error('Error fetching submission:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve submission',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      client.release();
    }
  }

  /**
   * GET /api/v1/submissions/by-class-assignment
   * Get all students in a class with their latest submission for an assignment
   * Used in AssignmentView to display student submissions
   * Query params: class_id, assignment_id
   */
  static async getByClassAndAssignment(req: Request, res: Response): Promise<void> {
    const client = await pool.connect();

    try {
      const { class_id: classId, assignment_id: assignmentId } = req.query;
      const schoolId = req.schoolId;

      if (!schoolId) {
        res.status(403).json({
          success: false,
          message: 'School context is required',
        });
        return;
      }

      if (!classId || !assignmentId) {
        res.status(400).json({
          success: false,
          message: 'class_id and assignment_id query parameters are required',
        });
        return;
      }

      // Query to get all students in the class with their latest submission
      // Join through: class_members -> classes -> departments to get school_id
      const query = `
        SELECT
          u.id as student_id,
          u.first_name,
          u.last_name,
          u.first_name || ' ' || u.last_name as student_name,
          s.id as submission_id,
          s.status,
          s.submitted_at,
          s.score,
          s.is_late,
          s.submission_metadata
        FROM class_members cm
        INNER JOIN classes c ON cm.class_id = c.id
        INNER JOIN departments d ON c.department_id = d.id
        INNER JOIN users u ON cm.user_id = u.id
        LEFT JOIN LATERAL (
          SELECT * FROM submissions
          WHERE student_id = u.id
            AND assignment_id = $1
            AND school_id = $2
          ORDER BY created_at DESC
          LIMIT 1
        ) s ON true
        WHERE cm.class_id = $3
          AND d.school_id = $2
          AND u.user_type = 'student'
        ORDER BY u.last_name, u.first_name;
      `;

      const result = await client.query(query, [assignmentId, schoolId, classId]);

      // Transform to match frontend structure
      const submissions = result.rows.map((row) => {
        // Determine status for frontend
        let status: 'graded' | 'in-progress' | 'unopened' | 'not-submitted';
        let turnInStatus: 'on-time' | 'late' | 'not-submitted';

        if (!row.submission_id) {
          // No submission row exists
          status = 'unopened';
          turnInStatus = 'not-submitted';
        } else if (row.status === 'draft') {
          status = 'in-progress';
          turnInStatus = 'not-submitted';
        } else if (row.status === 'submitted') {
          status = 'unopened'; // Teacher hasn't opened yet
          turnInStatus = row.is_late ? 'late' : 'on-time';
        } else if (row.status === 'under_review') {
          status = 'in-progress';
          turnInStatus = row.is_late ? 'late' : 'on-time';
        } else if (row.status === 'graded' || row.status === 'returned') {
          status = 'graded';
          turnInStatus = row.is_late ? 'late' : 'on-time';
        } else if (row.status === 'resubmitted') {
          status = 'in-progress';
          turnInStatus = row.is_late ? 'late' : 'on-time';
        } else {
          status = 'unopened';
          turnInStatus = 'not-submitted';
        }

        // Extract time spent from metadata
        let timeSpentWriting = '-';
        if (row.submission_metadata) {
          const metadata = typeof row.submission_metadata === 'string'
            ? JSON.parse(row.submission_metadata)
            : row.submission_metadata;

          if (metadata.timeSpentWriting) {
            timeSpentWriting = metadata.timeSpentWriting;
          }
        }

        // Format turned_in date
        let turnedIn: string | null = null;
        if (row.submitted_at) {
          turnedIn = new Date(row.submitted_at).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
        }

        return {
          id: row.submission_id || null,
          student_id: row.student_id,
          student_name: row.student_name,
          turned_in: turnedIn,
          turn_in_status: turnInStatus,
          time_spent_writing: timeSpentWriting,
          grade: row.score !== null ? row.score : undefined,
          status,
        };
      });

      res.json({
        success: true,
        message: 'Student submissions retrieved successfully',
        data: submissions,
      });
    } catch (error) {
      console.error('Error fetching class assignment submissions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve student submissions',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      client.release();
    }
  }

  /**
   * Save grade as draft (status: under_review, graded_at: null)
   * PUT /api/submissions/:id/grade/draft
   */
  static async saveDraftGrade(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { score, feedback } = req.body;
    const teacherId = req.user?.id; // From auth middleware
    const schoolId = req.schoolId;

    const client = await pool.connect();

    try {
      // Get existing submission
      const submissionQuery = `
        SELECT * FROM submissions
        WHERE id = $1 AND school_id = $2
      `;
      const submissionResult = await client.query(submissionQuery, [id, schoolId]);

      if (submissionResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Submission not found',
        });
        return;
      }

      const existingSubmission = submissionResult.rows[0];

      // Check if grade is already submitted (immutability check)
      if (existingSubmission.status === 'graded' && existingSubmission.graded_at !== null) {
        res.status(403).json({
          success: false,
          message: 'Cannot modify submitted grades. Grade has been finalized and released to student.',
        });
        return;
      }

      // Update submission with draft grade
      const updateQuery = `
        UPDATE submissions
        SET
          score = $1,
          feedback = $2,
          status = 'under_review',
          graded_by = $3,
          graded_at = NULL,
          updated_at = NOW()
        WHERE id = $4 AND school_id = $5
        RETURNING *
      `;

      const updateResult = await client.query(updateQuery, [
        score,
        feedback || null,
        teacherId,
        id,
        schoolId,
      ]);

      res.status(200).json({
        success: true,
        message: 'Draft grade saved successfully',
        data: updateResult.rows[0],
      });
    } catch (error) {
      console.error('Error saving draft grade:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to save draft grade',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      client.release();
    }
  }

  /**
   * Submit final grade (status: graded, graded_at: NOW())
   * PUT /api/submissions/:id/grade/submit
   */
  static async submitFinalGrade(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { score, feedback } = req.body;
    const teacherId = req.user?.id // req.userId; // From auth middleware
    const schoolId = req.schoolId;

    const client = await pool.connect();

    try {
      // Validate required fields
      if (score === undefined || score === null) {
        res.status(400).json({
          success: false,
          message: 'Score is required to submit a grade',
        });
        return;
      }

      // Get existing submission
      const submissionQuery = `
        SELECT * FROM submissions
        WHERE id = $1 AND school_id = $2
      `;
      const submissionResult = await client.query(submissionQuery, [id, schoolId]);

      if (submissionResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Submission not found',
        });
        return;
      }

      const existingSubmission = submissionResult.rows[0];

      // Check if grade is already submitted (immutability check)
      if (existingSubmission.status === 'graded' && existingSubmission.graded_at !== null) {
        res.status(403).json({
          success: false,
          message: 'Cannot modify submitted grades. Grade has been finalized and released to student.',
        });
        return;
      }

      // Update submission with final grade
      const updateQuery = `
        UPDATE submissions
        SET
          score = $1,
          feedback = $2,
          status = 'graded',
          graded_by = $3,
          graded_at = NOW(),
          updated_at = NOW()
        WHERE id = $4 AND school_id = $5
        RETURNING *
      `;

      const updateResult = await client.query(updateQuery, [
        score,
        feedback || null,
        teacherId,
        id,
        schoolId,
      ]);

      res.status(200).json({
        success: true,
        message: 'Grade submitted successfully. Student can now view the grade.',
        data: updateResult.rows[0],
      });
    } catch (error) {
      console.error('Error submitting final grade:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit final grade',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      client.release();
    }
  }

  /**
   * Get grade for a submission
   * GET /api/submissions/:id/grade
   */
  static async getGrade(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const schoolId = req.schoolId;

    const client = await pool.connect();

    try {
      const query = `
        SELECT
          id,
          score,
          feedback,
          status,
          graded_by,
          graded_at
        FROM submissions
        WHERE id = $1 AND school_id = $2
      `;

      const result = await client.query(query, [id, schoolId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Submission not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Grade retrieved successfully',
        data: result.rows[0],
      });
    } catch (error) {
      console.error('Error retrieving grade:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve grade',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      client.release();
    }
  }
}
