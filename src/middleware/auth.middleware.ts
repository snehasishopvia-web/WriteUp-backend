import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, JWTPayload, verifyAccessTokenAccount, JWTPayloadAccount } from "../utils/jwt.utils.js";
import { createError } from "./error.middleware.js";
import { UserModel } from "../models/user.model.js";
import { SchoolModel } from "@/models/school.model.js";
import { AccountModel } from "@/models/account.model.js";

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const isProduction = process.env.NODE_ENV === "production";
    let token: string | undefined;

    if (isProduction) token = req.cookies?.access_token;
    else {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer "))
        token = authHeader.split(" ")[1];
    }

    if (!token)
      throw createError(
        "Authentication required. Please provide a valid token.",
        401
      );

    let decoded: JWTPayload;
    try {
      decoded = verifyAccessToken(token);
    } catch (error: any) {
      if (error.name === "TokenExpiredError")
        throw createError("Your token has expired. Please log in again.", 401);

      if (error.name === "JsonWebTokenError")
        throw createError("Invalid token. Please log in again.", 401);

      throw error;
    }

    const userId = decoded.userId;
    if (!userId)
      throw createError("Token is missing user context.", 401);

    const user = await UserModel.findById(userId);

    if (!user) throw createError("User not found. Please log in again.", 401);

    if (!user.is_active)
      throw createError("Your account has been deactivated.", 403);

    let schoolId: string | null = null;
    if (user.user_type === "sy_admin") {
      req.isSysAdmin = true;
      return next();
    } else if (user.user_type === "admin") {
      const school = await SchoolModel.findByAdmin(user.id);

      schoolId = school?.id || null;
      req.school = school || undefined;
    } else if (user.user_type === "teacher" || user.user_type === "student") {
      if (!user.school_id)
        throw createError("User is not associated with any school", 404);

      schoolId = user.school_id;

      const school = await SchoolModel.findById(schoolId);
      if (school) req.school = school;
      else throw createError("Associated school not found", 404);
    }
     else
      throw createError(
        "Invalid user type. Cannot determine school association.",
        403
      );

    req.schoolId = schoolId;
    // req.userId = userId;
    req.user = {
      id: userId,
      email: decoded.email,
      user_type: user.user_type,
    };
    req.roleId = user.user_type;
    next();
  } catch (error) {
    next(error);
  }
};

export const authenticateWithoutSchool = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const isProduction = process.env.NODE_ENV === "production";
    let token: string | undefined;

    if (isProduction) token = req.cookies?.access_token;
    else {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer "))
        token = authHeader.split(" ")[1];
    }

    if (!token)
      throw createError(
        "Authentication required. Please provide a valid token.",
        401
      );

    let decoded: JWTPayload;
    try {
      decoded = verifyAccessToken(token);
    } catch (error: any) {
      if (error.name === "TokenExpiredError")
        throw createError("Your token has expired. Please log in again.", 401);

      if (error.name === "JsonWebTokenError")
        throw createError("Invalid token. Please log in again.", 401);

      throw error;
    }

    const userId = decoded.userId;
    if (!userId)
      throw createError("Token is missing user context.", 401);

    const user = await UserModel.findById(userId);

    if (!user) throw createError("User not found. Please log in again.", 401);

    if (!user.is_active)
      throw createError("Your account has been deactivated.", 403);

    let schoolId: string | null = null;
    if (user.user_type === "sy_admin") {
      req.isSysAdmin = true;
      return next();
    } else if (user.user_type === "admin") {
      const school = await SchoolModel.findByAdmin(user.id);

      schoolId = school?.id || null;
      req.school = school || undefined;
    } else if (user.user_type === "teacher") {
      if (user.school_id) {
        const school = await SchoolModel.findById(user.id);
        schoolId = school?.id || null;
        req.school = school || undefined;
      }
    } 
    req.schoolId = schoolId;
    req.user = {
      id: userId,
      email: decoded.email,
      user_type: user.user_type,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const isProduction = process.env.NODE_ENV === "production";
    let token: string | undefined;

    if (isProduction) {
      token = req.cookies?.access_token;
      if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer "))
          token = authHeader.split(" ")[1];
      }
    } else {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer "))
        token = authHeader.split(" ")[1];
      else token = req.cookies?.access_token;
    }

    if (!token) return next();

    try {
      const decoded = verifyAccessToken(token);
      const userId = decoded.userId;
      if (!userId) return next();
      const user = await UserModel.findById(userId);

      if (user && user.is_active)
        req.user = {
          id: userId,
          email: decoded.email,
          user_type: user.user_type,
        };
    } catch (error) {}

    next();
  } catch (error) {
    next(error);
  }
};

export const authenticateAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const isProduction = process.env.NODE_ENV === "production";
    let token: string | undefined;

    if (isProduction) {
      
      token = req.cookies?.access_token;
      console.log("Token from cookie:", token);
    } else {
      console.log("Running in development mode");
      const authHeader = req.headers.authorization;
      console.log("Authorization header:", authHeader);
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
        console.log("Token from header:", token);
      }
    }

    if (!token) {
      console.log("No token found");
      throw createError(
        "Authentication required. Please provide a valid token.",
        401
      );
    }

    let decoded: JWTPayloadAccount;
    try {
      decoded = verifyAccessTokenAccount(token);
    } catch (error: any) {
      console.log("Token verification failed:", error);
      if (error.name === "TokenExpiredError") {
        throw createError("Your token has expired. Please log in again.", 401);
      }
      if (error.name === "JsonWebTokenError") {
        throw createError("Invalid token. Please log in again.", 401);
      }
      throw error;
    }

    const accountId = decoded.accountId;
    if (!accountId) {
      console.log("Token does not contain account information");
      throw createError("Token does not contain account information.", 401);
    }
    console.log("Account ID from token:", accountId);

    const account = await AccountModel.findById(accountId);
    if (!account) {
      console.log("Account not found for ID:", accountId);
      throw createError("Account not found. Please log in again.", 401);
    }
    console.log("Account found:", account);

    req.accountId = account.id;
    req.account = account;

    console.log("Authentication successful, proceeding to next middleware.");
    next();
  } catch (error) {
    console.log("Error in authenticateAccount middleware:", error);
    next(error);
  }
};
