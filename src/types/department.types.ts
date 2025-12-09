export interface Department {
  id: string;
  school_id: string;
  name: string;
  code: string;
  description?: string;
  head_id?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateDepartmentDTO {
  name: string;
  code?: string;
  description?: string;
  head_id?: string;
}

export interface UpdateDepartmentDTO {
  name?: string;
  code?: string;
  description?: string;
  head_id?: string;
  is_active?: boolean;
}
