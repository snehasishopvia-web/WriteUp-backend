export interface Plan {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price_monthly: number;
  price_yearly: number;
  max_schools: number;
  max_students_per_school: number;
  max_teachers_per_school: number;
  max_classes_per_school: number;
  max_storage_gb: number;
  allow_custom_branding: boolean;
  allow_api_access: boolean;
  allow_advanced_reports: boolean;
  allow_parent_portal: boolean;
  display_order: number;
  is_featured: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePlanDTO {
  name: string;
  slug: string;
  description?: string;
  price_monthly: number;
  price_yearly: number;
  max_schools?: number;
  max_students_per_school?: number;
  max_teachers_per_school?: number;
  max_classes_per_school?: number;
  max_storage_gb?: number;
  allow_custom_branding?: boolean;
  allow_api_access?: boolean;
  allow_advanced_reports?: boolean;
  allow_parent_portal?: boolean;
  display_order?: number;
  is_featured?: boolean;
}

export interface UpdatePlanDTO {
  name?: string;
  slug?: string;
  description?: string;
  price_monthly?: number;
  price_yearly?: number;
  max_schools?: number;
  max_students_per_school?: number;
  max_teachers_per_school?: number;
  max_classes_per_school?: number;
  max_storage_gb?: number;
  allow_custom_branding?: boolean;
  allow_api_access?: boolean;
  allow_advanced_reports?: boolean;
  allow_parent_portal?: boolean;
  display_order?: number;
  is_featured?: boolean;
  is_active?: boolean;
}
