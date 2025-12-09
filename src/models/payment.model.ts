import { pool } from "../config/postgres.db.js";
import { QueryResult } from "pg";

export type PaymentStatus =
  | "pending"
  | "trialing"
  | "requires_payment_method"
  | "processing"
  | "succeeded"
  | "failed";

export interface AddonsData {
  students: number;
  teachers: number;
  totalAddonCost?: number;
  totalCost?: number;
  basePlanPrice?: number; // Actual base plan price (not prorated) for credit calculations
}

export interface PaymentRecord {
  id: string;
  user_id: string | null;
  account_id: string | null;
  plan_id: string | null;
  mode: "one_time" | "subscription";
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
  stripe_payment_intent_id: string | null;
  stripe_subscription_id: string | null;
  email_sent_at: Date | null;
  fail_reason: string | null;
  metadata: Record<string, unknown>;
  addons: AddonsData | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePaymentInput {
  userId?: string | null;
  accountId: string;
  planId: string | null;
  mode: "one_time" | "subscription";
  amountCents: number;
  currency: string;
  stripePaymentIntentId: string;
  metadata?: Record<string, unknown>;
  addons?: AddonsData;
  stripeSubscriptionId?: string | null;
  status: PaymentStatus;
}

export interface UpdatePaymentStatusInput {
  stripePaymentIntentId?: string | null;
  stripeSubscriptionId?: string | null;
  status: PaymentStatus;
  failReason?: string | null;
  metadata?: Record<string, unknown>;
  userId?: string | null;
}

export class PaymentModel {
  static async create(input: CreatePaymentInput): Promise<PaymentRecord> {
    const result: QueryResult<PaymentRecord> = await pool.query(
      `INSERT INTO payments (
        user_id,
        account_id,
        plan_id,
        mode,
        amount_cents,
        currency,
        status,
        stripe_payment_intent_id,
        stripe_subscription_id,
        metadata,
        addons,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
      RETURNING *`,
      [
        input.userId ?? null,
        input.accountId,
        input.planId,
        input.mode,
        input.amountCents,
        input.currency,
        input.status,
        input.stripePaymentIntentId,
        input.stripeSubscriptionId ?? null,
        JSON.stringify(input.metadata ?? {}),
        JSON.stringify(input.addons ?? {}),
      ]
    );

    const record = result.rows[0];
    if (!record) throw new Error("Failed to persist payment record");
    return record;
  }

  static async updateStatusBySessionId(
    stripeCheckoutSessionId: string,
    input: UpdatePaymentStatusInput
  ): Promise<PaymentRecord | null> {
    const fields: string[] = [`status = $1`, `updated_at = CURRENT_TIMESTAMP`];
    const values: unknown[] = [input.status];
    let idx = 2;

    if (input.stripePaymentIntentId !== undefined) {
      fields.push(`stripe_payment_intent_id = $${idx++}`);
      values.push(input.stripePaymentIntentId);
    }

    if (input.stripeSubscriptionId !== undefined) {
      fields.push(`stripe_subscription_id = $${idx++}`);
      values.push(input.stripeSubscriptionId);
    }

    if (input.failReason !== undefined) {
      fields.push(`fail_reason = $${idx++}`);
      values.push(input.failReason);
    }

    if (input.metadata !== undefined) {
      fields.push(`metadata = $${idx++}`);
      values.push(input.metadata);
    }

    if (input.userId !== undefined) {
      fields.push(`user_id = $${idx++}`);
      values.push(input.userId);
    }

    values.push(stripeCheckoutSessionId);

    const result: QueryResult<PaymentRecord> = await pool.query(
      `UPDATE payments
       SET ${fields.join(", ")}
       WHERE stripe_checkout_session_id = $${values.length}
       RETURNING *`,
      values
    );

    return result.rows[0] ?? null;
  }

