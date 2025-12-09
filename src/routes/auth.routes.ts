import { Router } from "express";
import {
  register,
  login,
  refreshToken,
  logout,
  getUserProfile,
  updateUserProfile,
  requestPasswordReset,
  resetPassword,
  checkSchoolKey,
  studentRegister,
  studentRegisterWithEmail,
  getUserPlanDetails,
} from "../controllers/auth.controller.js";
import {
  authenticate,
  authenticateWithoutSchool,
} from "../middleware/auth.middleware.js";
import { checkValidation } from "../middleware/error.middleware.js";
import {
  registerValidator,
  loginValidator,
  refreshTokenValidator,
  logoutValidator,
  updateProfileValidator,
  passwordResetRequestValidator,
  passwordResetValidator,
} from "../validators/auth.validator.js";

const router = Router();

// Authentication endpoints
router.post("/register", registerValidator, checkValidation, register);
router.post("/token", loginValidator, checkValidation, login);
router.post("/refresh", refreshTokenValidator, checkValidation, refreshToken);
router.post("/logout", logoutValidator, checkValidation, logout);

// Password reset endpoints
router.post(
  "/password-reset",
  passwordResetRequestValidator,
  checkValidation,
  requestPasswordReset
);
router.post(
  "/password-reset/confirm",
  passwordResetValidator,
  checkValidation,
  resetPassword
);

// User profile endpoints
router.get("/user", authenticateWithoutSchool, getUserProfile);
router.put(
  "/user",

  authenticateWithoutSchool,
  updateProfileValidator,
  checkValidation,
  updateUserProfile
);
router.post("/check-school-key", checkSchoolKey);
router.post("/student-register", studentRegister);
router.post("/student-register-email", studentRegisterWithEmail);
router.get("/user-plan", authenticateWithoutSchool, getUserPlanDetails);

export default router;
