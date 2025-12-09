import { pool } from "../config/postgres.db.js";
import { createError } from "../middleware/error.middleware.js";

/**
 * Check if subscription is active and not expired
 */
export async function isSubscriptionActive(accountId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT subscription_status, subscription_end_date 
     FROM accounts 
     WHERE id = $1`,
    [accountId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  const account = result.rows[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0); 

  // Check if subscription_end_date exists and is in the past
  if (account.subscription_end_date) {
    const endDate = new Date(account.subscription_end_date);
    endDate.setHours(0, 0, 0, 0);

    if (endDate < today) {
      return false; 
    }
  }

  // Check subscription status
  const activeStatuses = ['active', 'trialing', 'paid'];
  return activeStatuses.includes(account.subscription_status);
}

/**
 * Get subscription status with details
 */
export async function getSubscriptionStatus(accountId: string): Promise<{
  isActive: boolean;
  status: string;
  endDate: Date | null;
  daysRemaining: number | null;
  message?: string;
}> {
  const result = await pool.query(
    `SELECT subscription_status, subscription_end_date 
     FROM accounts 
     WHERE id = $1`,
    [accountId]
  );

  if (result.rows.length === 0) {
    throw createError("Account not found", 404);
  }

  const account = result.rows[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let isActive = true;
  let daysRemaining: number | null = null;
  let message: string | undefined;

  if (account.subscription_end_date) {
    const endDate = new Date(account.subscription_end_date);
    endDate.setHours(0, 0, 0, 0);

    const diffTime = endDate.getTime() - today.getTime();
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (endDate < today) {
      isActive = false;
      message = "Your subscription has expired. Please renew to continue using the service.";
    } else if (daysRemaining <= 7 && daysRemaining > 0) {
      message = `Your subscription will expire in ${daysRemaining} day(s).`;
    }
  }

  const activeStatuses = ['active', 'trialing', 'paid'];
  if (!activeStatuses.includes(account.subscription_status)) {
    isActive = false;
    message = `Your subscription is ${account.subscription_status}. Please contact support or renew your subscription.`;
  }

  return {
    isActive,
    status: account.subscription_status,
    endDate: account.subscription_end_date ? new Date(account.subscription_end_date) : null,
    daysRemaining,
    message,
  };
}

/**
 * Check subscription by school ID
 */
export async function isSubscriptionActiveBySchoolId(schoolId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT a.subscription_status, a.subscription_end_date 
     FROM accounts a
     JOIN users u ON u.account_id = a.id
     JOIN schools s ON s.admin_id = u.id
     WHERE s.id = $1
     LIMIT 1`,
    [schoolId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  const account = result.rows[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (account.subscription_end_date) {
    const endDate = new Date(account.subscription_end_date);
    endDate.setHours(0, 0, 0, 0);

    if (endDate < today) {
      return false;
    }
  }

  const activeStatuses = ['active', 'trialing', 'paid'];
  return activeStatuses.includes(account.subscription_status);
}

/**
 * Validate subscription before allowing operations
 * Throws error if subscription is expired
 */
export async function validateSubscription(accountId: string): Promise<void> {
  const status = await getSubscriptionStatus(accountId);
  
  if (!status.isActive) {
    throw createError(
      status.message || "Your subscription has expired. Please renew to continue using the service.",
      403
    );
  }
}

/**
 * Validate subscription by school ID
 * Throws error if subscription is expired
 */
export async function validateSubscriptionBySchoolId(schoolId: string): Promise<void> {
  const result = await pool.query(
    `SELECT a.id, a.subscription_status, a.subscription_end_date 
     FROM accounts a
     JOIN users u ON u.account_id = a.id
     JOIN schools s ON s.admin_id = u.id
     WHERE s.id = $1
     LIMIT 1`,
    [schoolId]
  );

  if (result.rows.length === 0) {
    throw createError("School or account not found", 404);
  }

  const account = result.rows[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let message = "Your subscription has expired. Please renew to continue using the service.";

  if (account.subscription_end_date) {
    const endDate = new Date(account.subscription_end_date);
    endDate.setHours(0, 0, 0, 0);

    if (endDate < today) {
      const daysExpired = Math.ceil((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
      message = `Your subscription expired ${daysExpired} day(s) ago. Please renew to continue.`;
      throw createError(message, 403);
    }
  }

  const activeStatuses = ['active', 'trialing', 'paid'];
  if (!activeStatuses.includes(account.subscription_status)) {
    message = `Your subscription is ${account.subscription_status}. Please contact support or renew your subscription.`;
    throw createError(message, 403);
  }
}
