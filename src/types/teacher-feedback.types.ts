export type FeedbackType = 'multi-line' | 'multi-para' | 'delete' | 'insert' | 'move';

export interface TextSelection {
  id: string;
  startParagraphIndex: number;
  endParagraphIndex: number;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  timestamp: number;
}

export interface MoveSelection {
  textSelection: TextSelection | null;
  destinationPosition: {
    paragraphIndex: number;
    offset: number;
    visualX?: number;
  } | null;
  isWaitingForDestination: boolean;
}

// Feedback data structures based on type
export interface MultiLineFeedbackData {
  selectedTextRanges: TextSelection[];
}

export interface MultiParaFeedbackData {
  selectedParagraphs: number[];
}

export interface DeleteFeedbackData {
  deleteSelection: TextSelection;
}

export interface InsertFeedbackData {
  insertPosition: {
    paragraphIndex: number;
    offset: number;
    visualX?: number;
  };
}

export interface MoveFeedbackData {
  moveSelection: MoveSelection;
}

export type FeedbackData =
  | MultiLineFeedbackData
  | MultiParaFeedbackData
  | DeleteFeedbackData
  | InsertFeedbackData
  | MoveFeedbackData;

// Database row structure
export interface TeacherFeedbackRow {
  id: string;
  school_id: string;
  teacher_id: string;
  student_id: string;
  assignment_id: string;
  submission_id: string;
  feedback_type: FeedbackType;
  title: string;
  description: string;
  feedback_data: FeedbackData;
  created_at: Date;
  updated_at: Date;
}

// API request structure
export interface CreateFeedbackDTO {
  assignmentId: string;
  submissionId: string;
  studentId: string;
  type: FeedbackType;
  title: string;
  description: string;
  // Type-specific fields (will be converted to feedback_data)
  selectedTextRanges?: TextSelection[];
  selectedParagraphs?: number[];
  deleteSelection?: TextSelection;
  insertPosition?: { paragraphIndex: number; offset: number; visualX?: number };
  moveSelection?: MoveSelection;
}

export interface UpdateFeedbackDTO {
  title?: string;
  description?: string;
  // Type-specific fields (will be converted to feedback_data)
  selectedTextRanges?: TextSelection[];
  selectedParagraphs?: number[];
  deleteSelection?: TextSelection;
  insertPosition?: { paragraphIndex: number; offset: number; visualX?: number };
  moveSelection?: MoveSelection;
}

// API response structure
export interface TeacherFeedbackResponse {
  id: string;
  schoolId: string;
  teacherId: string;
  studentId: string;
  assignmentId: string;
  submissionId: string;
  type: FeedbackType;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  // Type-specific fields (spread from feedback_data)
  selectedTextRanges?: TextSelection[];
  selectedParagraphs?: number[];
  deleteSelection?: TextSelection;
  insertPosition?: { paragraphIndex: number; offset: number; visualX?: number };
  moveSelection?: MoveSelection;
}
