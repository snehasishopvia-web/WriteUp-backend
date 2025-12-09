import { Router } from 'express';
import { SubmissionController } from '../controllers/submission.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * POST /api/v1/submissions
 * Create a new submission
 * Required: class_id, assignment_id, student_id
 * Optional: content, document_id, status, word_count, page_count, submission_metadata, is_late
 */
router.post('/', SubmissionController.create);

/**
 * GET /api/v1/submissions/by-class-assignment
 * Get all students in a class with their latest submission for an assignment
 * Used in AssignmentView to display student submissions
 * Query params: class_id, assignment_id
 * IMPORTANT: This must come before other GET routes to avoid route conflicts
 */
router.get('/by-class-assignment', SubmissionController.getByClassAndAssignment);

/**
 * GET /api/v1/submissions
 * List submissions with filters
 * Query params: class_id, student_id, assignment_id, status, limit, offset
 * All filtered by school_id from auth middleware
 */
router.get('/', SubmissionController.list);

/**
 * GET /api/v1/submissions/:id
 * Get a single submission by ID
 * Validates school_id for multi-tenant security
 */
router.get('/:id', SubmissionController.getById);

/**
 * PUT /api/v1/submissions/:id
 * Update an existing submission
 * Can update: content, status, score, feedback, graded_by, graded_at,
 *             word_count, page_count, submission_metadata, is_late
 */
router.put('/:id', SubmissionController.update);

/**
 * DELETE /api/v1/submissions/:id
 * Delete a submission
 * Validates school_id for multi-tenant security
 */
router.delete('/:id', SubmissionController.delete);

/**
 * GET /api/v1/submissions/:id/grade
 * Get grade for a specific submission
 * Returns: score, feedback, status, graded_by, graded_at
 */
router.get('/:id/grade', SubmissionController.getGrade);

/**
 * PUT /api/v1/submissions/:id/grade/draft
 * Save grade as draft (status: under_review, graded_at: null)
 * Body: { score, feedback }
 * Teacher can edit draft grades multiple times
 */
router.put('/:id/grade/draft', SubmissionController.saveDraftGrade);

/**
 * PUT /api/v1/submissions/:id/grade/submit
 * Submit final grade (status: graded, graded_at: NOW())
 * Body: { score (required), feedback }
 * Once submitted, grade becomes immutable
 */
router.put('/:id/grade/submit', SubmissionController.submitFinalGrade);

export default router;
