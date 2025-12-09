import { Request, Response } from "express";
import { ClassJoinLinkModel } from "../models/class-join-link.model.js";
import { ClassMemberModel } from "../models/class-member.model.js";
import { ClassModel } from "../models/class.model.js";
import { CreateJoinLinkDTO } from "../types/class.types.js";

export class ClassJoinLinkController {
  /**
   * Generate a join link for a class
   */
  static async generateJoinLink(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { classId } = req.params;
      const linkData: CreateJoinLinkDTO = req.body;

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

      // Validate required fields
      if (!linkData.role) {
        res.status(400).json({
          success: false,
          message: "role is required (teacher or student)",
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

      // Create join link (this will deactivate any existing active links)
      const joinLink = await ClassJoinLinkModel.create(
        classId,
        userId,
        linkData
      );

      // Generate the full URL (you can customize this based on your frontend URL)
      const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const joinUrl = `${baseUrl}/join-class/${joinLink.token}`;

      res.status(201).json({
        success: true,
        message: "Join link generated successfully",
        data: {
          ...joinLink,
          join_url: joinUrl,
        },
      });
    } catch (error) {
      console.error("Error generating join link:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate join link",
      });
    }
  }

  /**
   * Get join links for a class
   */
  static async getClassJoinLinks(req: Request, res: Response): Promise<void> {
    try {
      const { classId } = req.params;

      if (!classId) {
        res.status(400).json({
          success: false,
          message: "Class ID is required",
        });
        return;
      }

      const joinLinks = await ClassJoinLinkModel.findByClassId(classId);

      const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const linksWithUrls = joinLinks.map((link) => ({
        ...link,
        join_url: `${baseUrl}/join-class/${link.token}`,
      }));

      res.status(200).json({
        success: true,
        data: linksWithUrls,
        count: linksWithUrls.length,
      });
    } catch (error) {
      console.error("Error fetching join links:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch join links",
      });
    }
  }

  /**
   * Get active join link for a class and role
   */
  static async getActiveJoinLink(req: Request, res: Response): Promise<void> {
    try {
      const { classId } = req.params;
      const { role } = req.query;

      if (!classId) {
        res.status(400).json({
          success: false,
          message: "Class ID is required",
        });
        return;
      }

      if (!role || (role !== "teacher" && role !== "student")) {
        res.status(400).json({
          success: false,
          message: "Valid role query parameter is required (teacher or student)",
        });
        return;
      }

      const joinLink = await ClassJoinLinkModel.findActiveByClassAndRole(
        classId,
        role as "teacher" | "student"
      );

      if (!joinLink) {
        res.status(404).json({
          success: false,
          message: "No active join link found for this role",
        });
        return;
      }

      const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const joinUrl = `${baseUrl}/join-class/${joinLink.token}`;

      res.status(200).json({
        success: true,
        data: {
          ...joinLink,
          join_url: joinUrl,
        },
      });
    } catch (error) {
      console.error("Error fetching active join link:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch join link",
      });
    }
  }

  /**
   * Validate and get join link info (public endpoint)
   */
  static async validateJoinLink(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      if (!token) {
        res.status(400).json({
          success: false,
          message: "Token is required",
        });
        return;
      }

      const isValid = await ClassJoinLinkModel.isValid(token);
      if (!isValid) {
        res.status(400).json({
          success: false,
          message: "Invalid or expired join link",
        });
        return;
      }

      const joinLink = await ClassJoinLinkModel.findByToken(token);
      if (!joinLink) {
        res.status(404).json({
          success: false,
          message: "Join link not found",
        });
        return;
      }

      // Get class info
      const classData = await ClassModel.findById(joinLink.class_id);
      if (!classData) {
        res.status(404).json({
          success: false,
          message: "Class not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          role: joinLink.role,
          class_id: joinLink.class_id,
          class_name: classData.class_name,
          school_id: classData.school_id,
          expires_at: joinLink.expires_at,
          max_uses: joinLink.max_uses,
          current_uses: joinLink.current_uses,
        },
      });
    } catch (error) {
      console.error("Error validating join link:", error);
      res.status(500).json({
        success: false,
        message: "Failed to validate join link",
      });
    }
  }

  /**
   * Join class via link
   */
  static async joinViaLink(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { token } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      if (!token) {
        res.status(400).json({
          success: false,
          message: "Token is required",
        });
        return;
      }

      // Validate link
      const isValid = await ClassJoinLinkModel.isValid(token);
      if (!isValid) {
        res.status(400).json({
          success: false,
          message: "Invalid or expired join link",
        });
        return;
      }

      const joinLink = await ClassJoinLinkModel.findByToken(token);
      if (!joinLink) {
        res.status(404).json({
          success: false,
          message: "Join link not found",
        });
        return;
      }

      // Check if user already used this link
      const hasUsed = await ClassJoinLinkModel.hasUserUsedLink(
        joinLink.id,
        userId
      );
      if (hasUsed) {
        res.status(400).json({
          success: false,
          message: "You have already used this join link",
        });
        return;
      }

      // Check if user is already a member
      const isMember = await ClassMemberModel.isMember(
        joinLink.class_id,
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
      if (joinLink.role === "student") {
        const isFull = await ClassModel.isFull(joinLink.class_id);
        if (isFull) {
          res.status(400).json({
            success: false,
            message: "Class is full",
          });
          return;
        }
      }

      // Add user to class
      await ClassMemberModel.add(joinLink.class_id, {
        user_id: userId,
        role: joinLink.role,
        joined_via: "join_link",
      });

      // Record link usage
      await ClassJoinLinkModel.recordUsage(joinLink.id, userId);
      await ClassJoinLinkModel.incrementUsage(joinLink.id);

      res.status(200).json({
        success: true,
        message: "Successfully joined the class",
        data: {
          class_id: joinLink.class_id,
          role: joinLink.role,
        },
      });
    } catch (error) {
      console.error("Error joining via link:", error);
      res.status(500).json({
        success: false,
        message: "Failed to join class",
      });
    }
  }

  /**
   * Deactivate a join link
   */
  static async deactivateJoinLink(req: Request, res: Response): Promise<void> {
    try {
      const { linkId } = req.params;

      if (!linkId) {
        res.status(400).json({
          success: false,
          message: "Link ID is required",
        });
        return;
      }

      const deactivated = await ClassJoinLinkModel.deactivate(linkId);

      if (!deactivated) {
        res.status(404).json({
          success: false,
          message: "Join link not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Join link deactivated successfully",
      });
    } catch (error) {
      console.error("Error deactivating join link:", error);
      res.status(500).json({
        success: false,
        message: "Failed to deactivate join link",
      });
    }
  }

  /**
   * Get usage history for a join link
   */
  static async getJoinLinkUsage(req: Request, res: Response): Promise<void> {
    try {
      const { linkId } = req.params;

      if (!linkId) {
        res.status(400).json({
          success: false,
          message: "Link ID is required",
        });
        return;
      }

      const usage = await ClassJoinLinkModel.getUsageHistory(linkId);

      res.status(200).json({
        success: true,
        data: usage,
        count: usage.length,
      });
    } catch (error) {
      console.error("Error fetching join link usage:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch usage history",
      });
    }
  }
}
