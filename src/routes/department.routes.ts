import { Router } from "express";
import {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  syncDepartments,
} from "../controllers/department.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/authorization.middleware.js";
import { attachSchool } from "../middleware/school.middleware.js";

const router = Router();

router.use(authenticate);
router.use(attachSchool);

/**
 * @route   GET /api/v1/departments
 * @desc    Get all departments for admin's school
 * @access  Private (Admin only)
 */
router.get("/", getAllDepartments);

/**
 * @route   POST /api/v1/departments/sync
 * @desc    Bulk sync departments (create new, delete removed)
 * @access  Private (Admin only)
 */
router.post("/sync", syncDepartments);

/**
 * @route   GET /api/v1/departments/:id
 * @desc    Get department by ID
 * @access  Private (Admin only)
 */
router.get("/:id", getDepartmentById);

/**
 * @route   POST /api/v1/departments
 * @desc    Create new department
 * @access  Private (Admin only)
 */
router.post("/", createDepartment);

/**
 * @route   PUT /api/v1/departments/:id
 * @desc    Update department
 * @access  Private (Admin only)
 */
router.put("/:id", updateDepartment);

/**
 * @route   DELETE /api/v1/departments/:id
 * @desc    Delete department (soft delete)
 * @access  Private (Admin only)
 */
router.delete("/:id", requireAdmin, deleteDepartment);

export default router;
