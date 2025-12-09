
import { Router, Request, Response, NextFunction } from "express";
import express from 'express';
import {
  calculateUpgradePreview,
  createBillingPortal,
  createPlanCheckoutSession,
  createPlanPaymentIntent,
  createSetupIntent,
  getPaymentHistory,
  getPaymentStatus,
  getSavedCards,
  getStripeConfig,
  handleSlackRefundApprove,
  refundRequest,
  removeCard,
  setDefaultCard,
  upgradePlan
} from "../controllers/payment.controller.js";
import { authenticateAccount, authenticateWithoutSchool } from "../middleware/auth.middleware.js";
import { paymentUpgradeLimiter } from "../middleware/security.middleware.js";

const router = Router();

router.get("/config", getStripeConfig);

router.post(
  "/checkout-session",
  authenticateAccount,
  createPlanCheckoutSession
);
router.post(
  "/checkout-session-intent",
  authenticateAccount,
  createPlanPaymentIntent
);


router.get("/status/:sessionId", authenticateAccount, getPaymentStatus);

router.get("/history",authenticateWithoutSchool, getPaymentHistory);
router.post("/refund-request",authenticateWithoutSchool, refundRequest);
router.post(
  "/slack-refund-approve",
  express.urlencoded({ extended: true }),
  (req, res, next) => {
    console.log("Slack request received at /slack-refund-approve");
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    next();
  },
  handleSlackRefundApprove
);

router.post(
  "/create-setup-intent",
  authenticateWithoutSchool,
  createSetupIntent
);

router.post(
  "/set-default-card",
  authenticateWithoutSchool,
  setDefaultCard
);

router.post(
  "/remove-card",
  authenticateWithoutSchool,
  removeCard
);
router.get(
  "/saved-cards",
 authenticateWithoutSchool,
  getSavedCards
);
router.post(
  "/create-billing-portal",
  authenticateWithoutSchool,
  createBillingPortal
);
router.post("/calculate-upgrade", authenticateWithoutSchool, paymentUpgradeLimiter, calculateUpgradePreview);
router.post("/upgrade-plan", authenticateWithoutSchool, paymentUpgradeLimiter, upgradePlan);


export default router;
