import { Request, Response } from "express";
import { UserModel } from "../models/user.model.js";
import { ClassMemberModel } from "../models/class-member.model.js";
import { pool } from "../config/postgres.db.js";
import { PoolClient } from "pg";
import { sendTeacherOnboardEmail } from "@/utils/sendTeacherOnboardEmail.js";
import { sendStudentOnboardEmail } from "@/utils/sendStudentOnboardEmail.utils.js";
import { SchoolModel } from "@/models/school.model.js";
import bcrypt from "bcryptjs";
import { validateTeacherLimit, validateStudentLimit, getPlanUsageSummary } from "@/utils/plan-limits.utils.js";
import { validateSubscriptionBySchoolId } from "@/utils/subscription.utils.js";

export class UserController {
  static async getTeachersByTenant(req: Request, res: Response): Promise<void> {
    try {
      const schoolId = req.schoolId;

      if (!schoolId) {
        res.status(403).json({
          success: false,
          message: "No tenant/school associated with this user",
        });
        return;
      }
      console.log("Fetching teachers for school ID:", schoolId);

      const teachers = await UserModel.findTeachersBySchoolId(schoolId);
      const sanitizedTeachers = teachers.map((teacher) =>
        UserModel.sanitizeUser(teacher)
      );

      res.status(200).json({
        success: true,
        data: sanitizedTeachers,
        count: sanitizedTeachers.length,
      });
    } catch (error) {
      console.error("Error fetching teachers by tenant:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch teachers",
      });
    }
  }

  static async getStudentsByTenant(req: Request, res: Response): Promise<void> {
    try {
      const schoolId = req.schoolId;

      if (!schoolId) {
        res.status(403).json({
          success: false,
          message: "No tenant/school associated with this user",
        });
        return;
      }

      const students = await UserModel.findStudentsBySchoolId(schoolId);
      const sanitizedStudents = students.map((student) =>
        UserModel.sanitizeUser(student)
      );

      res.status(200).json({
        success: true,
        data: sanitizedStudents,
        count: sanitizedStudents.length,
      });
    } catch (error) {
      console.error("Error fetching students by tenant:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch students",
      });
    }
  }

  static async createUser(req: Request, res: Response): Promise<void> {
    const client = await pool.connect();

    try {
      const schoolId = req.schoolId;

      if (!schoolId) {
        res.status(403).json({
          success: false,
          message: "No tenant/school associated with this user",
        });
        return;
      }

      // Check if subscription is active
      await validateSubscriptionBySchoolId(schoolId);

      const {
        email,
        first_name,
        last_name,
        user_type,
        department_id,
        graduation_year,
        classId,
      } = req.body;

      console.log("API data - ", {
        email,
        first_name,
        user_type,
        department_id,
      });

      if (
        !email ||
        !first_name ||
        !user_type ||
        (user_type === "teacher" && !department_id)
      ) {
        res.status(400).json({
          success: false,
          message:
            "Missing required fields: email, firstName, userType, departmentId",
        });
        return;
      }

      // Role-based authorization: Only admins can add teachers
      if (user_type === "teacher" && req.user?.user_type !== "admin" && req.user?.user_type !== "sy_admin") {
        res.status(403).json({
          success: false,
          message: "Only administrators can add teachers. Teachers can only add students.",
        });
        return;
      }

      // Check plan limits before creating user
      if (user_type === "teacher") {
        await validateTeacherLimit(schoolId, 1);
      } else if (user_type === "student") {
        await validateStudentLimit(schoolId, 1);
      }

      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        res.status(409).json({
          success: false,
          message: "User with this email already exists",
        });
        return;
      }

      await client.query("BEGIN");

      // Generate a temporary password (to send this via email)
      const temporaryPassword = "Test@1234" // Math.random().toString(36).slice(-8);

      const newUser = await UserModel.create(
        {
          email,
          password: await bcrypt.hash(temporaryPassword, 12),
          first_name: first_name,
          last_name: last_name,
          user_type: user_type,
          address: null
        },
        client
      );

      // Update user with school_id and department info
      await client.query(
        `UPDATE users
         SET school_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [schoolId, newUser.id]
      );

      // If graduation year is provided for students, update it
      if (user_type === "student" && graduation_year) {
        await client.query(
          `UPDATE users
           SET date_of_birth = $1, updated_at = NOW()
           WHERE id = $2`,
          [new Date(graduation_year, 0, 1), newUser.id]
        );
      }

      // If classId is provided, add user to the class
      if (classId) {
        const isMember = await ClassMemberModel.isMember(classId, newUser.id);

        if (!isMember) {
          await ClassMemberModel.add(classId, {
            user_id: newUser.id,
            role: user_type === "teacher" ? "teacher" : "student",
            joined_via: "direct_add",
          });
        }
      }

      // Commit transaction
      await client.query("COMMIT");

      // Fetch updated user
      const updatedUser = await UserModel.findById(newUser.id);
      const sanitizedUser = UserModel.sanitizeUser(updatedUser!);

      res.status(201).json({
        success: true,
        message: "User created successfully",
        data: {
          user: sanitizedUser,
          temporaryPassword,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error creating user:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create user",
      });
    } finally {
      client.release();
    }
  }

  /**
   * Soft delete a user
   * - Sets user as inactive and records deletion metadata
   * - Removes user from all non-completed classes
   * - Keeps user in completed/archived classes for historical records
   */
  static async deleteUser(req: Request, res: Response): Promise<void> {
    const client: PoolClient = await pool.connect();

    try {
      const { userId } = req.params;
      const adminUserId = req.user?.id; // Admin performing the deletion
      const schoolId = req.schoolId;
      const { reason } = req.body; // Optional deletion reason

      // Validate request
      if (!userId) {
        res.status(400).json({
          success: false,
          message: "User ID is required",
        });
        return;
      }

      if (!adminUserId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      if (!schoolId) {
        res.status(403).json({
          success: false,
          message: "No school/tenant associated with this user",
        });
        return;
      }

      // Check if user exists and belongs to the same school
      const userToDelete = await UserModel.findById(userId);

      if (!userToDelete) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      if (userToDelete.school_id !== schoolId) {
        res.status(403).json({
          success: false,
          message: "You can only delete users from your own school",
        });
        return;
      }

      // Prevent deleting already deleted users
      if (!userToDelete.is_active || userToDelete.deleted_at) {
        res.status(400).json({
          success: false,
          message: "User is already deleted",
        });
        return;
      }

      // Prevent admins from deleting themselves
      if (userToDelete.id === adminUserId) {
        res.status(400).json({
          success: false,
          message: "You cannot delete your own account",
        });
        return;
      }

      // Start transaction
      await client.query("BEGIN");

      // Get user's class statistics before deletion
      const classStats = await ClassMemberModel.getUserClassStats(userId);

      // Soft delete the user
      const deleted = await UserModel.softDelete(userId, adminUserId, reason);

      if (!deleted) {
        await client.query("ROLLBACK");
        res.status(500).json({
          success: false,
          message: "Failed to delete user",
        });
        return;
      }

      // Remove user from all non-completed classes
      const removedFromClasses =
        await ClassMemberModel.removeFromNonCompletedClasses(userId);

      // Commit transaction
      await client.query("COMMIT");

      res.status(200).json({
        success: true,
        message: "User deleted successfully",
        data: {
          deleted_user_id: userId,
          deleted_by: adminUserId,
          class_memberships: {
            total_classes: classStats.total_classes,
            removed_from_active_classes: removedFromClasses,
            kept_in_completed_classes: classStats.completed_classes,
          },
          deletion_timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error deleting user:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete user",
        error: process.env.NODE_ENV === "development" ? error : undefined,
      });
    } finally {
      client.release();
    }
  }

  /**
   * Get user by ID (including deleted users for admin audit)
   */
  static async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const schoolId = req.schoolId;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: "User ID is required",
        });
        return;
      }

      if (!schoolId) {
        res.status(403).json({
          success: false,
          message: "No school/tenant associated with this user",
        });
        return;
      }

      const user = await UserModel.findById(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      // Verify user belongs to the same school
      if (user.school_id !== schoolId) {
        res.status(403).json({
          success: false,
          message: "Access denied",
        });
        return;
      }

      const sanitizedUser = UserModel.sanitizeUser(user);

      res.status(200).json({
        success: true,
        data: sanitizedUser,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch user",
      });
    }
  }

  static async sendInviteEmailToIndivisual(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { email, userType, firstName, lastName, schoolId } = req.body;

      if (!email || !userType || !schoolId) {
        res.status(400).json({
          success: false,
          message: "email, userType and school id are required",
        });
        return;
      }

      const safeFirst = firstName || "Unknown";
      const safeLast = lastName || "Unknown";

      const school = await SchoolModel.findById(schoolId);
      if (!school) {
        res.status(404).json({
          success: false,
          message: "School not found",
        });
        return;
      }
      console.log("+++++++++++++++++++++++++++++++++++++++", school);
      // Decide which email to send
      if (userType === "teacher") {
        await sendTeacherOnboardEmail(
          email,
          safeFirst,
          school.name,
          school.unique_key
        );
      } else if (userType === "student") {
        await sendStudentOnboardEmail(
          email,
          safeFirst,
          school.name,
          school.unique_key
        );
      } else {
        res.status(400).json({
          success: false,
          message: "Invalid userType (must be 'teacher' or 'student')",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Invitation email sent successfully",
      });
    } catch (error) {
      console.error("Error sending invite email:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send invitation email",
      });
    }
  }

  /**
   * Get plan usage summary for the current user's school
   * This shows teachers/admins how many students/teachers they can still add
   */
  static async getPlanUsage(req: Request, res: Response): Promise<void> {
    try {
      const schoolId = req.schoolId;

      if (!schoolId) {
        res.status(403).json({
          success: false,
          message: "No tenant/school associated with this user",
        });
        return;
      }

      const usage = await getPlanUsageSummary(schoolId);

      res.status(200).json({
        success: true,
        data: usage,
        message: "Plan usage retrieved successfully",
      });
    } catch (error) {
      console.error("Error fetching plan usage:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch plan usage",
      });
    }
  }
}
