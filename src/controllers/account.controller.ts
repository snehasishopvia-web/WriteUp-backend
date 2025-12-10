import { Request, Response, NextFunction } from "express";
import { asyncHandler, createError } from "../middleware/error.middleware.js";
import { AccountModel } from "../models/account.model.js";
import { CreateAccountDTO, UpdateAccountDTO } from "../types/account.types.js";

/**
 * Calculate subscription status relative to today
 * Returns:
 * - "active": subscription is active
 * - "expiring_soon": subscription expires within 7 days
 * - "expired": subscription has expired
 */
interface SubscriptionStatusInfo {
  status: "active" | "expiring_soon" | "expired";
  daysRemaining: number;
  expiryDate: string | null;
  subscriptionStatus: string;
}

function getSubscriptionStatusInfo(
  subscriptionStatus: string,
  subscriptionEndDate: string | null
): SubscriptionStatusInfo {
  if (!subscriptionEndDate) {
    return {
      status: "active",
      daysRemaining: Infinity,
      expiryDate: null,
      subscriptionStatus,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const endDate = new Date(subscriptionEndDate);
  endDate.setHours(0, 0, 0, 0);
  
  const timeDiff = endDate.getTime() - today.getTime();
  const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));

  let status: "active" | "expiring_soon" | "expired";
  
  if (daysRemaining <= 0) {
    status = "expired";
  } else if (daysRemaining <= 7) {
    status = "expiring_soon";
  } else {
    status = "active";
  }

  return {
    status,
    daysRemaining: Math.max(daysRemaining, 0),
    expiryDate: subscriptionEndDate,
    subscriptionStatus,
  };
}

/**
 * @route   POST /api/v1/accounts
 * @desc    Create a new account
 * @access  Public (for now - will be restricted later)
 */
export const createAccount = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      owner_email,
      owner_name,
      company_name,
      plan_id,
      subscription_status,
      subscription_start_date,
      subscription_end_date,
      billing_cycle,
      phone,
      address,
      timezone,
    } = req.body;

    // Validation
    if (!owner_email || !owner_name || !plan_id) {
      throw createError("owner_email, owner_name, and plan_id are required", 400);
    }

    // Check if account with this email already exists
    const existingAccount = await AccountModel.findByEmail(owner_email);
    if (existingAccount) {
      throw createError("Account with this email already exists", 400);
    }

    const data: CreateAccountDTO = {
      owner_email,
      owner_name,
      company_name,
      plan_id,
      subscription_status,
      subscription_start_date,
      subscription_end_date,
      billing_cycle,
      phone,
      address,
      timezone,
    };

    const account = await AccountModel.create(data);

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: account,
    });
  }
);

/**
 * @route   GET /api/v1/accounts/:id
 * @desc    Get account by ID
 * @access  Public (for now)
 */
export const getAccountById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!id) {
      throw createError("Account ID is required", 400);
    }

    const account = await AccountModel.findById(id);

    if (!account) {
      throw createError("Account not found", 404);
    }

    res.status(200).json({
      success: true,
      data: account,
    });
  }
);

/**
 * @route   GET /api/v1/accounts/:id/subscription-status
 * @desc    Get account subscription status including expiry info
 * @access  Public (for now)
 */
export const getSubscriptionStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    
    const accountId = req.accountId;

    if (!accountId) {
      throw createError("Account ID is required from token", 400);
    }

    const account = await AccountModel.findById(accountId);

    if (!account) {
      throw createError("Account not found", 404);
    }

    // Convert subscription_end_date to string or null
    let endDateStr: string | null = null;
    const endDateVal = account.subscription_end_date;
    if (endDateVal !== undefined && endDateVal instanceof Date) {
      endDateStr = endDateVal.toISOString().split("T")[0];
    } else if (typeof endDateVal === "string" && endDateVal) {
      endDateStr = endDateVal;
    } else {
      endDateStr = null;
    }

    const statusInfo = getSubscriptionStatusInfo(
      account.subscription_status,
      endDateStr
    );

    res.status(200).json({
      success: true,
      data: {
        accountId: account.id,
        accountName: account.owner_name,
        companyName: account.company_name,
        planId: account.plan_id,
        ...statusInfo,
      },
    });
  }
);

/**
 * @route   GET /api/v1/accounts/:id/with-plan
 * @desc    Get account with plan details
 * @access  Public (for now)
 */
export const getAccountWithPlan = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!id) {
      throw createError("Account ID is required", 400);
    }

    const account = await AccountModel.getWithPlan(id);

    if (!account) {
      throw createError("Account not found", 404);
    }

    res.status(200).json({
      success: true,
      data: account,
    });
  }
);

/**
 * @route   GET /api/v1/accounts
 * @desc    Get all accounts
 * @access  Public (for now)
 */
export const getAllAccounts = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const accounts = await AccountModel.getAll();

    res.status(200).json({
      success: true,
      count: accounts.length,
      data: accounts,
    });
  }
);

/**
 * @route   PUT /api/v1/accounts/:id
 * @desc    Update account
 * @access  Public (for now)
 */
export const updateAccount = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!id) {
      throw createError("Account ID is required", 400);
    }

    const data: UpdateAccountDTO = req.body;

    // Check if account exists
    const existingAccount = await AccountModel.findById(id);
    if (!existingAccount) {
      throw createError("Account not found", 404);
    }

    // If updating email, check if new email is already taken
    if (data.owner_email && data.owner_email !== existingAccount.owner_email) {
      const emailExists = await AccountModel.findByEmail(data.owner_email);
      if (emailExists) {
        throw createError("Account with this email already exists", 400);
      }
    }

    const account = await AccountModel.update(id, data);

    res.status(200).json({
      success: true,
      message: "Account updated successfully",
      data: account,
    });
  }
);

/**
 * @route   DELETE /api/v1/accounts/:id
 * @desc    Delete account
 * @access  Public (for now)
 */
export const deleteAccount = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!id) {
      throw createError("Account ID is required", 400);
    }

    const deleted = await AccountModel.delete(id);

    if (!deleted) {
      throw createError("Account not found", 404);
    }

    res.status(200).json({
      success: true,
      message: "Account deleted successfully",
    });
  }
);
