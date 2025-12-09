import { Router } from "express";
import { ClassInvitationController } from "../controllers/class-invitation.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { attachSchool } from "../middleware/school.middleware.js";
import { canManageClass } from "../middleware/class-permission.middleware.js";

const router = Router();

// Apply authentication and school middleware to all routes
router.use(authenticate);
router.use(attachSchool);

/**
 * @route   POST /api/v1/classes/:classId/invitations
 * @desc    Send invitation to join a class
 * @access  Private (Class managers only - creator, admin, teacher)
 */
router.post("/:classId/invitations", canManageClass, ClassInvitationController.sendInvitation);

/**
 * @route   GET /api/v1/classes/:classId/invitations
 * @desc    Get all invitations for a class
 * @access  Private (Class managers only)
 */
router.get("/:classId/invitations", canManageClass, ClassInvitationController.getClassInvitations);

/**
 * @route   GET /api/v1/invitations/my-invitations
 * @desc    Get pending invitations for current user
 * @access  Private (Authenticated users)
 */
router.get("/invitations/my-invitations", ClassInvitationController.getMyInvitations);

/**
 * @route   POST /api/v1/invitations/:invitationId/accept
 * @desc    Accept an invitation
 * @access  Private (Authenticated users)
 */
router.post("/invitations/:invitationId/accept", ClassInvitationController.acceptInvitation);

/**
 * @route   DELETE /api/v1/invitations/:invitationId
 * @desc    Revoke an invitation
 * @access  Private (Class managers only)
 */
router.delete("/invitations/:invitationId", ClassInvitationController.revokeInvitation);

export default router;
