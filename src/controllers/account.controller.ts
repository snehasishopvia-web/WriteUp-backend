import { Request, Response, NextFunction } from "express";
import { asyncHandler, createError } from "../middleware/error.middleware.js";
import { AccountModel } from "../models/account.model.js";
import { CreateAccountDTO, UpdateAccountDTO } from "../types/account.types.js";

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
