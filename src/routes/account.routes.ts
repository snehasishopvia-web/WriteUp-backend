import { Router } from "express";
import {
  createAccount,
  getAccountById,
  getAccountWithPlan,
  getAllAccounts,
  updateAccount,
  deleteAccount,
} from "../controllers/account.controller.js";

const router = Router();

/**
 * @route   POST /api/v1/accounts
 * @desc    Create a new account
 * @access  Public (for now - will be restricted later)
 */
router.post("/", createAccount);

/**
 * @route   GET /api/v1/accounts
 * @desc    Get all accounts
 * @access  Public (for now)
 */
router.get("/", getAllAccounts);

/**
 * @route   GET /api/v1/accounts/:id
 * @desc    Get account by ID
 * @access  Public (for now)
 */
router.get("/:id", getAccountById);

/**
 * @route   GET /api/v1/accounts/:id/with-plan
 * @desc    Get account with plan details
 * @access  Public (for now)
 */
router.get("/:id/with-plan", getAccountWithPlan);

/**
 * @route   PUT /api/v1/accounts/:id
 * @desc    Update account
 * @access  Public (for now)
 */
router.put("/:id", updateAccount);

/**
 * @route   DELETE /api/v1/accounts/:id
 * @desc    Delete account
 * @access  Public (for now)
 */
router.delete("/:id", deleteAccount);

export default router;
