import { Router } from "express";
import {
  checkEmailExists,
  createSignupUser,
  verifyEmailToken,
  resendVerificationEmail,
  getSignupStatus,
  updateOnboardingStep,
  changeSelectedPlan,
  completeSignupAfterPayment,
} from "../controllers/signup.controller";
import { authenticateWithoutSchool } from "../middleware/auth.middleware.js";

const router = Router();

//  Check email existence
router.post("/check-email", checkEmailExists);

// Create new signup user
router.post("/", createSignupUser);

//  Verify email from link
router.get("/verify", verifyEmailToken);

//  Resend verification email
router.post("/resend-verification", resendVerificationEmail);

//  Get signup/onboarding status
router.get("/status/:email", getSignupStatus);

// Update onboarding step (after plan selection, etc.)
router.put("/step", authenticateWithoutSchool, updateOnboardingStep);

//  Change selected plan before payment
router.put("/change-plan",  changeSelectedPlan);

//  Finalize signup after payment
router.post("/complete", authenticateWithoutSchool, completeSignupAfterPayment);

export default router;
