import { Router } from "express";
import { ClassJoinLinkController } from "../controllers/class-join-link.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { attachSchool } from "../middleware/school.middleware.js";
import { canManageClass } from "../middleware/class-permission.middleware.js";

const router = Router();

/**
 * @route   GET /api/v1/join/:token
 * @desc    Validate and get join link info (public endpoint)
 * @access  Public
 */
router.get("/join/:token", ClassJoinLinkController.validateJoinLink);

/**
 * @route   POST /api/v1/join/:token
 * @desc    Join class via link
 * @access  Private (Authenticated users)
 */
router.post("/join/:token", authenticate, attachSchool, ClassJoinLinkController.joinViaLink);

// Apply authentication and school middleware to remaining routes
router.use(authenticate);
router.use(attachSchool);

/**
 * @route   POST /api/v1/classes/:classId/join-links
 * @desc    Generate a join link for a class
 * @access  Private (Class managers only - creator, admin, teacher)
 */
router.post("/:classId/join-links", canManageClass, ClassJoinLinkController.generateJoinLink);

/**
 * @route   GET /api/v1/classes/:classId/join-links
 * @desc    Get all join links for a class
 * @access  Private (Class managers only)
 */
router.get("/:classId/join-links", canManageClass, ClassJoinLinkController.getClassJoinLinks);

/**
 * @route   GET /api/v1/classes/:classId/join-links/active
 * @desc    Get active join link for a class and role
 * @access  Private (Class managers only)
 * @query   role - teacher or student
 */
router.get("/:classId/join-links/active", canManageClass, ClassJoinLinkController.getActiveJoinLink);

/**
 * @route   DELETE /api/v1/join-links/:linkId
 * @desc    Deactivate a join link
 * @access  Private (Class managers only)
 */
router.delete("/join-links/:linkId", ClassJoinLinkController.deactivateJoinLink);

/**
 * @route   GET /api/v1/join-links/:linkId/usage
 * @desc    Get usage history for a join link
 * @access  Private (Class managers only)
 */
router.get("/join-links/:linkId/usage", ClassJoinLinkController.getJoinLinkUsage);

export default router;
