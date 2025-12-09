import { Request, Response } from "express";
import { DocumentModel } from "../models/document.model.js";
import { FolderModel } from "../models/folder.model.js";

/**
 * Transform document from database format to API format
 * Maps snake_case DB fields to camelCase API fields expected by frontend
 */
function transformDocument(doc: any): any {
  if (!doc) return null;
  
  const { folder_id, owner_id, last_modified_by, ...rest } = doc;
  return {
    ...rest,
    folder: folder_id,
    owner: owner_id,
    last_modified_by: last_modified_by,
  };
}

export class DocumentController {
  /**
   * List user's documents
   * GET /api/documents
   *
   * MIGRATED FROM press-backend: DocumentListCreateView (GET)
   * CHANGES:
   * - Added school_id filter from query params for multi-tenancy
   * - Added folder_id filter to get documents in specific folder
   * - Returns DocumentListSerializer fields (lightweight version)
   */
  static async list(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { school_id, folder_id } = req.query;

      let documents;

      if (folder_id !== undefined) {
        // Get documents in specific folder
        documents = await DocumentModel.findByFolder(
          folder_id === "null" ? null : (folder_id as string),
          userId
        );
      } else {
        // Get all user's documents with optional school filter
        documents = await DocumentModel.findByOwner(
          userId,
          school_id as string | undefined
        );
      }

      res.json(documents.map(transformDocument));
    } catch (error: any) {
      console.error("Error listing documents:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Create new document
   * POST /api/documents
   *
   * MIGRATED FROM press-backend: DocumentListCreateView (POST)
   * CHANGES:
   * - Added assignment_id and class_id for assignment submissions
   * - Added school_id for multi-tenancy
   * - Validates folder ownership before creating
   */
  static async create(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      // Accept 'parent' from frontend API format, map to folder_id for model
      const {
        title,
        content,
        content_format,
        document_type,
        citation_style,
        parent,
        school_id,
        class_id,
        assignment_id,
      } = req.body;
      const folder_id = parent;

      // If folder_id provided, validate it belongs to user
      if (folder_id) {
        const folderExists = await FolderModel.isOwner(folder_id, userId);
        if (!folderExists) {
          return res.status(404).json({ error: "Folder not found" });
        }
      }

      const document = await DocumentModel.create(userId, {
        title,
        content,
        content_format,
        document_type,
        citation_style,
        folder_id,
        school_id,
        class_id,
        assignment_id,
      });

      return res.status(201).json(transformDocument(document));
    } catch (error: any) {
      console.error("Error creating document:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get document details
   * GET /api/documents/:id
   *
   * MIGRATED FROM press-backend: DocumentDetailView (GET)
   * CHANGES:
   * - Returns full DocumentSerializer with all fields
   * - Only document owner can view (authorization check)
   */
  static async getById(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ error: "Document ID is required" });
      }

      const document = await DocumentModel.getDocumentWithPath(id, userId);

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      return res.json(transformDocument(document));
    } catch (error: any) {
      console.error("Error getting document:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update document with version conflict detection
   * PUT /api/documents/:id
   *
   * MIGRATED FROM press-backend: DocumentDetailView (PUT/PATCH)
   * CHANGES:
   * - Implements optimistic concurrency control with version check
   * - Returns 409 Conflict if version mismatch
   * - Multi-tenancy: only owner can update
   * - Uses atomic database operation for version check
   *
   * IMPORTANT: This is critical for preventing data loss when
   * multiple users or sessions edit the same document
   */
  static async update(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const {
        client_version,
        title,
        content,
        content_format,
        formatting,
        document_type,
        citation_style,
        assets,
        outline,
        research_notes,
        edit_history,
        sources,
        folder_id,
      } = req.body;

      if (!id) {
        return res.status(400).json({ error: "Document ID is required" });
      }

      // Validate client_version is provided
      if (client_version === undefined || client_version === null) {
        return res.status(400).json({
          error: "client_version is required for updates",
        });
      }

      // Check document ownership
      const exists = await DocumentModel.isOwner(id, userId);
      if (!exists) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Attempt update with version check
      const { document, conflict } = await DocumentModel.updateWithVersion(
        id,
        userId,
        {
          client_version,
          title,
          content,
          content_format,
          formatting,
          document_type,
          citation_style,
          assets,
          outline,
          research_notes,
          edit_history,
          sources,
          folder_id,
        }
      );

      if (conflict) {
        // Version conflict - fetch latest document
        const latestDoc = await DocumentModel.findById(id);

        return res.status(409).json({
          error: "Conflict: Document has been modified since you last fetched it",
          client_version,
          current_version: latestDoc?.version,
          latest_document: transformDocument(latestDoc),
        });
      }

      return res.json(transformDocument(document));
    } catch (error: any) {
      console.error("Error updating document:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Delete document
   * DELETE /api/documents/:id
   *
   * MIGRATED FROM press-backend: DocumentDetailView (DELETE)
   * CHANGES:
   * - Only owner can delete document
   * - Multi-tenancy enforced by ownership check
   */
  static async delete(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: "Document ID is required" });
        return 
      }

      const deleted = await DocumentModel.delete(id, userId);

      if (!deleted) {
        res.status(404).json({ error: "Document not found" });
        return 
      }

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting document:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Move document to different folder
   * PUT /api/documents/:id/move
   *
   * MIGRATED FROM press-backend: DocumentMoveView (PUT)
   * CHANGES:
   * - Validates target folder belongs to user
   * - Multi-tenancy: folder must belong to same user as document
   */
  static async move(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      // Accept 'folder' from frontend API format, map to folder_id for model
      const { folder } = req.body;
      const folder_id = folder;

      if (!id) {
        return res.status(400).json({ error: "Document ID is required" });
      }

      // Check document ownership
      const exists = await DocumentModel.isOwner(id, userId);
      if (!exists) {
        return res.status(404).json({ error: "Document not found" });
      }

      // If folder_id provided, validate it belongs to user
      if (folder_id) {
        const folderExists = await FolderModel.isOwner(folder_id, userId);
        if (!folderExists) {
          return res.status(404).json({ error: "Folder not found" });
        }
      }

      const document = await DocumentModel.moveToFolder(
        id,
        folder_id || null,
        userId
      );

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      return res.json(transformDocument(document));
    } catch (error: any) {
      console.error("Error moving document:", error);
      return res.status(500).json({ error: error.message });
    }
  }
}
