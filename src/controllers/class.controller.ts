import { Request, Response } from "express";
import { ClassModel } from "../models/class.model.js";
import { ClassMemberModel } from "../models/class-member.model.js";
import { CreateClassDTO, UpdateClassDTO } from "../types/class.types.js";
import { pool } from "../config/postgres.db.js";
import { validateTeacherLimit, validateStudentLimit, validateClassLimit } from "../utils/plan-limits.utils.js";
import { validateSubscriptionBySchoolId } from "../utils/subscription.utils.js";

export class ClassController {
  /**
   * Create a new class
   */
  static async createClass(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const schoolId = req.schoolId;

      if (!userId) {
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

      // Check if subscription is active
      await validateSubscriptionBySchoolId(schoolId);

      // Check class limit before creating
      await validateClassLimit(schoolId, 1);

      const classData: CreateClassDTO = req.body;

      // Validate required fields
      if (
        !classData.class_name ||
        !classData.department_id ||
        !classData.semester
      ) {
        res.status(400).json({
          success: false,
          message: "class_name, department_id, and semester are required",
        });
        return;
      }

      // Create class
      const newClass = await ClassModel.create(classData, userId, schoolId);

      // Add creator as admin/teacher to the class
      await ClassMemberModel.add(newClass.id, {
        user_id: userId,
        role: "admin",
        joined_via: "direct_add",
      });

      res.status(201).json({
        success: true,
        message: "Class created successfully",
        data: newClass,
      });
    } catch (error) {
      console.error("Error creating class:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create class",
      });
    }
  }

  /**
   * Get all classes for the school
   */
  static async getClasses(req: Request, res: Response): Promise<void> {
    try {
      const schoolId = req.schoolId;

      if (!schoolId) {
        res.status(403).json({
          success: false,
          message: "No school/tenant associated with this user",
        });
        return;
      }

      const classes = await ClassModel.findBySchoolId(schoolId);

      res.status(200).json({
        success: true,
        data: classes,
        count: classes.length,
      });
    } catch (error) {
      console.error("Error fetching classes:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch classes",
      });
    }
  }

  /**
   * Get a single class by ID
   */
  static async getClassById(req: Request, res: Response): Promise<void> {
    try {
      const { classId } = req.query;
      if (!classId) {
        res
          .status(400)
          .json({ success: false, message: "Class ID is required" });
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

      // Get members count
      const studentCount = await ClassModel.getStudentCount(classId as string);
      const teachers = await ClassMemberModel.findByClassIdAndRole(
        classId as string,
        "teacher"
      );
      const students = await ClassMemberModel.findByClassIdAndRole(
        classId as string,
        "student"
      );

      res.status(200).json({
        success: true,
        data: {
          ...classData,
          student_count: studentCount,
          teacher_count: teachers.length,
          students,
          teachers,
        },
      });
    } catch (error) {
      console.error("Error fetching class:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch class",
      });
    }
  }

  /**
   * Update a class
   */
  static async updateClass(req: Request, res: Response): Promise<void> {
    try {
      const { classId } = req.query;
      const updateData: UpdateClassDTO = req.body;

      if (!classId) {
        res
          .status(400)
          .json({ success: false, message: "Class ID is required" });
        return;
      }

      const updatedClass = await ClassModel.update(classId as string, updateData);

      if (!updatedClass) {
        res.status(404).json({
          success: false,
          message: "Class not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Class updated successfully",
        data: updatedClass,
      });
    } catch (error) {
      console.error("Error updating class:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update class",
      });
    }
  }

  /**
   * Delete a class (soft delete)
   */
  static async deleteClass(req: Request, res: Response): Promise<void> {
    try {
      const { classId } = req.query;

      if (!classId) {
        res
          .status(400)
          .json({ success: false, message: "Class ID is required" });
        return;
      }

      const deleted = await ClassModel.delete(classId as string);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: "Class not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Class deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting class:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete class",
      });
    }
  }

  /**
   * Get classes where user is a member, optionally filtered by semester
   */
  static async getMyClasses(req: Request, res: Response): Promise<void> {
    try {
      const { semester } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      // Use new method that filters by user membership and optional semester
      const classes = await ClassModel.findByUserIdAndSemester(
        userId,
        semester as string | undefined
      );

      res.status(200).json({
        success: true,
        data: classes,
        count: classes.length,
        ...(semester && { semester }), // Include semester in response if filtered
      });
    } catch (error) {
      console.error("Error fetching user classes:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch classes",
      });
    }
  }

  /**
   * Get class members
   */
  static async getClassMembers(req: Request, res: Response): Promise<void> {
    try {
      const { classId } = req.query;

      if (!classId) {
        res
          .status(400)
          .json({ success: false, message: "Class ID is required" });
        return;
      }

      const members = await ClassMemberModel.findByClassId(classId as string);

      res.status(200).json({
        success: true,
        data: members,
        count: members.length,
      });
    } catch (error) {
      console.error("Error fetching class members:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch class members",
      });
    }
  }

  /**
   * Remove a member from class
   */
  static async removeMember(req: Request, res: Response): Promise<void> {
    try {
      const { classId, userId } = req.query;

      if (!classId) {
        res
          .status(400)
          .json({ success: false, message: "Class ID is required" });
        return;
      }
      if (!userId) {
        res
          .status(400)
          .json({ success: false, message: "User ID is required" });
        return;
      }

      const removed = await ClassMemberModel.remove(classId as string, userId as string);

      if (!removed) {
        res.status(404).json({
          success: false,
          message: "Member not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Member removed successfully",
      });
    } catch (error) {
      console.error("Error removing member:", error);
      res.status(500).json({
        success: false,
        message: "Failed to remove member",
      });
    }
  }

  /**
   * Get all enrollments (class members) for the school
   */
  static async getEnrollments(req: Request, res: Response): Promise<void> {
    try {
      const schoolId = req.schoolId;

      if (!schoolId) {
        res.status(403).json({
          success: false,
          message: "No school/tenant associated with this user",
        });
        return;
      }

      // Import pool for raw queries
      const { pool } = await import("../config/postgres.db.js");

      // Get all class members for classes belonging to this school
      const result = await pool.query(
        `SELECT cm.*
         FROM class_members cm
         INNER JOIN classes c ON cm.class_id = c.id
         WHERE c.school_id = $1 AND cm.status = 'active'
         ORDER BY cm.joined_at DESC`,
        [schoolId]
      );

      res.status(200).json({
        success: true,
        data: result.rows,
        count: result.rows.length,
      });
    } catch (error) {
      console.error("Error fetching enrollments:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch enrollments",
      });
    }
  }

  /**
   * Add multiple members to a class
   */
  static async addMembersToClass(req: Request, res: Response): Promise<void> {
    try {
      const schoolId = req.schoolId;

      if (!schoolId) {
        res.status(403).json({
          success: false,
          message: "No school/tenant associated with this user",
        });
        return;
      }

      // Check if subscription is active
      await validateSubscriptionBySchoolId(schoolId);

      const { department_id, class_id, user_ids, role } = req.body;

      // Validate required fields
      if (!class_id || !user_ids || !Array.isArray(user_ids) || !role) {
        res.status(400).json({
          success: false,
          message: "class_id, user_ids (array), and role are required",
        });
        return;
      }

      // Validate role
      if (!["student", "teacher"].includes(role)) {
        res.status(400).json({
          success: false,
          message: "role must be either 'student' or 'teacher'",
        });
        return;
      }

      // Check if class exists
      const classData = await ClassModel.findById(class_id);
      if (!classData) {
        res.status(404).json({
          success: false,
          message: "Class not found",
        });
        return;
      }

      // Verify that all users exist and have matching user_type
      const userCheckResult = await pool.query(
        `SELECT id, user_type, school_id FROM users WHERE id = ANY($1)`,
        [user_ids]
      );

      const foundUsers = userCheckResult.rows;

      // Check if all users were found
      if (foundUsers.length !== user_ids.length) {
        const foundUserIds = foundUsers.map((u) => u.id);
        const missingUserIds = user_ids.filter(
          (id) => !foundUserIds.includes(id)
        );
        res.status(404).json({
          success: false,
          message: `Users not found: ${missingUserIds.join(", ")}`,
        });
        return;
      }

      // Verify all users belong to the same school
      const invalidSchoolUsers = foundUsers.filter(
        (u) => u.school_id !== schoolId
      );
      if (invalidSchoolUsers.length > 0) {
        res.status(403).json({
          success: false,
          message: `Users do not belong to this school: ${invalidSchoolUsers
            .map((u) => u.id)
            .join(", ")}`,
        });
        return;
      }

      // Verify user types match the role
      const invalidTypeUsers = foundUsers.filter((u) => u.user_type !== role);
      if (invalidTypeUsers.length > 0) {
        res.status(400).json({
          success: false,
          message: `User type mismatch: Users ${invalidTypeUsers
            .map((u) => u.id)
            .join(", ")} have user_type '${
            invalidTypeUsers[0].user_type
          }' but role is '${role}'`,
        });
        return;
      }

      // Check plan limits before adding members
      // Note: We only validate if adding NEW users would exceed limits
      // Users who are already in the school (just being added to this class) don't count
      if (role === "student") {
        // All users in user_ids are already in the school (we verified school_id above)
        // So we don't need to check plan limits here - they're just being added to a class
        // Plan limits are checked when creating new users in the school
      } else if (role === "teacher") {
        // Same for teachers - they're already in the school
      }

      // Add members to class
      const addedMembers = [];
      const skippedMembers = [];
      const reactivatedMembers = [];

      for (const userId of user_ids) {
        // Check if user is already an active member
        const isMember = await ClassMemberModel.isMember(class_id, userId);

        if (isMember) {
          skippedMembers.push(userId);
          continue;
        }

        // Check if user has a removed/dropped membership that can be reactivated
        const existingMembership = await ClassMemberModel.findByClassAndUser(
          class_id,
          userId
        );

        if (existingMembership && existingMembership.status !== "active") {
          // Reactivate the existing membership
          await pool.query(
            `UPDATE class_members
             SET status = 'active', updated_at = NOW()
             WHERE class_id = $1 AND user_id = $2`,
            [class_id, userId]
          );

          reactivatedMembers.push(userId);
        } else {
          const member = await ClassMemberModel.add(class_id, {
            user_id: userId,
            role: role as "student" | "teacher",
            joined_via: "direct_add",
          });

          addedMembers.push(member);
        }
      }

      res.status(200).json({
        success: true,
        message: "Members added to class successfully",
        data: {
          added_count: addedMembers.length,
          reactivated_count: reactivatedMembers.length,
          skipped_count: skippedMembers.length,
          added_members: addedMembers,
          reactivated_members: reactivatedMembers,
          skipped_members: skippedMembers,
        },
      });
    } catch (error) {
      console.error("Error adding members to class:", error);
      res.status(500).json({
        success: false,
        message: "Failed to add members to class",
      });
    }
  }

  /**
   * Sync class members - Single endpoint to handle add, remove, and reactivate
   * This replaces the need for multiple add-members and remove-member calls
   */
  static async syncClassMembers(req: Request, res: Response): Promise<void> {
    const client = await pool.connect();

    try {
      const schoolId = req.schoolId;

      if (!schoolId) {
        res.status(403).json({
          success: false,
          message: "No school/tenant associated with this user",
        });
        return;
      }

      const { class_id, user_ids, role } = req.body;

      // Validate required fields
      if (!class_id || !user_ids || !Array.isArray(user_ids) || !role) {
        res.status(400).json({
          success: false,
          message: "class_id, user_ids (array), and role are required",
        });
        return;
      }

      // Validate role
      if (!["student", "teacher"].includes(role)) {
        res.status(400).json({
          success: false,
          message: "role must be either 'student' or 'teacher'",
        });
        return;
      }

      // Check if class exists and belongs to the school
      const classData = await ClassModel.findById(class_id);
      if (!classData) {
        res.status(404).json({
          success: false,
          message: "Class not found",
        });
        return;
      }

      if (classData.school_id !== schoolId) {
        res.status(403).json({
          success: false,
          message: "Class does not belong to your school",
        });
        return;
      }

      // Start transaction
      await client.query("BEGIN");

      // Get current active members with the specified role
      const currentMembersResult = await client.query(
        `SELECT user_id FROM class_members
         WHERE class_id = $1 AND role = $2 AND status = 'active'`,
        [class_id, role]
      );

      const currentMemberIds = currentMembersResult.rows.map((row) => row.user_id);
      const newMemberIds = user_ids;

      // Calculate differences
      const toRemove = currentMemberIds.filter((id) => !newMemberIds.includes(id));
      const toAdd = newMemberIds.filter((id) => !currentMemberIds.includes(id));
      const toKeep = currentMemberIds.filter((id) => newMemberIds.includes(id));

      // Verify that all new users exist and have matching user_type
      if (newMemberIds.length > 0) {
        const userCheckResult = await client.query(
          `SELECT id, user_type, school_id FROM users WHERE id = ANY($1)`,
          [newMemberIds]
        );

        const foundUsers = userCheckResult.rows;

        // Check if all users were found
        if (foundUsers.length !== newMemberIds.length) {
          const foundUserIds = foundUsers.map((u) => u.id);
          const missingUserIds = newMemberIds.filter(
            (id) => !foundUserIds.includes(id)
          );
          await client.query("ROLLBACK");
          res.status(404).json({
            success: false,
            message: `Users not found: ${missingUserIds.join(", ")}`,
          });
          return;
        }

        // Verify all users belong to the same school
        const invalidSchoolUsers = foundUsers.filter(
          (u) => u.school_id !== schoolId
        );
        if (invalidSchoolUsers.length > 0) {
          await client.query("ROLLBACK");
          res.status(403).json({
            success: false,
            message: `Users do not belong to this school: ${invalidSchoolUsers
              .map((u) => u.id)
              .join(", ")}`,
          });
          return;
        }

        // Verify user types match the role
        const invalidTypeUsers = foundUsers.filter((u) => u.user_type !== role);
        if (invalidTypeUsers.length > 0) {
          await client.query("ROLLBACK");
          res.status(400).json({
            success: false,
            message: `User type mismatch: Users ${invalidTypeUsers
              .map((u) => u.id)
              .join(", ")} have user_type '${
              invalidTypeUsers[0].user_type
            }' but role is '${role}'`,
          });
          return;
        }
      }

      // Track results
      const addedMembers: string[] = [];
      const reactivatedMembers: string[] = [];
      const removedMembers: string[] = [];

      // Remove members (soft delete - set status to 'removed')
      if (toRemove.length > 0) {
        const removeResult = await client.query(
          `UPDATE class_members
           SET status = 'removed', updated_at = NOW()
           WHERE class_id = $1 AND user_id = ANY($2) AND role = $3
           RETURNING user_id`,
          [class_id, toRemove, role]
        );
        removedMembers.push(...removeResult.rows.map((row) => row.user_id));
      }

      // Add or reactivate members
      for (const userId of toAdd) {
        // Check if user has a removed/dropped membership that can be reactivated
        const existingMembership = await client.query(
          `SELECT * FROM class_members
           WHERE class_id = $1 AND user_id = $2`,
          [class_id, userId]
        );

        if (existingMembership.rows.length > 0 && existingMembership.rows[0].status !== "active") {
          // Reactivate the existing membership
          await client.query(
            `UPDATE class_members
             SET status = 'active', updated_at = NOW()
             WHERE class_id = $1 AND user_id = $2`,
            [class_id, userId]
          );
          reactivatedMembers.push(userId);
        } else if (existingMembership.rows.length === 0) {
          // Add new member
          await client.query(
            `INSERT INTO class_members (class_id, user_id, role, joined_via, status)
             VALUES ($1, $2, $3, 'direct_add', 'active')`,
            [class_id, userId, role]
          );
          addedMembers.push(userId);
        }
        // If already active, skip (no action needed)
      }

      // Commit transaction
      await client.query("COMMIT");

      res.status(200).json({
        success: true,
        message: "Class members synced successfully",
        data: {
          kept_count: toKeep.length,
          added_count: addedMembers.length,
          reactivated_count: reactivatedMembers.length,
          removed_count: removedMembers.length,
          total_members: toKeep.length + addedMembers.length + reactivatedMembers.length,
          kept_members: toKeep,
          added_members: addedMembers,
          reactivated_members: reactivatedMembers,
          removed_members: removedMembers,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error syncing class members:", error);
      res.status(500).json({
        success: false,
        message: "Failed to sync class members",
      });
    } finally {
      client.release();
    }
  }
}
