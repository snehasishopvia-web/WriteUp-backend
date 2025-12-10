import { pool } from "../config/postgres.db.js";
import { QueryResult } from "pg";

export interface RefundRequest {
  id: string;
  payment_id: string;
  user_id: string;
  account_id: string;
  stripe_refund_id: string | null;
  amount: number;
  status: "pending" | "approved" | "rejected" | "completed";
  reason: string | null;
  created_at: Date;
  approved_at: Date | null;
  updated_at: Date;
}

export interface CreateRefundRequestInput {
  paymentId: string;
  userId: string;
  accountId: string;
  stripeRefundId?: string | null;
  amount: number;
  status?: "pending" | "approved" | "rejected" | "completed";
  reason?: string | null;
}

export class RefundRequestModel {
  /**
   * Create a new refund request
   */
  static async create(input: CreateRefundRequestInput): Promise<RefundRequest> {
    const result: QueryResult<RefundRequest> = await pool.query(
      `INSERT INTO refund_requests (
        payment_id,
        user_id,
        account_id,
        stripe_refund_id,
        amount,
        status,
        reason,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *`,
      [
        input.paymentId,
        input.userId,
        input.accountId,
        input.stripeRefundId ?? null,
        input.amount,
        input.status ?? "completed",
        input.reason ?? null,
      ]
    );

    const record = result.rows[0];
    if (!record) throw new Error("Failed to create refund request record");
    return record;
  }

  /**
   * Find refund request by ID
   */
  static async findById(id: string): Promise<RefundRequest | null> {
    const result: QueryResult<RefundRequest> = await pool.query(
      `SELECT * FROM refund_requests WHERE id = $1`,
      [id]
    );

    return result.rows[0] ?? null;
  }

  /**
   * Find refund request by payment ID
   */
  static async findByPaymentId(paymentId: string): Promise<RefundRequest | null> {
    const result: QueryResult<RefundRequest> = await pool.query(
      `SELECT * FROM refund_requests WHERE payment_id = $1`,
      [paymentId]
    );

    return result.rows[0] ?? null;
  }

  /**
   * Find all refund requests for an account
   */
  static async findByAccountId(accountId: string): Promise<RefundRequest[]> {
    const result: QueryResult<RefundRequest> = await pool.query(
      `SELECT * FROM refund_requests 
       WHERE account_id = $1 
       ORDER BY created_at DESC`,
      [accountId]
    );

    return result.rows;
  }

  /**
   * Update refund request status
   */
  static async updateStatus(
    id: string,
    status: "pending" | "approved" | "rejected" | "completed",
    stripeRefundId?: string
  ): Promise<RefundRequest | null> {
    const fields = ["status = $1", "updated_at = NOW()"];
    const values: any[] = [status];
    let paramIndex = 2;

    if (stripeRefundId !== undefined) {
      fields.push(`stripe_refund_id = $${paramIndex}`);
      values.push(stripeRefundId);
      paramIndex++;
    }

    if (status === "approved" || status === "completed") {
      fields.push(`approved_at = NOW()`);
    }

    values.push(id);

    const result: QueryResult<RefundRequest> = await pool.query(
      `UPDATE refund_requests 
       SET ${fields.join(", ")}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0] ?? null;
  }
}
