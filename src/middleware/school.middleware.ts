import { Request, Response, NextFunction } from "express";
import { asyncHandler, createError } from "./error.middleware.js";

export const attachSchool = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) throw createError("User not authenticated", 401);

    if (req.user.user_type === "admin" && !req.schoolId)
      throw createError(
        "No school found. Please complete onboarding first.",
        404
      );

    next();
  }
);
