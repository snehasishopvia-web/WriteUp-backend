import { Router } from "express";
import { ProfileController } from "../controllers/profile.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { attachSchool } from "../middleware/school.middleware.js";

const router = Router();

// Apply authentication and school middleware to all routes
router.use(authenticate);
router.use(attachSchool);

// Teacher Profile Routes
router.get("/teacher/:userId", ProfileController.getTeacherProfile);
router.get("/teachers", ProfileController.getAllTeacherProfiles);
router.post("/teacher", ProfileController.createTeacherProfile);
router.put("/teacher/:id", ProfileController.updateTeacherProfile);
router.delete("/teacher/:id", ProfileController.deleteTeacherProfile);
router.get(
  "/teachers/department/:departmentId",
  ProfileController.getTeachersByDepartment
);

// Student Profile Routes
router.get("/student/:userId", ProfileController.getStudentProfile);
router.get("/students", ProfileController.getAllStudentProfiles);
router.post("/student", ProfileController.createStudentProfile);
router.put("/student/:id", ProfileController.updateStudentProfile);
router.delete("/student/:id", ProfileController.deleteStudentProfile);
router.get("/students/class/:classId", ProfileController.getStudentsByClass);

export default router;
