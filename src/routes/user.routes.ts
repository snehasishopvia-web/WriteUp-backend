import { Router } from "express";
import { UserController } from "../controllers/user.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/authorization.middleware.js";
import { attachSchool } from "../middleware/school.middleware.js";
import { checkTeacherLimitMiddleware, checkStudentLimitMiddleware } from "../middleware/plan-limits.middleware.js";

const router = Router();

router.use(authenticate);
router.use(attachSchool);

/**
 * @route   GET /api/v1/users/teachers
 * @desc    Get all teachers for the tenant/school
 * @access  Private (Admin only)
 */
router.get("/teachers", UserController.getTeachersByTenant);

/**
 * @route   GET /api/v1/users/students
 * @desc    Get all students for the tenant/school
 * @access  Private (Admin only)
 */
router.get("/students", UserController.getStudentsByTenant);

/**
 * @route   GET /api/v1/users/plan-usage
 * @desc    Get plan usage summary (students/teachers/classes remaining)
 * @access  Private (Admin and Teachers)
 */
router.get("/plan-usage", UserController.getPlanUsage);

/**
 * @route   POST /api/v1/users
 * @desc    Create a new user and optionally add to a class
 * @access  Private (Admin and Teachers can add students, only Admin can add teachers)
 * @body    {
 *            email: string,
 *            firstName: string,
 *            lastName?: string,
 *            userType: "student" | "teacher",
 *            departmentId: string,
 *            graduationYear?: number,
 *            classId?: string
 *          }
 */
router.post("/", UserController.createUser);

/**
 * @route   GET /api/v1/users/:userId
 * @desc    Get a specific user by ID (for admin audit)
 * @access  Private (Admin only)
 */
router.get("/:userId", requireAdmin, UserController.getUserById);

/**
 * @route   DELETE /api/v1/users/:userId
 * @desc    Soft delete a user
 *          - Marks user as inactive
 *          - Removes from all non-completed classes
 *          - Keeps in completed/archived classes
 * @access  Private (Admin only)
 * @body    {
 *            reason?: string  // Optional reason for deletion
 *          }
 */
router.delete("/:userId", requireAdmin, UserController.deleteUser);

router.post("/send-invite", UserController.sendInviteEmailToIndivisual);


export default router;