  static async updateStatusByIntentId(
    stripePaymentIntentId: string,
    input: UpdatePaymentStatusInput
  ): Promise<PaymentRecord | null> {
    const fields: string[] = [`status = $1`, `updated_at = CURRENT_TIMESTAMP`];
    const values: unknown[] = [input.status];
    let idx = 2;

    if (input.stripeSubscriptionId !== undefined) {
      fields.push(`stripe_subscription_id = $${idx++}`);
      values.push(input.stripeSubscriptionId);
    }

    if (input.failReason !== undefined) {
      fields.push(`fail_reason = $${idx++}`);
      values.push(input.failReason);
    }

    if (input.metadata !== undefined) {
      fields.push(`metadata = $${idx++}`);
      values.push(JSON.stringify(input.metadata));
    }

    if (input.userId !== undefined) {
      fields.push(`user_id = $${idx++}`);
      values.push(input.userId);
    }

    values.push(stripePaymentIntentId);

    const result: QueryResult<PaymentRecord> = await pool.query(
      `UPDATE payments
       SET ${fields.join(", ")}
       WHERE stripe_payment_intent_id = $${values.length}
       RETURNING *`,
      values
    );

    return result.rows[0] ?? null;
  }

  static async markEmailSent(stripePaymentIntentId: string): Promise<void> {
    await pool.query(
      `UPDATE payments
       SET email_sent_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE stripe_payment_intent_id = $1`,
      [stripePaymentIntentId]
    );
  }

  static async findBySessionId(
    stripeCheckoutSessionId: string
  ): Promise<PaymentRecord | null> {
    const result: QueryResult<PaymentRecord> = await pool.query(
      `SELECT * FROM payments WHERE stripe_checkout_session_id = $1`,
      [stripeCheckoutSessionId]
    );

    return result.rows[0] ?? null;
  }

  static async findByIntentId(
    stripePaymentIntentId: string
  ): Promise<PaymentRecord | null> {
    const result: QueryResult<PaymentRecord> = await pool.query(
      `SELECT * FROM payments WHERE stripe_payment_intent_id = $1`,
      [stripePaymentIntentId]
    );
    return result.rows[0] ?? null;
  }

  static async attachUserToSession(
    stripeCheckoutSessionId: string,
    userId: string
  ): Promise<void> {
    await pool.query(
      `UPDATE payments
       SET user_id = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE stripe_checkout_session_id = $1`,
      [stripeCheckoutSessionId, userId]
    );
  }

  static async attachUserToIntent(
    stripePaymentIntentId: string,
    userId: string
  ): Promise<void> {
    await pool.query(
      `UPDATE payments
       SET user_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE stripe_payment_intent_id = $1`,
      [stripePaymentIntentId, userId]
    );
  }

  static async attachUserToAccount(
    accountId: string,
    userId: string
  ): Promise<void> {
    await pool.query(
      `UPDATE payments
       SET user_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE account_id = $1 AND user_id IS NULL`,
      [accountId, userId]
    );
  }
  static async updateBySubscriptionId(subscriptionId: string, data: any) {
    const fields: string[] = [];
    const values: any[] = [];
    let param = 1;

    for (const key in data) {
      // Convert camelCase keys to snake_case if needed
      const column = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      fields.push(`${column} = $${param}`);
      values.push(data[key]);
      param++;
    }

    values.push(subscriptionId);

    const result = await pool.query(
      `UPDATE payments SET ${fields.join(", ")} 
     WHERE stripe_subscription_id = $${param}
     RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  static async findLatestPaymentByAccountId(accountId?: string | null) {
    if (!accountId) return null;

    const result = await pool.query(
      `SELECT * FROM payments WHERE account_id = $1
     ORDER BY created_at DESC LIMIT 1`,
      [accountId]
    );
    return result.rows[0] ?? null;
  }

  static async updateUserIdForAccount(accountId: string, userId: string) {
    const result = await pool.query(
      `
      UPDATE payments
      SET user_id = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE account_id = $1 AND user_id IS NULL
      RETURNING *
    `,
      [accountId, userId]
    );

    return result.rows[0] ?? null;
  }

  static async findByAccountId(accountId: string): Promise<PaymentRecord | null> {
  const result: QueryResult<PaymentRecord> = await pool.query(
    `SELECT * FROM payments 
     WHERE account_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [accountId]
  );

  return result.rows[0] ?? null;
}
}
