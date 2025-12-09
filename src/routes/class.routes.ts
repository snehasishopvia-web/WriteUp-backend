import { Router } from "express";
import { ClassController } from "../controllers/class.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { attachSchool } from "../middleware/school.middleware.js";
import {
  canManageClass,
  isMemberOfClass,
} from "../middleware/class-permission.middleware.js";

const router = Router();

// Apply authentication and school middleware to all routes
router.use(authenticate);
router.use(attachSchool);

/**
 * @route   POST /api/v1/classes
 * @desc    Create a new class
 * @access  Private (Authenticated users - admin or teacher)
 */
router.post("/", ClassController.createClass);

/**
 * @route   GET /api/v1/classes
 * @desc    Get all classes for the school
 * @access  Private (Authenticated users)
 */
router.get("/", ClassController.getClasses);

/**
 * @route   GET /api/v1/classes/my-classes
 * @desc    Get classes where user is a member
 * @access  Private (Authenticated users)
 */
router.get("/my-classes", ClassController.getMyClasses);

/**
 * @route   GET /api/v1/classes/enrollments
 * @desc    Get all enrollments (class members) for the school
 * @access  Private (Authenticated users)
 */
router.get("/enrollments", ClassController.getEnrollments);

/**
 * @route   POST /api/v1/classes/add-members
 * @desc    Add multiple members to a class
 * @access  Private (Authenticated users)
 * @body    {
 *            department_id?: string,
 *            class_id: string,
 *            user_ids: string[],
 *            role: "student" | "teacher"
 *          }
 */
router.post("/add-members", ClassController.addMembersToClass);

/**
 * @route   PUT /api/v1/classes/sync-members
 * @desc    Sync class members (add, remove, reactivate) in a single atomic operation
 * @access  Private (Class managers only)
 * @body    {
 *            class_id: string,
 *            user_ids: string[],
 *            role: "student" | "teacher"
 *          }
 */
router.put("/sync-members", canManageClass, ClassController.syncClassMembers);

/**
 * @route   GET /api/v1/classes?classId=
 * @desc    Get a single class by ID
 * @access  Private (Class members only)
 */
router.get("/get-class", isMemberOfClass, ClassController.getClassById);

/**
 * @route   PUT /api/v1/classes?classId=
 * @desc    Update a class
 * @access  Private (Class managers only - creator, admin, teacher)
 */
router.put("/update-class", canManageClass, ClassController.updateClass);

/**
 * @route   DELETE /api/v1/classes?classId=
 * @desc    Delete a class (soft delete)
 * @access  Private (Class managers only)
 */
router.delete("/delete-class", canManageClass, ClassController.deleteClass);

/**
 * @route   GET /api/v1/classes/members?classId=
 * @desc    Get all members of a class
 * @access  Private (Class members only)
 */
router.get("/get-members", isMemberOfClass, ClassController.getClassMembers);

/**
 * @route   DELETE /api/v1/classes/members?classId=&userId=
 * @desc    Remove a member from class
 * @access  Private (Class managers only)
 */
router.delete("/remove-class-member", canManageClass, ClassController.removeMember);

export default router;
