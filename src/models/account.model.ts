import { pool } from "../config/postgres.db.js";
import { PoolClient } from "pg";
import {
  Account,
  CreateAccountDTO,
  UpdateAccountDTO,
} from "../types/account.types.js";

export class AccountModel {
  /**
   * Create a new account
   */
  static async create(data: CreateAccountDTO): Promise<Account> {
    const result = await pool.query(
      `INSERT INTO accounts (
        owner_email, owner_name, company_name, plan_id,
        subscription_status, subscription_start_date, subscription_end_date,
        billing_cycle, phone, address, timezone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        data.owner_email,
        data.owner_name,
        data.company_name || null,
        data.plan_id,
        data.subscription_status || "trial",
        data.subscription_start_date || new Date().toISOString().split("T")[0],
        data.subscription_end_date || null,
        data.billing_cycle || "monthly",
        data.phone || null,
        data.address || null,
        data.timezone || "UTC",
      ]
    );

    return result.rows[0];
  }

  /**
   * Find account by ID
   */
  static async findById(accountId: string): Promise<Account | null> {
    const result = await pool.query("SELECT * FROM accounts WHERE id = $1", [
      accountId,
    ]);

    return result.rows[0] || null;
  }

  /**
   * Find account by owner email
   */
  static async findByEmail(email: string): Promise<Account | null> {
    const result = await pool.query(
      "SELECT * FROM accounts WHERE owner_email = $1",
      [email]
    );

    return result.rows[0] || null;
  }

  /**
   * Get all accounts
   */
  static async getAll(): Promise<Account[]> {
    const result = await pool.query(
      "SELECT * FROM accounts ORDER BY created_at DESC"
    );

    return result.rows;
  }

  /**
   * Update account
   */
  static async update(
    accountId: string,
    data: UpdateAccountDTO
  ): Promise<Account | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.owner_email !== undefined) {
      fields.push(`owner_email = $${paramCount++}`);
      values.push(data.owner_email);
    }
    if (data.owner_name !== undefined) {
      fields.push(`owner_name = $${paramCount++}`);
      values.push(data.owner_name);
    }
    if (data.company_name !== undefined) {
      fields.push(`company_name = $${paramCount++}`);
      values.push(data.company_name);
    }
    if (data.plan_id !== undefined) {
      fields.push(`plan_id = $${paramCount++}`);
      values.push(data.plan_id);
    }
    if (data.subscription_status !== undefined) {
      fields.push(`subscription_status = $${paramCount++}`);
      values.push(data.subscription_status);
    }
    if (data.subscription_start_date !== undefined) {
      fields.push(`subscription_start_date = $${paramCount++}`);
      values.push(data.subscription_start_date);
    }
    if (data.subscription_end_date !== undefined) {
      fields.push(`subscription_end_date = $${paramCount++}`);
      values.push(data.subscription_end_date);
    }
    if (data.billing_cycle !== undefined) {
      fields.push(`billing_cycle = $${paramCount++}`);
      values.push(data.billing_cycle);
    }
    if (data.phone !== undefined) {
      fields.push(`phone = $${paramCount++}`);
      values.push(data.phone);
    }
    if (data.address !== undefined) {
      fields.push(`address = $${paramCount++}`);
      values.push(data.address);
    }
    if (data.timezone !== undefined) {
      fields.push(`timezone = $${paramCount++}`);
      values.push(data.timezone);
    }
    if (data.is_active !== undefined) {
      fields.push(`is_active = $${paramCount++}`);
      values.push(data.is_active);
    }
    if (data.payment_status !== undefined) {
      fields.push(`payment_status = $${paramCount++}`);
      values.push(data.payment_status);
    }

    if (fields.length === 0) {
      return this.findById(accountId);
    }

    fields.push(`updated_at = NOW()`);
    values.push(accountId);

    const result = await pool.query(
      `UPDATE accounts SET ${fields.join(
        ", "
      )} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete account
   */
  static async delete(accountId: string): Promise<boolean> {
    const result = await pool.query(
      "DELETE FROM accounts WHERE id = $1 RETURNING id",
      [accountId]
    );

    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Get account with plan details
   */
  static async getWithPlan(accountId: string): Promise<any | null> {
    const result = await pool.query(
      `SELECT
        a.*,
        p.name as plan_name,
        p.slug as plan_slug,
        p.price_monthly,
        p.price_yearly,
        p.max_students,
        p.max_teachers,
        p.max_classes,
        p.features
      FROM accounts a
      LEFT JOIN plans p ON a.plan_id = p.id
      WHERE a.id = $1`,
      [accountId]
    );

    return result.rows[0] || null;
  }

  // ==========================================

  // find the user data by email
  static async findBySignUpEmail(email: string) {
    const result = await pool.query(
      `SELECT id, owner_email, password, email_verified, signup_token, plan_id, onboarding_step, payment_status
       FROM accounts 
       WHERE owner_email = $1`,
      [email]
    );
    return result.rows[0] || null;
  }
  // manage transactions
  static async getClient(): Promise<PoolClient> {
    return pool.connect();
  }
  // Check if account exists by email (for signup)
  static async existsByEmail(email: string) {
    const result = await pool.query(
      `SELECT id FROM accounts WHERE owner_email = $1`,
      [email]
    );
    return result.rows.length > 0;
  }

  // Create new account during signup
  static async createAccount(
    email: string,
    password: string,
    planId: string,
    signupToken: string,
    schoolName: string
  ) {
    const result = await pool.query(
      `INSERT INTO accounts (owner_email,owner_name, password, plan_id, signup_token, school_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, owner_email, plan_id, signup_token, email_verified, onboarding_step, school_name`,
      [email, "Unknown", password, planId, signupToken, schoolName]
    );
    return result.rows[0];
  }

  // Create new school (only name during signup)
  // static async createSchool(schoolName: string, adminId: string) {
  //   const result = await pool.query(
  //     `INSERT INTO schools (name, admin_id)
  //      VALUES ($1, $2)
  //      RETURNING id, name, admin_id`,
  //     [schoolName, adminId]
  //   );
  //   return result.rows[0];
  // }

  // Update email verification
  static async verifyEmail(email: string) {
    const result = await pool.query(
      `UPDATE accounts
       SET email_verified = true,
           onboarding_step = 2,
           signup_completed_at = NOW(),
           updated_at = NOW()
       WHERE owner_email = $1
       RETURNING id, owner_email, email_verified, onboarding_step, plan_id, signup_token, signup_completed_at`,
      [email]
    );
    return result.rows[0];
  }

  // Update signup token (for resend)
  static async updateSignupToken(email: string, token: string) {
    await pool.query(
      `UPDATE accounts 
       SET signup_token = $1, updated_at = NOW() 
       WHERE owner_email = $2`,
      [token, email]
    );
  }

  // Get plan info (for email display)
  static async getPlanById(planId: string) {
    const result = await pool.query(
      `SELECT name, price_monthly, price_yearly FROM plans WHERE id = $1`,
      [planId]
    );
    return result.rows[0] || { name: "Unknown Plan", price_monthly: 0 };
  }

  // Get signup status (onboarding)
  static async getSignupStatus(email: string) {
    const result = await pool.query(
      `SELECT onboarding_step, email_verified, plan_id, payment_status
       FROM accounts
       WHERE owner_email = $1`,
      [email]
    );
    return result.rows[0];
  }

  // Update onboarding step
  static async updateOnboardingStep(accountId: string, step: number) {
    const result = await pool.query(
      `UPDATE accounts 
       SET onboarding_step = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING onboarding_step`,
      [step, accountId]
    );
    return result.rows[0];
  }

  // Change selected plan
  static async changePlan(accountId: string, newPlanId: string) {
    const result = await pool.query(
      `UPDATE accounts 
       SET plan_id = $1,
           onboarding_step = 3,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, plan_id, onboarding_step`,
      [newPlanId, accountId]
    );
    return result.rows[0];
  }

  // Complete signup after payment
  static async completeSignup(accountId: string, paymentStatus: string) {
    const result = await pool.query(
      `UPDATE accounts
       SET payment_status = $1,
           onboarding_step = CASE WHEN $1 = 'paid' THEN 4 ELSE onboarding_step END,
           signup_completed_at = CASE WHEN $1 = 'paid' THEN NOW() ELSE NULL END,
           updated_at = NOW()
       WHERE id = $2
       RETURNING payment_status, onboarding_step, signup_completed_at`,
      [paymentStatus, accountId]
    );
    return result.rows[0];
  }
  
  static async findExpiredFinalPlans(date: string) {
    const result = await pool.query(
      `SELECT * FROM accounts
     WHERE subscription_end_date = $1
     AND subscription_status = 'active'`,
      [date]
    );

    return result.rows;
  }

  static async findPaidPlansExpiredOn(date: string): Promise<Account[]> {
    const result = await pool.query(
      `SELECT * FROM accounts
     WHERE subscription_end_date = $1
     AND subscription_status = 'active'`,
      [date]
    );

    return result.rows;
  }
  static async findActualPlanExpiry(date: string) {
    const result = await pool.query(
      `SELECT * FROM accounts
     WHERE subscription_end_date = $1
     AND subscription_status = 'active'`,
      [date]
    );

    return result.rows;
  }
}
