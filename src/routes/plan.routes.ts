import { Router } from "express";
import {
  createPlan,
  getAllPlans,
  getPlanById,
  getPlanBySlug,
  updatePlan,
  deletePlan,
} from "../controllers/plan.controller.js";
import roleAuthorization from "../middleware/authorization.middleware.js";
import { ROLES } from "../types/enums.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

/**
 * @route   POST /api/v1/plans
 * @desc    Create a new plan
 * @access  Private (Admin only)
 */
router.post("/", authenticate, roleAuthorization([ROLES.ADMIN]), createPlan);

/**
 * @route   GET /api/v1/plans
 * @desc    Get all plans
 * @access  Public
 */
router.get("/", getAllPlans);

/**
 * @route   GET /api/v1/plans/slug/:slug
 * @desc    Get plan by slug
 * @access  Public
 */
router.get("/slug/:slug", getPlanBySlug);

/**
 * @route   GET /api/v1/plans/:id
 * @desc    Get plan by ID
 * @access  Public
 */
router.get("/:id", getPlanById);

/**
 * @route   PUT /api/v1/plans/:id
 * @desc    Update a plan
 * @access  Private (Admin only)
 */
router.put("/:id", authenticate, roleAuthorization([ROLES.ADMIN]), updatePlan);

/**
 * @route   DELETE /api/v1/plans/:id
 * @desc    Soft delete a plan
 * @access  Private (Admin only)
 */
router.delete(
  "/:id",
  authenticate,
  roleAuthorization([ROLES.ADMIN]),
  deletePlan
);

export default router;
