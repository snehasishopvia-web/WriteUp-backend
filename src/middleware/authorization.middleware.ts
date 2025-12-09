import { Request, Response, NextFunction } from "express";
import { createError } from "./error.middleware.js";
import { UserModel } from "../models/user.model.js";

// Role authorization middleware
const roleAuthorization = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.roleId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (!allowedRoles.includes(req.roleId)) {
      res.status(403).json({
        success: false,
        message: "Insufficient permissions",
        userRole: req.roleId,
        allowedRoles: allowedRoles,
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to ensure user has admin role
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw createError("Authentication required", 401);

    const user = await UserModel.findById(req.user.id);

    if (!user) throw createError("User not found", 404);

    if (user.user_type !== "admin" && user.user_type !== "sy_admin")
      throw createError("Access denied. Admin privileges required.", 403);

    next();
  } catch (error) {
    next(error);
  }
};

export default roleAuthorization;
