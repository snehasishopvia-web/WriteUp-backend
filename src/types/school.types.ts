export enum SchoolType {
  ELEMENTARY = "elementary",
  MIDDLE_2 = "middle-2",
  MIDDLE_3 = "middle-3",
  MIDDLE_4 = "middle-4",
  HIGH_4 = "high-4",
  COLLEGE_UNIVERSITY_1 = "college-university-1",
  COLLEGE_UNIVERSITY_2 = "college-university-2",
  COLLEGE_UNIVERSITY_3 = "college-university-3",
  COLLEGE_UNIVERSITY_4 = "college-university-4",
  GRADUATE = "graduate",
  OTHER = "other",
}

export const SchoolTypeLabels: Record<SchoolType, string> = {
  [SchoolType.ELEMENTARY]: "Elementary School",
  [SchoolType.MIDDLE_2]: "Middle School (2 years)",
  [SchoolType.MIDDLE_3]: "Middle School (3 years)",
  [SchoolType.MIDDLE_4]: "Middle School (4 years)",
  [SchoolType.HIGH_4]: "High School (4 years)",
  [SchoolType.COLLEGE_UNIVERSITY_1]: "College/University (1 year)",
  [SchoolType.COLLEGE_UNIVERSITY_2]: "College/University (2 years)",
  [SchoolType.COLLEGE_UNIVERSITY_3]: "College/University (3 years)",
  [SchoolType.COLLEGE_UNIVERSITY_4]: "College/University (4 years)",
  [SchoolType.GRADUATE]: "Graduate School",
  [SchoolType.OTHER]: "Other",
};

export enum ClassStructureType {
  SEMESTER = "semester",
  QUARTER = "quarter",
  YEARLY = "yearly",
}

export const ClassStructureTypeLabels: Record<ClassStructureType, string> = {
  [ClassStructureType.SEMESTER]: "Semester",
  [ClassStructureType.QUARTER]: "Quarter",
  [ClassStructureType.YEARLY]: "Yearly",
};

export interface UploadSummary {
  created_count: number;
  updated_count: number;
  failed_count: number;
  total_rows_processed: number;
}

export interface FileUploadInfo {
  fileName: string;
  uploadDate: string;
  summary: UploadSummary;
}

export interface School {
  id: string;
  name: string;
  school_type: SchoolType;
  class_structure_type: ClassStructureType;
  additional_programs: string[];
  admin_id: string;
  timezone: string;
  onboarding_completed: boolean;
  teachers_uploaded: boolean;
  students_uploaded: boolean;
  teacher_file_name?: string | null;
  teacher_upload_date?: Date | null;
  teacher_upload_summary?: UploadSummary | null;
  student_file_name?: string | null;
  student_upload_date?: Date | null;
  student_upload_summary?: UploadSummary | null;
  created_at: Date;
  updated_at: Date;
  unique_key: string;
  school_name: string;
  school_key: string;
}

// DTOs
export interface SaveOnboardingDataDTO {
  name: string;
  school_type: SchoolType;
  class_structure_type: ClassStructureType;
  timezone: string;
  additional_programs?: string[];
}

export interface SaveProgramsDTO {
  additional_programs: string[];
}

export interface CompleteStepDTO {
  step: "teachers" | "students" | "complete";
  completed: boolean;
}

export function calculateOnboardingProgress(school: School): number {
  let stepsCompleted = 0;
  const totalSteps = 6;

  // Step 1: count welcome
  stepsCompleted += 1;

  // Step 2: School name and type
  if (school.name && school.school_type) stepsCompleted += 1;

  // Step 3: Class structure type
  if (school.class_structure_type) stepsCompleted += 1;

  // Step 4: count (programs optional)
  stepsCompleted += 1;

  // Step 5: Teachers uploaded
  if (school.teachers_uploaded) stepsCompleted += 1;

  // Step 6: Students uploaded
  if (school.students_uploaded) stepsCompleted += 1;

  return (stepsCompleted / totalSteps) * 100;
}

export function isBasicInfoComplete(school: School): boolean {
  return !!(school.name && school.school_type && school.class_structure_type);
}

export function getSchoolTypeLabel(type: SchoolType): string {
  return SchoolTypeLabels[type] || type;
}

export function getClassStructureLabel(type: ClassStructureType): string {
  return ClassStructureTypeLabels[type] || type;
}
