import bcrypt from "bcryptjs";
import { Request, Response, NextFunction } from "express";
import {
  UserModel,
  CreateUserDTO,
  UpdateUserDTO,
} from "../models/user.model.js";
import { generateTokens, verifyRefreshToken } from "../utils/jwt.utils.js";
import { asyncHandler, createError } from "../middleware/error.middleware.js";
import {
  setAuthCookies,
  clearAuthCookies,
  setAccessTokenCookie,
} from "../utils/cookie.utils.js";
import { pool } from "../config/postgres.db.js";
import { SchoolModel } from "../models/school.model.js";
import sgMail from "@sendgrid/mail";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { AccountModel } from "@/models/account.model.js";
import { PlanModel } from "@/models/plan.model.js";
import { PaymentModel } from "@/models/payment.model.js";

// Set up SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

// Temporary in-memory OTP store
const otpStore: Record<string, { otp: string; expiresAt: number }> = {};

// Blacklist for refresh tokens (Need to change this for production, use Redis or database)
const tokenBlacklist = new Set<string>();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user with transaction support
 * @access  Public
 */
export const register = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      email,
      password,
      password_confirm,
      first_name,
      last_name,
      phone,
      date_of_birth,
      user_type,
    } = req.body;

    const client = await pool.connect();
    try {
      if (password !== password_confirm)
        throw createError("Passwords do not match", 400);
      const hashedPassword = await bcrypt.hash(password, 12);

      const existingUser = await UserModel.findByEmail(email);
      if (existingUser)
        throw createError("User with this email already exists", 400);

      await client.query("BEGIN");
      const validTypes = ["student", "teacher", "admin"];
      const userData: CreateUserDTO = {
        email,
        password: hashedPassword,
        first_name,
        last_name,
        phone,
        account_id: null,
        date_of_birth: date_of_birth ? new Date(date_of_birth) : undefined,
        user_type: validTypes.includes(req.body.user_type)
          ? req.body.user_type
          : "student",
        address: null
      };

      const user = await UserModel.create(userData, client);

      const tokens = generateTokens({
        userId: user.id,
        email: user.email,
        user_type: user.user_type,
      });

      await client.query("COMMIT");

      // Set cookies (after successful commit)
      setAuthCookies(res, tokens.access, tokens.refresh);

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user: UserModel.sanitizeUser(user),
          access: tokens.access,
          refresh: tokens.refresh,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  }
);

/**
 * @route   POST /api/v1/auth/token
 * @desc    Login user / Get tokens
 * @access  Public
 */
export const login = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log("#################@@@", req.body);
      const { email, password } = req.body;

      let user;
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (isEmail) {
        console.log("$$");
        // If it's a valid email format, find by email
        user = await UserModel.findByEmail(email);
      } else {
        console.log("@@");
        // Otherwise, treat the same input as a username
        user = await UserModel.findByUsername(email);
      }

      // const user = await UserModel.findByEmail(email);
      console.log("!!!!!!!!!", user);
      if (!user) throw createError("Invalid email or password", 401);

      if (!user.is_active)
        throw createError("Your account has been deactivated", 403);

      const isPasswordValid = await UserModel.comparePassword(
        password,
        user.password
      );
      console.log("^^^^^^^^^^^", isPasswordValid);
      if (!isPasswordValid) throw createError("Invalid email or password", 401);

      const clientIp = req.ip || req.socket.remoteAddress;
      await UserModel.updateLastLogin(user.id, clientIp);
      console.log(")))))))))))", clientIp);

      const tokens = generateTokens({
        userId: user.id,
        email: user.email || user.username,
        user_type: user.user_type,
      });

      setAuthCookies(res, tokens.access, tokens.refresh);

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          user: UserModel.sanitizeUser(user),
          access: tokens.access,
          refresh: tokens.refresh,
        },
      });
    } catch (error) {
      console.log("Error occured login route 'token' - ", error);
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/auth/token/refresh
 * @desc    Refresh access token
 * @access  Public
 */
export const refreshToken = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // In production: prefer cookies, in dev: prefer body
    const isProduction = process.env.NODE_ENV === "production";
    const refresh = isProduction
      ? req.cookies?.refresh_token || req.body.refresh
      : req.body.refresh || req.cookies?.refresh_token;

    if (!refresh) throw createError("Refresh token is required", 400);

    if (tokenBlacklist.has(refresh))
      throw createError("Token has been revoked", 401);

    let decoded;
    try {
      decoded = verifyRefreshToken(refresh);
    } catch (error: any) {
      if (error.name === "TokenExpiredError")
        throw createError(
          "Refresh token has expired. Please log in again.",
          401
        );

      throw createError("Invalid refresh token", 401);
    }

    const user = await UserModel.findById(decoded.userId);
    if (!user) throw createError("User not found", 401);

    if (!user.is_active)
      throw createError("Your account has been deactivated", 403);

    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      user_type: user.user_type,
    });

    tokenBlacklist.add(refresh);

    setAuthCookies(res, tokens.access, tokens.refresh);

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        access: tokens.access,
        refresh: tokens.refresh,
      },
    });
  }
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user (blacklist refresh token)
 * @access  Private
 */
