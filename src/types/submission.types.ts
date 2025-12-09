/**
 * Submission Types and Interfaces
 * Handles student assignment submissions with multi-tenant support
 */

export type SubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'graded'
  | 'returned'
  | 'resubmitted';

/**
 * Database row representation of a submission
 */
export interface SubmissionRow {
  id: string;
  school_id: string;
  class_id: string;
  assignment_id: string;
  student_id: string;
  document_id: string | null;
  content: string | null;
  status: SubmissionStatus;
  submitted_at: Date | null;
  score: number | null;
  feedback: string | null;
  graded_by: string | null;
  graded_at: Date | null;
  word_count: number | null;
  page_count: number | null;
  submission_metadata: any | null;
  is_late: boolean;
  version: number;
  previous_submission_id: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * DTO for creating a new submission
 */
export interface CreateSubmissionDTO {
  school_id: string;
  class_id: string;
  assignment_id: string;
  student_id: string;
  document_id?: string | null;
  content?: string | null;
  status?: SubmissionStatus;
  word_count?: number | null;
  page_count?: number | null;
  submission_metadata?: any | null;
  is_late?: boolean;
}

/**
 * DTO for updating an existing submission
 */
export interface UpdateSubmissionDTO {
  content?: string | null;
  status?: SubmissionStatus;
  score?: number | null;
  feedback?: string | null;
  graded_by?: string | null;
  graded_at?: Date | null;
  word_count?: number | null;
  page_count?: number | null;
  submission_metadata?: any | null;
  is_late?: boolean;
}

/**
 * API response format for submissions
 */
export interface SubmissionResponse {
  id: string;
  schoolId: string;
  classId: string;
  assignmentId: string;
  studentId: string;
  documentId: string | null;
  content: string | null;
  status: SubmissionStatus;
  submittedAt: Date | null;
  score: number | null;
  feedback: string | null;
  gradedBy: string | null;
  gradedAt: Date | null;
  wordCount: number | null;
  pageCount: number | null;
  submissionMetadata: any | null;
  isLate: boolean;
  version: number;
  previousSubmissionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
