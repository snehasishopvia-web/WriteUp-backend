import { Request, Response } from "express";
import { FolderModel } from "../models/folder.model.js";

/**
 * Transform folder from database format to API format
 * Maps snake_case DB fields to camelCase API fields expected by frontend
 */
function transformFolder(folder: any): any {
  if (!folder) return null;
  
  const { parent_id, owner_id, ...rest } = folder;
  return {
    ...rest,
    parent: parent_id,
    owner: owner_id,
  };
}

export class FolderController {
  /**
   * List user's folders
   * GET /api/folders
   *
   * MIGRATED FROM press-backend: FolderListCreateView (GET)
   * CHANGES:
   * - Added school_id filter from query params for multi-tenancy
   * - Returns folders with children_count and documents_count
   */
  static async list(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { school_id } = req.query;

      const folders = await FolderModel.findByOwner(
        userId,
        school_id as string | undefined
      );

      // Get counts for each folder and transform to API format
      const foldersWithCounts = await Promise.all(
        folders.map(async (folder) => {
          const withCounts = await FolderModel.getFolderWithCounts(
            folder.id,
            userId
          );
          return transformFolder(withCounts);
        })
      );

      res.json(foldersWithCounts);
    } catch (error: any) {
      console.error("Error listing folders:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Create new folder
   * POST /api/folders
   *
   * MIGRATED FROM press-backend: FolderListCreateView (POST)
   * CHANGES:
   * - Added school_id support for multi-tenancy
   * - Validates parent folder belongs to user before creating
   */
  static async create(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      // Accept 'parent' from frontend API format, map to parent_id for model
      const { name, parent, school_id } = req.body;
      const parent_id = parent;

      // Validate required fields
      if (!name) {
        return res.status(400).json({ error: "Folder name is required" });
      }

      // If parent_id provided, validate it belongs to user
      if (parent_id) {
        const parentExists = await FolderModel.isOwner(parent_id, userId);
        if (!parentExists) {
          return res.status(404).json({ error: "Parent folder not found" });
        }
      }

      const folder = await FolderModel.create(userId, {
        name,
        parent_id,
        school_id,
      });

      return res.status(201).json(transformFolder(folder));
    } catch (error: any) {
      // Handle unique constraint violation (duplicate folder name)
      if (error.code === "23505") {
        return res.status(400).json({
          error: "A folder with this name already exists in this location",
        });
      }

      console.error("Error creating folder:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get folder details
   * GET /api/folders/:id
   *
   * MIGRATED FROM press-backend: FolderDetailView (GET)
   * CHANGES:
   * - Returns folder with children_count and documents_count
   * - Validates folder ownership for security
   */
  static async getById(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ error: "Folder ID is required" });
      }

      const folder = await FolderModel.getFolderWithCounts(id, userId);

      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }

      return res.json(transformFolder(folder));
    } catch (error: any) {
      console.error("Error getting folder:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update folder
   * PUT /api/folders/:id
   *
   * MIGRATED FROM press-backend: FolderDetailView (PUT/PATCH)
   * CHANGES:
   * - Validates circular reference before allowing parent_id change
   * - Only owner can update folder (authorization check)
   */
  static async update(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { name, parent_id } = req.body;

      if (!id) {
        return res.status(400).json({ error: "Folder ID is required" });
      }

      // Check ownership
      const exists = await FolderModel.isOwner(id, userId);
      if (!exists) {
        return res.status(404).json({ error: "Folder not found" });
      }

      // If moving folder, validate it can be moved to new parent
      if (parent_id !== undefined) {
        const canMove = await FolderModel.canMoveTo(id, parent_id);
        if (!canMove) {
          return res.status(400).json({
            error: "Cannot move folder into itself or its descendants",
          });
        }

        // Validate new parent exists and belongs to user
        if (parent_id) {
          const parentExists = await FolderModel.isOwner(parent_id, userId);
          if (!parentExists) {
            return res.status(404).json({ error: "Parent folder not found" });
          }
        }
      }

      const folder = await FolderModel.update(id, userId, { name, parent_id });

      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }

      return res.json(transformFolder(folder));
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === "23505") {
        return res.status(400).json({
          error: "A folder with this name already exists in this location",
        });
      }

      console.error("Error updating folder:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Delete folder
   * DELETE /api/folders/:id
   *
   * MIGRATED FROM press-backend: FolderDetailView (DELETE)
   * CHANGES:
   * - Cascade deletes child folders (per migration FK constraint)
   * - Documents in folder have folder_id set to NULL (per migration)
   * - Only owner can delete folder
   */
  static async delete(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ error: "Folder ID is required" });
      }

      const deleted = await FolderModel.delete(id, userId);

      if (!deleted) {
        return res.status(404).json({ error: "Folder not found" });
      }

      return res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting folder:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Move folder to different parent
   * PUT /api/folders/:id/move
   *
   * MIGRATED FROM press-backend: FolderMoveView (PUT)
   * CHANGES:
   * - Same functionality as update with parent_id
   * - Validates circular reference prevention
   * - Multi-tenancy: ensures parent folder belongs to same user
   */
  static async move(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      // Accept 'parent' from frontend API format, map to parent_id for model
      const { parent } = req.body;
      const parent_id = parent;

      if (!id) {
        return res.status(400).json({ error: "Folder ID is required" });
      }

      // Check ownership
      const exists = await FolderModel.isOwner(id, userId);
      if (!exists) {
        return res.status(404).json({ error: "Folder not found" });
      }

      // Validate can move to new parent
      const canMove = await FolderModel.canMoveTo(id, parent_id || null);
      if (!canMove) {
        return res.status(400).json({
          error: "Cannot move folder into itself or its descendants",
        });
      }

      // Validate new parent exists and belongs to user
      if (parent_id) {
        const parentExists = await FolderModel.isOwner(parent_id, userId);
        if (!parentExists) {
          return res.status(404).json({ error: "Parent folder not found" });
        }
      }

      const folder = await FolderModel.update(id, userId, { parent_id });

      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }

      return res.json(transformFolder(folder));
    } catch (error: any) {
      console.error("Error moving folder:", error);
      return res.status(500).json({ error: error.message });
    }
  }
}