export const logout = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // In production: prefer cookies, in dev: prefer body
    const isProduction = process.env.NODE_ENV === "production";
    const refresh = isProduction
      ? req.cookies?.refresh_token || req.body.refresh
      : req.body.refresh || req.cookies?.refresh_token;

    if (refresh) tokenBlacklist.add(refresh);

    clearAuthCookies(res);

    res.status(200).json({
      success: true,
      message: "Successfully logged out",
    });
  }
);

/**
 * @route   GET /api/v1/auth/user
 * @desc    Get current user profile with school data
 * @access  Private
 */
export const getUserProfile = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw createError("User not authenticated", 401);
    }

    const user = await UserModel.findById(req.user.id);

    if (!user) {
      throw createError("User not found", 404);
    }

    let schoolData = null;
    let planSlug = null;
    let totalTeacher = 0;
    let extraTeacher = 0;

    // school
    if (user.school_id) {
      const school = await SchoolModel.findById(user.school_id);
      if (school) {
        schoolData = SchoolModel.sanitizeSchool(school);
      }
    }

    // account — do NOT throw error if missing
    let account = null;
    if (user.account_id) {
      account = await AccountModel.findById(user.account_id);
    }

    // plan
    if (account?.plan_id) {
      const plan = await PlanModel.findById(account.plan_id);
      if (plan) {
        planSlug = plan.slug;
        totalTeacher = plan.max_teachers_per_school ?? 0;
      }
    }

    if (user.id) {
      const latestPayment = await PaymentModel.findLatestPaymentByAccountId(
        user.account_id
      );

      if (latestPayment?.addons?.teachers !== undefined) {
        extraTeacher = latestPayment.addons.teachers;
      }
    }
    console.log(
      "++++++++++++++++++++++++++++++++++++++++++++++++++++++=",
      planSlug,
      totalTeacher,
      extraTeacher
    );

    const sanitizedUser = UserModel.sanitizeUser(user);
    const userWithSchool = {
      ...sanitizedUser,
      school_name: schoolData?.name || null
    };

    return res.status(200).json({
      success: true,
      data: {
        user: userWithSchool,
        has_school: !!schoolData,
        schoolData,
        plan_slug: planSlug,
        total_teacher: totalTeacher,
        extra_teacher: extraTeacher,
      },
    });
  }
);

/**
 * @route   PUT /api/v1/auth/user
 * @desc    Update user profile
 * @access  Private
 */
export const updateUserProfile = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) throw createError("User not authenticated", 401);

    const updateData: UpdateUserDTO = {
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      phone: req.body.phone,
      date_of_birth: req.body.date_of_birth
        ? new Date(req.body.date_of_birth)
        : undefined,
      gender: req.body.gender,
      address: req.body.address,
      profile_picture: req.body.profile_picture,
      timezone: req.body.timezone,
      language: req.body.language,
    };

    Object.keys(updateData).forEach(
      (key) =>
        updateData[key as keyof UpdateUserDTO] === undefined &&
        delete updateData[key as keyof UpdateUserDTO]
    );

    const updatedUser = await UserModel.update(req.user.id, updateData);

    if (!updatedUser) throw createError("User not found", 404);

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: UserModel.sanitizeUser(updatedUser),
      },
    });
  }
);

