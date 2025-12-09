import { Request, Response, NextFunction } from "express";
import { asyncHandler, createError } from "./error.middleware.js";
import { validateSubscriptionBySchoolId } from "../utils/subscription.utils.js";

/**
 * to check if subscription is active before allowing operations
 */
export const checkSubscriptionStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.schoolId) {
      throw createError("School ID is required", 400);
    }

    // Validate subscription - throws error if expired
    await validateSubscriptionBySchoolId(req.schoolId);

    next();
  }
);
