import { Request, Response, NextFunction } from "express";
import { ClassModel } from "../models/class.model.js";
import { ClassMemberModel } from "../models/class-member.model.js";

/**
 * Check if user can manage class (creator, admin, or teacher)
 */
export const canManageClass = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const classId = req.query.classId || req.query.id;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (!classId) {
      res.status(400).json({
        success: false,
        message: "Class ID is required",
      });
      return;
    }

    const classData = await ClassModel.findById(classId as string);
    if (!classData) {
      res.status(404).json({
        success: false,
        message: "Class not found",
      });
      return;
    }

    // Check if user is creator
    if (classData.creator_id === userId) {
      next();
      return;
    }

    // Check if user is admin in the class
    const isAdmin = await ClassMemberModel.hasRole(classId as string, userId, "admin");
    if (isAdmin) {
      next();
      return;
    }

    // Check if user is teacher in the class
    const isTeacher = await ClassMemberModel.hasRole(
      classId as string,
      userId,
      "teacher"
    );
    if (isTeacher) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      message: "You don't have permission to manage this class",
    });
  } catch (error) {
    console.error("Error in canManageClass middleware:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Check if user is a member of the class
 */
export const isMemberOfClass = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const classId = req.query.classId || req.query.id;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (!classId) {
      res.status(400).json({
        success: false,
        message: "Class ID is required",
      });
      return;
    }

    const isMember = await ClassMemberModel.isMember(classId as string, userId);
    if (!isMember) {
      res.status(403).json({
        success: false,
        message: "You are not a member of this class",
      });
      return;
    }

    next();
  } catch (error) {
    console.error("Error in isMemberOfClass middleware:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Check if user is creator of the class
 */
export const isClassCreator = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const classId = req.params.classId || req.params.id;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (!classId) {
      res.status(400).json({
        success: false,
        message: "Class ID is required",
      });
      return;
    }

    const classData = await ClassModel.findById(classId);
    if (!classData) {
      res.status(404).json({
        success: false,
        message: "Class not found",
      });
      return;
    }

    if (classData.creator_id !== userId) {
      res.status(403).json({
        success: false,
        message: "Only the class creator can perform this action",
      });
      return;
    }

    next();
  } catch (error) {
    console.error("Error in isClassCreator middleware:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
