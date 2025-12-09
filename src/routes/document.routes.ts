import { Router } from "express";
import { DocumentController } from "../controllers/document.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

/**
 * Document Routes
 *
 * All routes migrated from press-backend Django API
 * All routes require authentication
 */

// Apply authentication middleware to all routes
router.use(authenticate);

// List user's documents / Create new document
// Migrated from: DocumentListCreateView
router.get("/", DocumentController.list);
router.post("/", DocumentController.create);

// Get document details / Update document / Delete document
// Migrated from: DocumentDetailView
router.get("/:id", DocumentController.getById);
router.put("/:id", DocumentController.update);
router.delete("/:id", DocumentController.delete);

// Move document to different folder
// Migrated from: DocumentMoveView
router.put("/:id/move", DocumentController.move);

export default router;