/**
 * @route   POST /api/v1/auth/password-reset
 * @desc    Request password reset
 * @access  Public
 */
export const requestPasswordReset = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email } = req.body;
    if (!email) throw createError("Email is required", 400);

    const user = await UserModel.findByEmail(email);

    // Always return success to avoid exposing emails
    res.status(200).json({
      success: true,
      message:
        "If an account exists with this email, a reset link has been sent.",
    });

    if (!user) return;

    // Generate secure random token( 1 hour)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Save token to DB
    await pool.query(
      `INSERT INTO password_resets (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
      [user.id, token, expiresAt]
    );

    const frontendUrls = {
      admin: process.env.ADMIN_FRONTEND_URL,
      student: process.env.STUDENT_FRONTEND_URL,
      teacher: process.env.TEACHER_FRONTEND_URL,
    };

    const FRONTEND_URL =
      frontendUrls[user.user_type as keyof typeof frontendUrls] ||
      process.env.STUDENT_FRONTEND_URL;
    // Create reset link (Frontend URL)
    const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;

    // Send email via SendGrid
    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL!,
      templateId: process.env.SENDGRID_OTP_TEMPLETE_ID!,
      dynamicTemplateData: {
        subject: "Password Reset Request",
        username: user.first_name || user.username || "User",
        reset_link: resetLink,
      },
    };

    try {
      await sgMail.send(msg);
      console.log(`Password reset link sent to ${email}: ${resetLink}`);
    } catch (err) {
      console.error("Error sending reset email:", err);
    }
  }
);

/**
 * @route   POST /api/v1/auth/password-reset/confirm
 * @desc    Reset password with token
 * @access  Public
 */
export const resetPassword = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { token, password, password_confirm } = req.body;

    if (!token || !password || !password_confirm)
      throw createError("Token and passwords are required", 400);

    if (password !== password_confirm)
      throw createError("Passwords do not match", 400);

    const result = await pool.query(
      `SELECT * FROM password_resets WHERE token = $1 AND used = false`,
      [token]
    );

    const record = result.rows[0];
    if (!record) throw createError("Invalid or used token", 400);

    if (new Date() > new Date(record.expires_at))
      throw createError("Reset link has expired", 400);

    const user = await UserModel.findById(record.user_id);
    if (!user) throw createError("User not found", 404);

    // Update password
    await UserModel.changePassword(user.id, password);

    // Mark token as used
    await pool.query(
      `UPDATE password_resets SET used = true WHERE token = $1`,
      [token]
    );

    res.status(200).json({
      success: true,
      message:
        "Password reset successful. You can now log in with your new password.",
    });
  }
);

/**
 * @route   POST /api/v1/auth/check-school-key
 * @desc    Check if provided school key is valid
 * @access  Public
 */
export const checkSchoolKey = asyncHandler(
  async (req: Request, res: Response) => {
    const { school_key } = req.body;
    console.log(school_key);
    if (!school_key) throw createError("School key is required", 400);

    const school = await SchoolModel.findByUniqueKey(school_key);
    if (!school) throw createError("Invalid school key", 404);

    res.status(200).json({
      success: true,
      message: "School key is valid",
      data: { school_id: school.id, school_name: school.name },
    });
  }
);

/**
 * @route   POST /api/v1/auth/student-register(without Email)
 * @desc    Register a new student using school unique key
 * @access  Public
 */
export const studentRegister = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      school_key,
      first_name,
      last_name,
      date_of_birth,
      email,
      password,
    } = req.body;

    const client = await pool.connect();

    try {
      if (
        !school_key ||
        !first_name ||
        !last_name ||
        !date_of_birth ||
        !email ||
        !password
      ) {
        throw createError("All fields are required", 400);
      }

      // Validate school key
      const school = await SchoolModel.findByUniqueKey(school_key);
      if (!school) throw createError("Invalid school key", 400);

      // Check if email already exists
      const existingEmail = await pool.query(
        "SELECT id FROM users WHERE email = $1",
        [email]
      );
      if (existingEmail.rows.length > 0)
        throw createError("Email already registered", 400);

      // --- Generate username ---
      const cleanFirstName = first_name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const dobFormatted = date_of_birth.replace(/-/g, ""); // YYYYMMDD
      let username = `${cleanFirstName}${dobFormatted}`;

      // Check if username already exists
      const existingUsername = await pool.query(
        "SELECT id FROM users WHERE username = $1",
        [username]
      );

      if (existingUsername.rows.length > 0) {
        const randomNum = Math.floor(100 + Math.random() * 900); // 3-digit random
        username = `${username}_${randomNum}`;
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      await client.query("BEGIN");

      const user = await client.query(
        `INSERT INTO users (
          username, email, password, first_name, last_name, user_type, date_of_birth, school_id, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
        RETURNING *`,
        [
          username,
          email,
          hashedPassword,
          first_name,
          last_name,
          "student",
          date_of_birth,
          school.id,
        ]
      );

      await client.query("COMMIT");

      const createdUser = user.rows[0];

      res.status(201).json({
        success: true,
        message: "Student registered successfully",
        data: {
          user: UserModel.sanitizeUser(createdUser),
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  }
);

/**
 * @route   POST /api/v1/auth/student-register-email
 * @desc    Register a new student using Email
 * @access  Public
 */
export const studentRegisterWithEmail = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      email,
      first_name,
      last_name,
      password,
      user_type,
      password_confirm,
      school_key,
    } = req.body;
    console.log("student-register-email => ", req.body);

    const client = await pool.connect();

    try {
      // Basic validation
      if (
        !email ||
        !first_name ||
        !last_name ||
        !user_type ||
        !password ||
        !password_confirm
      ) {
        throw createError("All fields are required", 400);
      }
      if (!school_key) throw createError("Missing school key", 400);
      if (password !== password_confirm) {
        throw createError("Passwords do not match", 400);
      }

      // Check if email already exists
      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        throw createError("A user with this email already exists", 400);
      }

      const school = await SchoolModel.findByUniqueKey(school_key);
      if (!school) throw createError("Invalid school key", 404);

      const hashedPassword = await bcrypt.hash(password, 12);
      // Generate a unique username from name or email
      let baseUsername = `${first_name.toLowerCase()}.${last_name.toLowerCase()}`;
      baseUsername = baseUsername.replace(/\s+/g, "");
      const uniqueSuffix = uuidv4().slice(0, 6);
      const username = `${baseUsername}_${uniqueSuffix}`;

      await client.query("BEGIN");

      // Insert new student record
      const result = await client.query(
        `INSERT INTO users (
    username, email, password, first_name, last_name, user_type, school_id, is_active
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
  RETURNING *`,
        [
          username,
          email,
          hashedPassword,
          first_name,
          last_name,
          user_type,
          school.id,
        ]
      );

      await client.query("COMMIT");

      const newUser = result.rows[0];

      res.status(201).json({
        success: true,
        message: "Student registered successfully",
        data: {
          user: UserModel.sanitizeUser(newUser),
        },
      });
    } catch (error) {
      console.error("Error in studentRegisterWithEmail:", error);
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  }
);

export const getUserPlanDetails = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const userData = await pool.query(
      "SELECT account_id, total_teachers FROM users WHERE id = $1",
      [userId]
    );

    if (userData.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const accountId = userData.rows[0].account_id;
    const totalTeacher = Number(userData.rows[0].total_teachers);

    const accountData = await pool.query(
      "SELECT plan_id, billing_cycle FROM accounts WHERE id = $1",
      [accountId]
    );

    const planId = accountData.rows[0].plan_id;
    const billingCycle= accountData.rows[0].billing_cycle

  
    const planData = await pool.query(
      "SELECT slug, max_teachers_per_school FROM plans WHERE id = $1",
      [planId]
    );

    const plan = planData.rows[0];

    const extraTeacher =
      totalTeacher > plan.max_teachers_per_school
        ? totalTeacher - plan.max_teachers_per_school
        : 0;
   
    return res.json({
      plan_slug: plan.slug,
      total_teacher: totalTeacher,
      extra_teacher: extraTeacher,
      plan_id: planId,
      billing_cycle: billingCycle
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
