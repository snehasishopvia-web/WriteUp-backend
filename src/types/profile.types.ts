// Teacher Profile Types
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'temporary';

export interface TeacherProfile {
  id: string;
  school_id: string;
  user_id: string;
  employee_id: string;
  department_id?: string;
  qualification: string;
  specialization?: string;
  experience_years: number;
  join_date: Date;
  employment_type: EmploymentType;
  salary?: number;
  bio?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTeacherProfileDTO {
  user_id: string;
  employee_id: string;
  department_id?: string;
  qualification: string;
  specialization?: string;
  experience_years?: number;
  join_date: Date;
  employment_type?: EmploymentType;
  salary?: number;
  bio?: string;
}

export interface UpdateTeacherProfileDTO {
  employee_id?: string;
  department_id?: string;
  qualification?: string;
  specialization?: string;
  experience_years?: number;
  join_date?: Date;
  employment_type?: EmploymentType;
  salary?: number;
  bio?: string;
  is_active?: boolean;
}

// Student Profile Types
export type StudentStatus = 'active' | 'graduated' | 'transferred' | 'dropped' | 'suspended';

export interface StudentProfile {
  id: string;
  school_id: string;
  user_id: string;
  admission_number: string;
  admission_date: Date;
  roll_number?: string;
  current_class_id?: string;
  father_name?: string;
  father_phone?: string;
  father_email?: string;
  father_occupation?: string;
  mother_name?: string;
  mother_phone?: string;
  mother_email?: string;
  mother_occupation?: string;
  guardian_name?: string;
  guardian_phone?: string;
  guardian_email?: string;
  guardian_relation?: string;
  blood_group?: string;
  medical_conditions?: string;
  allergies?: string;
  status: StudentStatus;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateStudentProfileDTO {
  user_id: string;
  admission_number: string;
  admission_date: Date;
  roll_number?: string;
  current_class_id?: string;
  father_name?: string;
  father_phone?: string;
  father_email?: string;
  father_occupation?: string;
  mother_name?: string;
  mother_phone?: string;
  mother_email?: string;
  mother_occupation?: string;
  guardian_name?: string;
  guardian_phone?: string;
  guardian_email?: string;
  guardian_relation?: string;
  blood_group?: string;
  medical_conditions?: string;
  allergies?: string;
  status?: StudentStatus;
}

export interface UpdateStudentProfileDTO {
  admission_number?: string;
  admission_date?: Date;
  roll_number?: string;
  current_class_id?: string;
  father_name?: string;
  father_phone?: string;
  father_email?: string;
  father_occupation?: string;
  mother_name?: string;
  mother_phone?: string;
  mother_email?: string;
  mother_occupation?: string;
  guardian_name?: string;
  guardian_phone?: string;
  guardian_email?: string;
  guardian_relation?: string;
  blood_group?: string;
  medical_conditions?: string;
  allergies?: string;
  status?: StudentStatus;
  is_active?: boolean;
}
