import { Router } from "express";
import {
  saveOnboardingData,
  getAdminSchool,
  getSchoolOptions,
  saveAdditionalPrograms,
  completeOnboardingStep,
  checkOnboardingStatus,
  uploadTeachers,
  uploadTeacherMiddleware,
  uploadStudents,
  uploadStudentMiddleware,
  deleteTeacherUpload,
  deleteStudentUpload,
  getSchoolTeacher,
  inviteTeachersManually,
} from "../controllers/onboarding.controller.js";
import {
  authenticate,
  authenticateWithoutSchool,
} from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/authorization.middleware.js";
import { attachSchool } from "../middleware/school.middleware.js";
import {
  saveOnboardingDataValidator,
  saveProgramsValidator,
  completeStepValidator,
} from "../validators/onboarding.validator.js";
import { checkValidation } from "@/middleware/error.middleware.js";

const router = Router();

// All routes require authentication
// router.use(authenticate);

/**
 * @route   POST /api/v1/auth/onboarding/save-data
 * @desc    Save school onboarding data (Step 3) - No school middleware (school created here)
 * @access  Private (Admin only)
 */
router.post(
  "/save-data",

  authenticateWithoutSchool,
  saveOnboardingDataValidator,
  checkValidation,
  saveOnboardingData
);

/**
 * @route   GET /api/v1/auth/onboarding/admin-school
 * @desc    Get admin's school information
 * @access  Private (Admin only)
 */
router.get("/admin-school", authenticate, requireAdmin, getAdminSchool);

/**
 * @route   GET /api/v1/auth/onboarding/school-options
 * @desc    Get available school type and class structure options
 * @access  Private (Admin only)
 */
router.get("/school-options", authenticateWithoutSchool, getSchoolOptions);

/**
 * @route   POST /api/v1/auth/onboarding/save-programs
 * @desc    Save additional programs (Step 4) - Requires school
 * @access  Private (Admin only)
 */
router.post(
  "/save-programs",

  authenticate,
  attachSchool,
  saveProgramsValidator,
  checkValidation,
  saveAdditionalPrograms
);

/**
 * @route   POST /api/v1/auth/onboarding/complete-step
 * @desc    Mark an onboarding step as complete
 * @access  Private (Admin only)
 */
router.post(
  "/complete-step",

  authenticate,
  attachSchool,
  completeStepValidator,
  checkValidation,
  completeOnboardingStep
);

/**
 * @route   GET /api/v1/auth/onboarding/check-status
 * @desc    Check if admin needs onboarding
 * @access  Private
 */
router.get("/check-status", authenticate, checkOnboardingStatus);

/**
 * @route   POST /api/v1/auth/onboarding/upload-teachers
 * @desc    Upload teachers via CSV (Step 5) - Requires school
 * @access  Private (Admin only)
 */
router.post(
  "/upload-teachers",

  authenticate,
  requireAdmin,
  attachSchool,
  uploadTeacherMiddleware,
  uploadTeachers
);

/**
 * @route   POST /api/v1/auth/onboarding/upload-students
 * @desc    Upload students via CSV (Step 6) - Requires school
 * @access  Private (Admin and Teachers)
 */
router.post(
  "/upload-students",

  authenticate,
  attachSchool,
  uploadStudentMiddleware,
  uploadStudents
);

/**
 * @route   DELETE /api/v1/auth/onboarding/delete-teacher-upload
 * @desc    Delete teacher upload information
 * @access  Private (Admin only)
 */
router.delete(
  "/delete-teacher-upload",
  authenticate,
  requireAdmin,
  deleteTeacherUpload
);

/**
 * @route   DELETE /api/v1/auth/onboarding/delete-student-upload
 * @desc    Delete student upload information
 * @access  Private (Admin only)
 */
router.delete("/delete-student-upload", authenticate, deleteStudentUpload);

router.get("/get-school-teacher", authenticate, getSchoolTeacher);

router.post(
  "/invite-teachers-manually",
  authenticate,
  requireAdmin,
  attachSchool,
  inviteTeachersManually
);

export default router;
