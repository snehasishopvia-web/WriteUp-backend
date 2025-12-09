import { Request, Response } from "express";
import { pool } from "../config/postgres.db.js";
import {
  FeedbackType,
  CreateFeedbackDTO,
  UpdateFeedbackDTO,
  TeacherFeedbackRow,
  TeacherFeedbackResponse,
  FeedbackData,
} from "../types/teacher-feedback.types.js";

/**
 * Helper function to build feedback_data based on type
 */
const buildFeedbackData = (type: FeedbackType, body: any): FeedbackData => {
  switch (type) {
    case 'multi-line':
      return { selectedTextRanges: body.selectedTextRanges || [] };
    case 'multi-para':
      return { selectedParagraphs: body.selectedParagraphs || [] };
    case 'delete':
      return { deleteSelection: body.deleteSelection || null };
    case 'insert':
      return { insertPosition: body.insertPosition || null };
    case 'move':
      return { moveSelection: body.moveSelection || null };
    default:
      throw new Error(`Invalid feedback type: ${type}`);
  }
};

/**
 * Helper function to transform DB row to API response
 * Spreads feedback_data based on type for easier frontend consumption
 */
const transformFeedbackForResponse = (row: TeacherFeedbackRow): TeacherFeedbackResponse => {
  const base = {
    id: row.id,
    schoolId: row.school_id,
    teacherId: row.teacher_id,
    studentId: row.student_id,
    assignmentId: row.assignment_id,
    submissionId: row.submission_id,
    type: row.feedback_type,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  // Spread the feedback_data contents based on type
  const feedbackData = row.feedback_data || {};

  switch (row.feedback_type) {
    case 'multi-line':
      return { ...base, selectedTextRanges: (feedbackData as any).selectedTextRanges || [] };
    case 'multi-para':
      return { ...base, selectedParagraphs: (feedbackData as any).selectedParagraphs || [] };
    case 'delete':
      return { ...base, deleteSelection: (feedbackData as any).deleteSelection || null };
    case 'insert':
      return { ...base, insertPosition: (feedbackData as any).insertPosition || null };
    case 'move':
      return { ...base, moveSelection: (feedbackData as any).moveSelection || null };
    default:
      return base;
  }
};

/**
 * Validation helper for feedback_data
 */
const validateFeedbackData = (type: FeedbackType, data: FeedbackData): void => {
  switch (type) {
    case 'multi-line':
      if (!(data as any).selectedTextRanges || !Array.isArray((data as any).selectedTextRanges)) {
        throw new Error('multi-line feedback requires selectedTextRanges array');
      }
      break;
    case 'multi-para':
      if (!(data as any).selectedParagraphs || !Array.isArray((data as any).selectedParagraphs)) {
        throw new Error('multi-para feedback requires selectedParagraphs array');
      }
      break;
    case 'delete':
      if (!(data as any).deleteSelection) {
        throw new Error('delete feedback requires deleteSelection object');
      }
      break;
    case 'insert':
      if (!(data as any).insertPosition) {
        throw new Error('insert feedback requires insertPosition object');
      }
      break;
    case 'move':
      if (!(data as any).moveSelection) {
        throw new Error('move feedback requires moveSelection object');
      }
      break;
  }
};

export class TeacherFeedbackController {
  /**
   * POST /api/v1/teacher-feedbacks
   * Create a new feedback instance
   */
  static async create(req: Request, res: Response): Promise<void> {
    const client = await pool.connect();

    try {
      const {
        assignmentId,
        submissionId,
        studentId,
        type,
        title,
        description,
      } = req.body as CreateFeedbackDTO;

      // Validate required fields
      if (!assignmentId || !submissionId || !studentId || !type || !title || !description) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields',
          required: ['assignmentId', 'submissionId', 'studentId', 'type', 'title', 'description']
        });
        return;
      }

      // Validate feedback type
      const validTypes: FeedbackType[] = ['multi-line', 'multi-para', 'delete', 'insert', 'move'];
      if (!validTypes.includes(type)) {
        res.status(400).json({
          success: false,
          message: 'Invalid feedback type',
          validTypes
        });
        return;
      }

      // Build feedback_data based on type
      const feedbackData = buildFeedbackData(type, req.body);

      // Validate feedback_data
      try {
        validateFeedbackData(type, feedbackData);
      } catch (validationError: any) {
        res.status(400).json({
          success: false,
          message: validationError.message
        });
        return;
      }

      // Get teacher_id and school_id from authenticated user
      const teacherId = (req as any).user?.userId || (req as any).user?.id;
      const schoolId = req.schoolId;

      if (!teacherId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      if (!schoolId) {
        res.status(403).json({
          success: false,
          message: 'School context is required'
        });
        return;
      }

      // Insert into database
      const query = `
        INSERT INTO teacher_feedbacks (
          school_id,
          teacher_id,
          student_id,
          assignment_id,
          submission_id,
          feedback_type,
          title,
          description,
          feedback_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *;
      `;

      const values = [
        schoolId,
        teacherId,
        studentId,
        assignmentId,
        submissionId,
        type,
        title,
        description,
        JSON.stringify(feedbackData)
      ];

      const result = await client.query(query, values);
      const feedback = transformFeedbackForResponse(result.rows[0]);

      res.status(201).json({
        success: true,
        message: 'Feedback created successfully',
        data: feedback
      });

    } catch (error) {
      console.error('Error creating feedback:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create feedback',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      client.release();
    }
  }

  /**
   * PUT /api/v1/teacher-feedbacks/:id
   * Update an existing feedback instance
   */
  static async update(req: Request, res: Response): Promise<void> {
    const client = await pool.connect();

    try {
      const { id } = req.params;
      const teacherId = (req as any).user?.userId || (req as any).user?.id;
      const schoolId = req.schoolId;

      if (!teacherId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      if (!schoolId) {
        res.status(403).json({
          success: false,
          message: 'School context is required'
        });
        return;
      }

      // First, check if feedback exists and belongs to the teacher + school
      const checkQuery = 'SELECT * FROM teacher_feedbacks WHERE id = $1 AND teacher_id = $2 AND school_id = $3';
      const checkResult = await client.query(checkQuery, [id, teacherId, schoolId]);

      if (checkResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Feedback not found or you do not have permission to edit it'
        });
        return;
      }

      const existingFeedback = checkResult.rows[0];
      const {
        title,
        description,
        // Type-specific fields
        selectedTextRanges,
        selectedParagraphs,
        deleteSelection,
        insertPosition,
        moveSelection,
      } = req.body as UpdateFeedbackDTO;

      // Build update query dynamically
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (title !== undefined) {
        updates.push(`title = $${paramCount++}`);
        values.push(title);
      }

      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(description);
      }

      // Update feedback_data if any type-specific fields are provided
      const hasTypeSpecificUpdate =
        selectedTextRanges !== undefined ||
        selectedParagraphs !== undefined ||
        deleteSelection !== undefined ||
        insertPosition !== undefined ||
        moveSelection !== undefined;

      if (hasTypeSpecificUpdate) {
        const feedbackData = buildFeedbackData(existingFeedback.feedback_type, req.body);

        try {
          validateFeedbackData(existingFeedback.feedback_type, feedbackData);
        } catch (validationError: any) {
          res.status(400).json({
            success: false,
            message: validationError.message
          });
          return;
        }

        updates.push(`feedback_data = $${paramCount++}`);
        values.push(JSON.stringify(feedbackData));
      }

      if (updates.length === 0) {
        res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
        return;
      }

      // Add id to values
      values.push(id);

      const updateQuery = `
        UPDATE teacher_feedbacks
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *;
      `;

      const result = await client.query(updateQuery, values);
      const feedback = transformFeedbackForResponse(result.rows[0]);

      res.json({
        success: true,
        message: 'Feedback updated successfully',
        data: feedback
      });

    } catch (error) {
      console.error('Error updating feedback:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update feedback',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      client.release();
    }
  }

  /**
   * DELETE /api/v1/teacher-feedbacks/:id
   * Delete a feedback instance
   */
  static async delete(req: Request, res: Response): Promise<void> {
    const client = await pool.connect();

    try {
      const { id } = req.params;
      const teacherId = (req as any).user?.userId || (req as any).user?.id;
      const schoolId = req.schoolId;

      if (!teacherId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      if (!schoolId) {
        res.status(403).json({
          success: false,
          message: 'School context is required'
        });
        return;
      }

      // Delete only if feedback belongs to the teacher + school
      const query = 'DELETE FROM teacher_feedbacks WHERE id = $1 AND teacher_id = $2 AND school_id = $3 RETURNING id';
      const result = await client.query(query, [id, teacherId, schoolId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Feedback not found or you do not have permission to delete it'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Feedback deleted successfully',
        data: { id: result.rows[0].id }
      });

    } catch (error) {
      console.error('Error deleting feedback:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete feedback',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      client.release();
    }
  }

  /**
   * GET /api/v1/teacher-feedbacks
   * Get all feedbacks matching filters
   */
  static async list(req: Request, res: Response): Promise<void> {
    const client = await pool.connect();

    try {
      const {
        assignmentId,
        submissionId,
        studentId,
        teacherId,
        type
      } = req.query;

      const authenticatedUserId = (req as any).user?.userId || (req as any).user?.id;
      const schoolId = req.schoolId;

      if (!schoolId) {
        res.status(403).json({
          success: false,
          message: 'School context is required'
        });
        return;
      }

      // Validate required query params
      if (!assignmentId || !submissionId || !studentId) {
        res.status(400).json({
          success: false,
          message: 'Missing required query parameters',
          required: ['assignmentId', 'submissionId', 'studentId']
        });
        return;
      }

      // Build query - always filter by school_id first
      const conditions = [
        'school_id = $1',
        'assignment_id = $2',
        'submission_id = $3',
        'student_id = $4'
      ];
      const values: any[] = [schoolId, assignmentId, submissionId, studentId];
      let paramCount = 5;

      // If teacherId is not provided, use authenticated user's ID
      const filterTeacherId = teacherId || authenticatedUserId;
      conditions.push(`teacher_id = $${paramCount++}`);
      values.push(filterTeacherId);

      // Optional type filter
      if (type) {
        const validTypes: FeedbackType[] = ['multi-line', 'multi-para', 'delete', 'insert', 'move'];
        if (!validTypes.includes(type as FeedbackType)) {
          res.status(400).json({
            success: false,
            message: 'Invalid feedback type',
            validTypes
          });
          return;
        }
        conditions.push(`feedback_type = $${paramCount++}`);
        values.push(type);
      }

      const query = `
        SELECT * FROM teacher_feedbacks
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC;
      `;

      const result = await client.query(query, values);
      const feedbacks = result.rows.map(transformFeedbackForResponse);

      res.json({
        success: true,
        count: feedbacks.length,
        data: feedbacks
      });

    } catch (error) {
      console.error('Error fetching feedbacks:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch feedbacks',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      client.release();
    }
  }

  /**
   * GET /api/v1/teacher-feedbacks/:id
   * Get a single feedback by ID
   */
  static async getById(req: Request, res: Response): Promise<void> {
    const client = await pool.connect();

    try {
      const { id } = req.params;
      const teacherId = (req as any).user?.userId || (req as any).user?.id;
      const schoolId = req.schoolId;

      if (!teacherId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      if (!schoolId) {
        res.status(403).json({
          success: false,
          message: 'School context is required'
        });
        return;
      }

      const query = 'SELECT * FROM teacher_feedbacks WHERE id = $1 AND teacher_id = $2 AND school_id = $3';
      const result = await client.query(query, [id, teacherId, schoolId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Feedback not found or you do not have permission to view it'
        });
        return;
      }

      const feedback = transformFeedbackForResponse(result.rows[0]);

      res.json({
        success: true,
        data: feedback
      });

    } catch (error) {
      console.error('Error fetching feedback:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch feedback',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      client.release();
    }
  }
}
