import { Router } from "express";
import { FolderController } from "../controllers/folder.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

/**
 * Folder Routes
 *
 * All routes migrated from press-backend Django API
 * All routes require authentication
 */

// Apply authentication middleware to all routes
router.use(authenticate);

// List user's folders / Create new folder
// Migrated from: FolderListCreateView
router.get("/", FolderController.list);
router.post("/", FolderController.create);

// Get folder details / Update folder / Delete folder
// Migrated from: FolderDetailView
router.get("/:id", FolderController.getById);
router.put("/:id", FolderController.update);
router.delete("/:id", FolderController.delete);

// Move folder to different parent
// Migrated from: FolderMoveView
router.put("/:id/move", FolderController.move);

export default router;
