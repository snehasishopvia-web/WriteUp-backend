import { Router } from "express";
import { TeacherFeedbackController } from "../controllers/teacher-feedback.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create a new feedback
router.post("/", TeacherFeedbackController.create);

// Get all feedbacks with filters
router.get("/", TeacherFeedbackController.list);

// Get a single feedback by ID
router.get("/:id", TeacherFeedbackController.getById);

// Update a feedback by ID
router.put("/:id", TeacherFeedbackController.update);

// Delete a feedback by ID
router.delete("/:id", TeacherFeedbackController.delete);

export default router;
