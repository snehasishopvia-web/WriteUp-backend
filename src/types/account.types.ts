export type SubscriptionStatus =
  | "pending"
  | "trialing"
  | "requires_payment_method"
  | "processing"
  | "succeeded"
  | "failed";
export type BillingCycle = "monthly" | "yearly";

export interface Account {
  id: string;
  owner_email: string;
  owner_name: string;
  company_name?: string;
  plan_id: string;
  subscription_status: SubscriptionStatus;
  subscription_start_date: Date;
  subscription_end_date?: Date;
  billing_cycle: BillingCycle;
  phone?: string;
  address?: string;
  timezone: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  password?: string;
  has_used_trial?: boolean;
  school_name?: string | null;
}

export interface CreateAccountDTO {
  owner_email: string;
  owner_name: string;
  company_name?: string;
  plan_id: string;
  subscription_status?: SubscriptionStatus;
  subscription_start_date?: Date;
  subscription_end_date?: Date;
  billing_cycle?: BillingCycle;
  phone?: string;
  address?: string;
  timezone?: string;
}

export interface UpdateAccountDTO {
  owner_email?: string;
  owner_name?: string;
  company_name?: string | null;
  plan_id?: string | null;
  subscription_status?: string;
  subscription_start_date?: string;
  subscription_end_date?: string | null;
  billing_cycle?: string;
  phone?: string | null;
  address?: string | null;
  timezone?: string;
  is_active?: boolean;
  payment_status?: string;
  has_used_trial?: boolean;
}
