import { Request, Response } from "express";
import { ClassInvitationModel } from "../models/class-invitation.model.js";
import { ClassMemberModel } from "../models/class-member.model.js";
import { ClassModel } from "../models/class.model.js";
import { CreateInvitationDTO } from "../types/class.types.js";

export class ClassInvitationController {
  /**
   * Send invitation to join a class
   */
  static async sendInvitation(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { classId } = req.params;
      const invitationData: CreateInvitationDTO = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      // Validate required fields
      if (!invitationData.invited_email || !invitationData.role) {
        res.status(400).json({
          success: false,
          message: "invited_email and role are required",
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

      // Check if class exists
      const classData = await ClassModel.findById(classId);
      if (!classData) {
        res.status(404).json({
          success: false,
          message: "Class not found",
        });
        return;
      }

      // Check if email already has pending invitation
      const hasPending = await ClassInvitationModel.hasPendingInvitation(
        classId,
        invitationData.invited_email
      );

      if (hasPending) {
        res.status(400).json({
          success: false,
          message: "User already has a pending invitation for this class",
        });
        return;
      }

      // Create invitation
      const invitation = await ClassInvitationModel.create(
        classId,
        userId,
        invitationData
      );

      // TODO: Send invitation email here
      // await sendInvitationEmail(invitation);

      res.status(201).json({
        success: true,
        message: "Invitation sent successfully",
        data: invitation,
      });
    } catch (error) {
      console.error("Error sending invitation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send invitation",
      });
    }
  }

  /**
   * Get invitations for a class
   */
  static async getClassInvitations(req: Request, res: Response): Promise<void> {
    try {
      const { classId } = req.params;

      if (!classId) {
        res.status(400).json({
          success: false,
          message: "Class ID is required",
        });
        return;
      }

      const invitations = await ClassInvitationModel.findByClassId(classId);

      res.status(200).json({
        success: true,
        data: invitations,
        count: invitations.length,
      });
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch invitations",
      });
    }
  }

  /**
   * Get pending invitations for current user
   */
  static async getMyInvitations(req: Request, res: Response): Promise<void> {
    try {
      const email = req.user?.email;

      if (!email) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const invitations = await ClassInvitationModel.findPendingByEmail(email);

      res.status(200).json({
        success: true,
        data: invitations,
        count: invitations.length,
      });
    } catch (error) {
      console.error("Error fetching user invitations:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch invitations",
      });
    }
  }

  /**
   * Accept an invitation
   */
  static async acceptInvitation(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const email = req.user?.email;
      const { invitationId } = req.params;

      if (!userId || !email) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      if (!invitationId) {
        res.status(400).json({
          success: false,
          message: "Invitation ID is required",
        });
        return;
      }

      // Get invitation
      const invitation = await ClassInvitationModel.findById(invitationId);
      if (!invitation) {
        res.status(404).json({
          success: false,
          message: "Invitation not found",
        });
        return;
      }

      // Verify email matches
      if (invitation.invited_email !== email) {
        res.status(403).json({
          success: false,
          message: "This invitation is not for you",
        });
        return;
      }

      // Check if invitation is still valid
      if (invitation.status !== "pending") {
        res.status(400).json({
          success: false,
          message: `Invitation is ${invitation.status}`,
        });
        return;
      }

      if (new Date(invitation.expires_at) < new Date()) {
        res.status(400).json({
          success: false,
          message: "Invitation has expired",
        });
        return;
      }

      // Check if user is already a member
      const isMember = await ClassMemberModel.isMember(
        invitation.class_id,
        userId
      );
      if (isMember) {
        res.status(400).json({
          success: false,
          message: "You are already a member of this class",
        });
        return;
      }

      // Check if class is full (for students)
      if (invitation.role === "student") {
        const isFull = await ClassModel.isFull(invitation.class_id);
        if (isFull) {
          res.status(400).json({
            success: false,
            message: "Class is full",
          });
          return;
        }
      }

      // Accept invitation
      const acceptedInvitation = await ClassInvitationModel.accept(
        invitationId
      );

      if (!acceptedInvitation) {
        res.status(500).json({
          success: false,
          message: "Failed to accept invitation",
        });
        return;
      }

      // Add user to class
      await ClassMemberModel.add(invitation.class_id, {
        user_id: userId,
        role: invitation.role,
        joined_via: "invitation",
      });

      res.status(200).json({
        success: true,
        message: "Invitation accepted successfully",
        data: acceptedInvitation,
      });
    } catch (error) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to accept invitation",
      });
    }
  }

  /**
   * Revoke an invitation
   */
  static async revokeInvitation(req: Request, res: Response): Promise<void> {
    try {
      const { invitationId } = req.params;

      if (!invitationId) {
        res.status(400).json({
          success: false,
          message: "Invitation ID is required",
        });
        return;
      }

      const revoked = await ClassInvitationModel.revoke(invitationId);

      if (!revoked) {
        res.status(404).json({
          success: false,
          message: "Invitation not found or already processed",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Invitation revoked successfully",
      });
    } catch (error) {
      console.error("Error revoking invitation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to revoke invitation",
      });
    }
  }
}
