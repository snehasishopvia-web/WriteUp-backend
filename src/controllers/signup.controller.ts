import { Request, Response, NextFunction } from "express";
import { pool } from "../config/postgres.db.js";
import { UserModel } from "../models/user.model.js";
import { asyncHandler, createError } from "../middleware/error.middleware.js";
import { sendVerificationEmail } from "../utils/email.utils.js";
import axios from "axios";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { setAuthCookies } from "@/utils/cookie.utils.js";
import { generateTokensAccount } from "@/utils/jwt.utils.js";
import { AccountModel } from "@/models/account.model.js";

// Check if email exists
export const checkEmailExists = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) throw createError("Email is required", 400);

    const apiKey = process.env.KICKBOX_API_KEY;
    if (!apiKey) throw createError("Kickbox API key not configured", 500);

    try {
      const { data } = await axios.get(`https://api.kickbox.com/v2/verify`, {
        params: { email, apikey: apiKey },
      });

      const isDeliverable =
        data.result === "deliverable" && data.reason !== "invalid_email";

      res.json({
        success: true,
        exists: isDeliverable,
        message: isDeliverable
          ? "Email appears valid and deliverable"
          : "Email address does not appear to exist",
        kickbox_result: data.result,
      });
    } catch (err: any) {
      console.error("Verification error:", err.response?.data || err.message);
      res.status(400).json({
        success: false,
        message: "Email verification failed",
        error: err.response?.data || err.message,
      });
    }
  }
);

// Create user (Signup)
export const createSignupUser = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, password, school_name, selected_plan } = req.body;

    if (!email || !password || !school_name || !selected_plan)
      throw createError("Please fill all required fields.", 400);

    // Check if user already exists
    const exists = await AccountModel.existsByEmail(email);
    if (exists)
      throw createError(
        "This email is already registered. Try logging in.",
        400
      );

    const hashedPassword = await bcrypt.hash(password, 12);
    const signupToken = jwt.sign({ email }, process.env.SECRET_KEY!);

    // Transaction block
    const client = await AccountModel.getClient();
    try {
      await client.query("BEGIN");

      const account = await AccountModel.createAccount(
        email,
        hashedPassword,
        selected_plan,
        signupToken,
        school_name
      );

      const plan = await AccountModel.getPlanById(selected_plan);
      await sendVerificationEmail(email, signupToken, plan);

      await client.query("COMMIT");

      res.status(201).json({
        success: true,
        message: "Signup initiated. Verification email sent.",
        data: account,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Signup Error:", error);
      throw error;
    } finally {
      client.release();
    }
  }
);

// Verify email
export const verifyEmailToken = asyncHandler(
  async (req: Request, res: Response) => {
    const token = req.query.token as string;
    if (!token) throw createError("Missing verification token", 400);

    const decoded: any = jwt.verify(token, process.env.SECRET_KEY!);
    const email = decoded.email;
    if (!email) throw createError("Invalid token payload", 400);

    const account = await AccountModel.findBySignUpEmail(email);
    if (!account) throw createError("Account not found", 404);

    if (account.email_verified) {
      return res.json({
        success: true,
        message: "Email already verified.",
        data: account,
      });
    }

    const updated = await AccountModel.verifyEmail(email);

    const tokens = generateTokensAccount({
      accountId: updated.id,
      email: updated.owner_email,
    });

    setAuthCookies(res, tokens.access, tokens.refresh);

    return res.json({
      success: true,
      message: "Email verified successfully!",
      data: updated,
      accessToken: tokens.access,
    });
  }
);

// Resend verification email
export const resendVerificationEmail = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) throw createError("Email is required", 400);

    const account = await AccountModel.findBySignUpEmail(email);
    if (!account) throw createError("Account not found", 404);
    if (account.email_verified)
      throw createError("Email already verified", 400);

    const token = jwt.sign({ email }, process.env.SECRET_KEY!);
    await AccountModel.updateSignupToken(email, token);

    const plan = account.plan_id
      ? await AccountModel.getPlanById(account.plan_id)
      : { name: "Unknown Plan", price_monthly: 0 };

    await sendVerificationEmail(email, token, plan);

    res.json({
      success: true,
      message: "Verification email resent successfully.",
    });
  }
);

// Get onboarding status
export const getSignupStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.params;
    if (!email) throw createError("Email is required", 400);

    const status = await AccountModel.getSignupStatus(email);
    if (!status) throw createError("Account not found", 404);

    res.json({
      success: true,
      data: status,
    });
  }
);

// Update onboarding step
export const updateOnboardingStep = asyncHandler(
  async (req: Request, res: Response) => {
    const { step } = req.body;
    const userId = req.user?.id;
    if (!userId) throw createError("Not authorized", 401);
    if (!step) throw createError("Step is required", 400);

    const result = await AccountModel.updateOnboardingStep(userId, step);
    if (!result) throw createError("Account not found", 404);

    res.json({
      success: true,
      message: "Onboarding step updated",
      data: result,
    });
  }
);

// Change selected plan
export const changeSelectedPlan = asyncHandler(
  async (req: Request, res: Response) => {
    const { user_id, new_plan } = req.body;
    if (!user_id) throw createError("Account ID is required", 400);
    if (!new_plan) throw createError("New plan ID is required", 400);

    const result = await AccountModel.changePlan(user_id, new_plan);
    if (!result) throw createError("Account not found", 404);

    res.json({
      success: true,
      message: "Plan updated successfully",
      data: result,
    });
  }
);

// Finalize signup (after payment)
export const completeSignupAfterPayment = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { payment_status } = req.body;
    if (!userId) throw createError("Not authorized", 401);
    if (!payment_status) throw createError("Payment status is required", 400);

    const status = payment_status === "paid" ? "paid" : "failed";
    const result = await AccountModel.completeSignup(userId, status);

    // after payment wich portal to redirect based on the plan slug
    let portal = "student";

    if (status === "paid") {
      const accountWithPlan = await AccountModel.getWithPlan(userId);

      if (accountWithPlan) {
        const { plan_slug } = accountWithPlan;

        switch (plan_slug) {
          case "Personal":
            portal = "student";
            break;

          case "Single Class":
            portal = "teacher";
            break;

          case "Multi-Class":
            portal = "admin";
            break;

          case "Department":
            portal = "admin";
            break;

          case "School":
            portal = "admin";
            break;

          default:
            portal = "student";
            break;
        }
      }
    }

    res.json({
      success: true,
      message:
        status === "paid"
          ? "Signup completed successfully!"
          : "Payment failed.",
      data: {
        ...result,
        portal,
      },
    });
  }
);
