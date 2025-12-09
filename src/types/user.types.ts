export interface User {
  id: string;
  email: string;
  password?: string;
  user_type: "admin" | "teacher" | "student" | "user";
  school_name?: string | null;
  email_verified: boolean;
  onboarding_step: number;
  selected_plan?: string | null;
  payment_status?: "pending" | "paid" | "failed" | null;
  signup_token?: string | null;
  signup_completed_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}
