import { Request, Response, NextFunction } from "express";
import { asyncHandler, createError } from "./error.middleware.js";
import {
  checkTeacherLimit,
  checkStudentLimit,
  PlanLimitCheck,
} from "../utils/plan-limits.utils.js";

/**
 * Extended request interface with plan limit check results
 */
declare global {
  namespace Express {
    interface Request {
      planLimitCheck?: PlanLimitCheck;
      schoolId?: string;
      school?: any;
    }
  }
}

/**
 * to check if adding teachers would exceed plan limits
 * attaches the check result to req.planLimitCheck
 * use additionalCount from req.body or default to 1
 */
export const checkTeacherLimitMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.schoolId) {
      throw createError("School ID is required", 400);
    }

    // Try to determine how many teachers are being added
    let additionalTeachers = 1;

    // For CSV uploads, we can't check until we parse the file
    if (req.file) {
      return next();
    }

  
    if (req.body.emails && Array.isArray(req.body.emails)) {
      additionalTeachers = req.body.emails.length;
    }

    const check = await checkTeacherLimit(req.schoolId, additionalTeachers);
    req.planLimitCheck = check;

    if (!check.allowed) {
      throw createError(
        `Teacher limit exceeded. ${check.message} Please upgrade your plan to add more teachers.`,
        403
      );
    }

    next();
  }
);

/**
 * to check if adding students would exceed plan limits
 * attaches the check result to req.planLimitCheck
 */
export const checkStudentLimitMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.schoolId) {
      throw createError("School ID is required", 400);
    }

    // Try to determine how many students are being added
    let additionalStudents = 1;

    // For csv uploads, we can't check until we parse the file
    if (req.file) {
      return next();
    }

    const check = await checkStudentLimit(req.schoolId, additionalStudents);
    req.planLimitCheck = check;

    if (!check.allowed) {
      throw createError(
        `Student limit exceeded. ${check.message} Please upgrade your plan to add more students.`,
        403
      );
    }

    next();
  }
);
