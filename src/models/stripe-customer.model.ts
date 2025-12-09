import { pool } from "../config/postgres.db.js";
import { QueryResult } from "pg";

export interface StripeCustomerRecord {
  id: string;
  account_id: string;
  user_id: string | null;
  stripe_customer_id: string;
  email: string | null;
  created_at: Date;
  updated_at: Date;
}

export class StripeCustomerModel {
  static async findByAccountId(
    accountId: string
  ): Promise<StripeCustomerRecord | null> {
    const result: QueryResult<StripeCustomerRecord> = await pool.query(
      `SELECT * FROM stripe_customers WHERE account_id = $1`,
      [accountId]
    );

    return result.rows[0] ?? null;
  }

  static async findByUserId(
    userId: string
  ): Promise<StripeCustomerRecord | null> {
    const result: QueryResult<StripeCustomerRecord> = await pool.query(
      `SELECT * FROM stripe_customers WHERE user_id = $1`,
      [userId]
    );

    return result.rows[0] ?? null;
  }

  static async upsert(params: {
    accountId: string;
    stripeCustomerId: string;
    email?: string | null;
    userId?: string | null;
  }): Promise<StripeCustomerRecord> {
    const { accountId, stripeCustomerId, email, userId = null } = params;

    const result: QueryResult<StripeCustomerRecord> = await pool.query(
      `INSERT INTO stripe_customers (account_id, stripe_customer_id, email, user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (account_id)
       DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id,
                     email = EXCLUDED.email,
                     user_id = COALESCE(EXCLUDED.user_id, stripe_customers.user_id),
                     updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [accountId, stripeCustomerId, email ?? null, userId]
    );

    const record = result.rows[0];
    if (!record) {
      throw new Error("Failed to upsert Stripe customer");
    }

    return record;
  }

  static async attachUser(accountId: string, userId: string): Promise<void> {
    await pool.query(
      `UPDATE stripe_customers
       SET user_id = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE account_id = $1`,
      [accountId, userId]
    );
  }
  static async updateByAccountId(
    accountId: string,
    data: { user_id?: string | null }
  ) {
    const result = await pool.query(
      `
      UPDATE stripe_customers
      SET user_id = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE account_id = $1
      RETURNING *
    `,
      [accountId, data.user_id ?? null]
    );

    return result.rows[0] ?? null;
  }
}
