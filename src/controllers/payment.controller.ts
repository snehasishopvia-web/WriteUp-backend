import { Request, Response, NextFunction } from "express";
import {
  createCheckoutSession,
  createPaymentIntent,
} from "../services/stripe-checkout.service.js";
import { createError } from "../middleware/error.middleware.js";
import { PaymentModel } from "../models/payment.model.js";
// import { sendPaymentStatusEmail } from "../services/email.service.js";
import { AccountModel } from "../models/account.model.js";
import { getAddonPrices } from "@/helper/getTeacherAddonPrice.js";
import stripe from "@/config/stripe.js";
import { pool } from "@/config/postgres.db.js";
import { PlanModel } from "@/models/plan.model.js";
import { sendAdminRefundEmail } from "@/utils/sendRefundRequestEmail.js";
import { sendSlackRefundAlert } from "@/config/sendSlackRefundAlert.js";
import { StripeCustomerModel } from "@/models/stripe-customer.model.js";
import { UserModel } from "@/models/user.model.js";

// Cache for addon product IDs to avoid repeated API calls
const addonProductCache: { [key: string]: string } = {};

/**
 * Get or create Stripe products for addons
 */
async function getOrCreateAddonProduct(type: "student" | "teacher"): Promise<string> {
  const cacheKey = `addon_${type}`;
  
  // Return cached product ID if available
  if (addonProductCache[cacheKey]) {
    return addonProductCache[cacheKey];
  }
  
  const productName = type === "student" ? "Additional Students" : "Additional Teachers";
  
  try {
    // Search for existing product
    const products = await stripe.products.search({
      query: `name:'${productName}' AND active:'true'`,
    });
    
    if (products.data.length > 0 && products.data[0]) {
      addonProductCache[cacheKey] = products.data[0].id;
      return products.data[0].id;
    }
    
    // Create new product if not found
    const product = await stripe.products.create({
      name: productName,
      metadata: { type: `${type}_addon` },
    });
    
    addonProductCache[cacheKey] = product.id;
    return product.id;
  } catch (error) {
    console.error(`Error getting/creating ${type} addon product:`, error);
    throw error;
  }
}

const getSuccessUrl = (planSlug: string, fallback?: string): string => {
  console.log("planSlug received in getSuccessUrl: ", planSlug);
  const envUrl = process.env.STRIPE_CHECKOUT_SUCCESS_URL?.replace(/\/$/, "");
  const adminUrl= process.env.ADMIN_FRONTEND_URL
  const teacherUrl= process.env.TEACHER_FRONTEND_URL

  if (planSlug === "single-class") {
    return `${teacherUrl}/?status=success`;
  } else if (planSlug === "multi-class") {
    return `${adminUrl}/?status=success`;
  } else if (planSlug === "department") {
    return `${adminUrl}/?status=success`;
  } else if (planSlug === "school") {
    return `${adminUrl}/?status=success`;
  }
  return envUrl || fallback || `${process.env.FRONTEND_URL}/?status=success`;
};

const getCancelUrl = (fallback?: string): string => {
  const envUrl = process.env.STRIPE_CHECKOUT_CANCEL_URL;
  return envUrl || fallback || `${process.env.FRONTEND_URL}/?status=cancel`;
};

export const getStripeConfig = (_req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    data: {
      publishableKey: process.env.STRIPE_PUBLISHable_KEY || "",
      successUrl: getSuccessUrl(""),
      cancelUrl: getCancelUrl(),
    },
  });
};

export const createPlanCheckoutSession = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const accountId = req.accountId ?? req.account?.id;
    if (!accountId)
      throw createError(
        "Authentication required before creating checkout session",
        401
      );

    const { planSlug, purchaseType, addons } = req.body as {
      planSlug?: string;
      purchaseType?: "one_time" | "subscription";
      successUrl?: string;
      cancelUrl?: string;
      addons?: { students: number; teachers: number };
    };
    console.log("^^^^^^^^^^^^^^^^^^^^^", addons);
    if (!planSlug)
      throw createError("planSlug is required to create checkout session", 400);
    if (!purchaseType)
      throw createError(
        "purchaseType must be either 'one_time' or 'subscription'",
        400
      );
    console.log("!!!!!!!!!!!!!!!!!!!1", planSlug, purchaseType);
    const successUrl = getSuccessUrl(planSlug, req.body?.successUrl);
    const cancelUrl = getCancelUrl(req.body?.cancelUrl);
    const { session, amount, currency, mode } = await createCheckoutSession({
      accountId,
      planSlug,
      purchaseType,
      successUrl,
      cancelUrl,
      addons,
    });

    res.status(200).json({
      status: "success",
      data: {
        sessionId: session.id,
        url: session.url,
        amount,
        currency,
        mode,
      },
    });
  } catch (error) {
    console.log("^^^^^^^^^^^^^^^^^^6", error);
    next(error);
  }
};

export const getPaymentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) throw createError("sessionId parameter is required", 400);

    const payment = await PaymentModel.findByIntentId(sessionId);
    if (!payment) throw createError("Payment not found", 404);

    const accountId = req.accountId ?? req.account?.id;
    if (accountId && payment.account_id && payment.account_id !== accountId)
      throw createError("You do not have access to this payment record.", 403);

    res.status(200).json({
      status: "success",
      data: {
        payment,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const notifyPaymentFailure = async (
  sessionId: string,
  reason?: string
) => {
  const payment = await PaymentModel.findByIntentId(sessionId);
  if (!payment) return;
  if (payment.email_sent_at) return;

  const accountId = payment.account_id;
  if (!accountId) return;

  const account = await AccountModel.findById(accountId);
  if (!account || !account.owner_email) return;

  // await sendPaymentStatusEmail({
  //   to: user.email,
  //   planName: String(payment.metadata?.planName ?? "Selected plan"),
  //   amount: Number(payment.metadata?.amount ?? payment.amount_cents / 100),
  //   currency: payment.currency,
  //   status: "failed",
  //   reason,
  // });

  await PaymentModel.markEmailSent(sessionId);
};

export const notifyPaymentSuccess = async (sessionId: string) => {
  const payment = await PaymentModel.findByIntentId(sessionId);
  if (!payment) return;
  if (payment.email_sent_at) return;

  const accountId = payment.account_id;
  if (!accountId) return;

  const account = await AccountModel.findById(accountId);
  if (!account || !account.owner_email) return;

  // await sendPaymentStatusEmail({
  //   to: user.email,
  //   planName: String(payment.metadata?.planName ?? "Selected plan"),
  //   amount: Number(payment.metadata?.amount ?? payment.amount_cents / 100),
  //   currency: payment.currency,
  //   status: "succeeded",
  // });

  await PaymentModel.markEmailSent(sessionId);
};

export const createPlanPaymentIntent = async (req: Request, res: Response) => {
  try {
    const accountId = req.accountId;
    const { planSlug, purchaseType, addons, paymentMethodId } = req.body;

    console.log("Received /checkout-session-intent body:", req.body);
    
    // 1. authentication check
    if (!accountId) {
      return res.status(401).json({ 
        status: "error", 
        message: "Authentication required",
        code: "AUTH_REQUIRED"
      });
    }

    if (!planSlug || typeof planSlug !== 'string') {
      return res.status(400).json({ 
        status: "error", 
        message: "planSlug is required and must be a string",
        code: "INVALID_PLAN_SLUG"
      });
    }
    
    if (!purchaseType || (purchaseType !== "one_time" && purchaseType !== "subscription")) {
      return res.status(400).json({ 
        status: "error", 
        message: "purchaseType must be 'one_time' or 'subscription'",
        code: "INVALID_PURCHASE_TYPE"
      });
    }

    if (addons) {
      if (typeof addons !== 'object' || Array.isArray(addons)) {
        return res.status(400).json({ 
          status: "error", 
          message: "addons must be an object",
          code: "INVALID_ADDONS_FORMAT"
        });
      }
      
      // Validate addon quantities 
      if (addons.students !== undefined) {
        const students = Number(addons.students);
        if (!Number.isInteger(students) || students < 0 || students > 10000) {
          return res.status(400).json({ 
            status: "error", 
            message: "students must be a positive integer between 0 and 10000",
            code: "INVALID_STUDENTS_COUNT"
          });
        }
      }
      
      if (addons.teachers !== undefined) {
        const teachers = Number(addons.teachers);
        if (!Number.isInteger(teachers) || teachers < 0 || teachers > 1000) {
          return res.status(400).json({ 
            status: "error", 
            message: "teachers must be a positive integer between 0 and 1000",
            code: "INVALID_TEACHERS_COUNT"
          });
        }
      }
    }

    // verify the account is exists and active or not
    const account = await AccountModel.findById(accountId);
    if (!account) {
      return res.status(404).json({ 
        status: "error", 
        message: "Account not found",
        code: "ACCOUNT_NOT_FOUND"
      });
    }

    // verify the plan exists and is available
    const plan = await PlanModel.findBySlug(planSlug);
    if (!plan) {
      return res.status(404).json({ 
        status: "error", 
        message: "Plan not found",
        code: "PLAN_NOT_FOUND"
      });
    }

    // validate plan has correct price for purchase type
    if (purchaseType === 'subscription' && !plan.price_monthly) {
      return res.status(400).json({ 
        status: "error", 
        message: "Monthly subscription not available for this plan",
        code: "MONTHLY_NOT_AVAILABLE"
      });
    }
    
    if (purchaseType === 'one_time' && !plan.price_yearly) {
      return res.status(400).json({ 
        status: "error", 
        message: "Yearly purchase not available for this plan",
        code: "YEARLY_NOT_AVAILABLE"
      });
    }
    
    // check if user already has an active subscription or recent payment
    const existingPaymentCheck = await pool.query(
      `SELECT p.*, pl.slug as plan_slug, pl.name as plan_name
       FROM payments p
       LEFT JOIN plans pl ON pl.id = p.plan_id
       WHERE p.account_id = $1 
       AND p.status IN ('succeeded', 'pending', 'trialing')
       ORDER BY p.created_at DESC 
       LIMIT 1`,
      [accountId]
    );

    if (existingPaymentCheck.rows.length > 0) {
      const existingPayment = existingPaymentCheck.rows[0];
      const paymentDate = new Date(existingPayment.created_at);
      const hoursSincePayment = (Date.now() - paymentDate.getTime()) / (1000 * 60 * 60);

      // Check for active subscription in Stripe
      let hasActiveSubscription = false;
      let activeSubscription: any = null;
      
      try {
        const stripeCustomer = await PaymentModel.findByAccountId(accountId);
        if (stripeCustomer?.stripe_subscription_id) {
          const subscription = await stripe.subscriptions.retrieve(stripeCustomer.stripe_subscription_id);
          if (subscription.status === "active" || subscription.status === "trialing") {
            hasActiveSubscription = true;
            activeSubscription = subscription;
          }
        }
      } catch (err) {
        console.error("Error checking existing subscription:", err);
      }

      // User has active subscription - block ALL new purchases for both monthly and yearly
      if (hasActiveSubscription) {
        return res.status(400).json({
          status: "error",
          message: "You already have an active subscription. Please cancel your current subscription before purchasing a new plan, or use the upgrade feature to change plans.",
          code: "ACTIVE_SUBSCRIPTION_EXISTS",
          existingSubscription: {
            id: activeSubscription.id,
            status: activeSubscription.status,
            currentPeriodEnd: (activeSubscription as any).current_period_end,
            plan: existingPayment.plan_name,
          }
        });
      }

      // prevent duplicate yearly purchases within 7 days
      if (purchaseType === "one_time" && existingPayment.mode === "one_time" && existingPayment.status === "succeeded") {
        const hoursIn7Days = 7 * 24;
        if (hoursSincePayment < hoursIn7Days) {
          return res.status(400).json({
            status: "error",
            message: `You already purchased a plan ${Math.floor(hoursSincePayment)} hours ago. Please wait at least 7 days before making another yearly purchase, or use the upgrade feature to change your plan.`,
            code: "DUPLICATE_YEARLY_PURCHASE",
            existingPayment: {
              id: existingPayment.id,
              date: existingPayment.created_at,
              amount: existingPayment.amount_cents / 100,
              plan: existingPayment.plan_name,
              hoursAgo: Math.floor(hoursSincePayment),
            }
          });
        }
      }

      // prevent any duplicate purchases within 1 hour (check for double clicks by mistake)
      if (hoursSincePayment < 1) {
        return res.status(400).json({
          status: "error",
          message: "You just made a purchase. Please wait at least 1 hour before making another purchase to prevent accidental duplicate charges.",
          code: "RATE_LIMIT_EXCEEDED",
          existingPayment: {
            id: existingPayment.id,
            date: existingPayment.created_at,
            amount: existingPayment.amount_cents / 100,
            plan: existingPayment.plan_name,
            minutesAgo: Math.floor(hoursSincePayment * 60),
          }
        });
      }
    }

    // Create payment intent with retry logic for transient errors
    let result;
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount <= maxRetries) {
      try {
        result = await createPaymentIntent({
          accountId,
          planSlug,
          purchaseType,
          addons,
        });
        break;
      } catch (err: any) {
        retryCount++;
        
        // Only retry on transient stripe errors
        const isRetryable = err.type === 'StripeConnectionError' || 
                           err.type === 'StripeAPIError' ||
                           err.statusCode === 500 ||
                           err.statusCode === 503;
        
        if (retryCount > maxRetries || !isRetryable) {
          console.error("Failed to create payment intent after retries:", {
            error: err.message,
            type: err.type,
            retryCount,
            accountId,
          });
          throw err;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        console.log(`Retrying payment intent creation (attempt ${retryCount + 1}/${maxRetries + 1})`);
      }
    }

    if (!result) {
      throw new Error("Failed to create payment intent");
    }

    // For subscriptions, validate subscription was created successfully
    if (purchaseType === "subscription" && !result.subscriptionId) {
      console.error("Subscription creation failed - no subscription ID:", result);
      throw new Error("Failed to create subscription - no subscription ID returned");
    }

    // Validate amount is reasonable
    const { studentPrice: calculatedStudentPrice, teacherPrice: calculatedTeacherPrice } = getAddonPrices(plan, purchaseType);
    const calculatedAddonCost = (addons?.students || 0) * calculatedStudentPrice + (addons?.teachers || 0) * calculatedTeacherPrice;
    const expectedBasePrice = purchaseType === 'subscription' ? plan.price_monthly : plan.price_yearly;
    const expectedTotal = Number(expectedBasePrice) + calculatedAddonCost;
    
    // strictly check the differences within 1%
    if (Math.abs(result.amount - expectedTotal) > expectedTotal * 0.01) {
      console.error("Amount mismatch detected:", {
        calculated: expectedTotal,
        received: result.amount,
        difference: result.amount - expectedTotal,
        planSlug,
        purchaseType,
        addons,
      });
      throw new Error("Payment amount validation failed - please contact support");
    }
    // (Only applicable for monthly, not for yearly purchases)
    if (paymentMethodId && result.subscriptionId) {
      try {
        // Find stripe customer id for this account
        const stripeCustomer = await StripeCustomerModel.findByAccountId(
          accountId
        );
        const stripeCustomerId = stripeCustomer?.stripe_customer_id;
        if (!stripeCustomerId) {
          console.warn(
            "No stripe customer found while attaching payment method",
            { accountId }
          );
        } else {
          // Attach payment method to customer
          await stripe.paymentMethods.attach(paymentMethodId, {
            customer: stripeCustomerId,
          });

          // update customer default invoice payment method
          await stripe.customers.update(stripeCustomerId, {
            invoice_settings: { default_payment_method: paymentMethodId },
          });

          // Set subscription default payment method
          await stripe.subscriptions.update(result.subscriptionId, {
            default_payment_method: paymentMethodId,
          });

          console.log("Payment method attached successfully to subscription:", result.subscriptionId);
        }
      } catch (err: any) {
        console.error("Failed to attach payment method to subscription:", err);
      }
    }

    // Update account subscription status if it is a monthly plan
    if (result.subscriptionId) {
      try {
        // Determine subscription status based on purchase type and trial days 
        const subscriptionStatus = 
          purchaseType === "subscription" && result.trialDays && result.trialDays > 0
            ? "trialing"
            : "pending"; 

        await pool.query(
          `UPDATE accounts SET subscription_status = $1, updated_at = NOW() WHERE id = $2`,
          [subscriptionStatus, accountId]
        );

        console.log(`Updated account ${accountId} subscription status to: ${subscriptionStatus}`);
      } catch (err: any) {
        console.error("Failed to update account with subscription status:", err);
      }
    }

    const { studentPrice, teacherPrice } = getAddonPrices(plan, purchaseType);

    const totalAddonCost =
      (addons?.students || 0) * studentPrice + (addons?.teachers || 0) * teacherPrice;

    const totalCost = result.amount;

    const successUrl = `${getSuccessUrl(planSlug)}?redirect=true`;
    const cancelUrl = getCancelUrl();

    
    // validate that we have a clientSecret for frontend to confirm payment
    if (!result.clientSecret) {
      console.error("No clientSecret returned from createPaymentIntent", {
        subscriptionId: result.subscriptionId,
        mode: result.mode,
        trialDays: result.trialDays,
        accountId,
        planSlug,
      });
      return res.status(500).json({
        status: "error",
        message: "Failed to initialize payment - please try again or contact support",
        code: "MISSING_CLIENT_SECRET"
      });
    }

    return res.status(200).json({
      status: "success",
      data: {
        ...result,
        addons: {
          ...addons,
          totalAddonCost,
          totalCost,
        },
        successUrl,
        cancelUrl,
      },
    });
  } catch (err: any) {
    console.error("Error in createPlanPaymentIntent:", {
      error: err.message,
      stack: err.stack,
      accountId: req.accountId,
      body: req.body,
    });
    return res.status(500).json({
      status: "error",
      message: err.message || "Failed to create payment intent",
    });
  }
};

export const getPaymentHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res
        .status(401)
        .json({ error: "Unauthorized: User not found in token" });
    }

    const userResult = await pool.query(
      `SELECT account_id FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const accountId = userResult.rows[0].account_id;

    if (!accountId) {
      return res.status(400).json({ error: "No account linked to this user" });
    }

    // Fetch only successful payments not for pending
    const result = await pool.query(
      `
      SELECT 
        p.*, 
        pl.name AS plan_name
      FROM payments p
      LEFT JOIN plans pl ON pl.id = p.plan_id
      WHERE p.account_id = $1
        AND p.status = 'succeeded'
      ORDER BY p.created_at DESC
      `,
      [accountId]
    );

    if (result.rowCount === 0) {
      return res.json({ payments: [] });
    }

    // Build payments array with card info
    const payments = await Promise.all(
      result.rows.map(async (payment) => {
        let cardDetails: any = null;
        let invoiceUrl: string | null = null;

        let receiptUrl: string | null = null;
        // Retrieve real stripe info only for successful payments
        if (payment.stripe_payment_intent_id) {
          const pi = await stripe.paymentIntents.retrieve(
            payment.stripe_payment_intent_id,
            { expand: ['latest_charge', 'invoice'] }
          );

          //contains card info
          if (pi.latest_charge) {
            // const charge = await stripe.charges.retrieve(
            //   pi.latest_charge as string
            // );
             const charge: any = pi.latest_charge;
            receiptUrl = charge.receipt_url;

            const card = charge.payment_method_details?.card;
            const billing = charge.billing_details;

            if (card) {
              cardDetails = {
                brand: card.brand,
                last4: card.last4,
                masked_number: `**** **** **** ${card.last4}`,
                exp_month: card.exp_month,
                exp_year: card.exp_year,
                country: card.country,
                name: billing?.name || null,
                address: billing?.address || null,
              };
            }
          }

          // Retrieve invoice
          if ((pi as any).invoice) {
            const invoice = await stripe.invoices.retrieve(
              (pi as any).invoice as string
            );
            invoiceUrl =
              invoice.hosted_invoice_url || invoice.invoice_pdf || null;
          }
        }

        return {
          id: payment.id,
          date: payment.created_at,
          plan: payment.plan_name,
          addons: payment.addons,
          amount: payment.amount_cents / 100,
          mode: payment.mode,
          invoice_url: invoiceUrl || receiptUrl,
          card: cardDetails,
          status: payment.status,
        };
      })
    );

    return res.json({ payments });
  } catch (err: any) {
    console.error("ERROR in getPaymentHistory:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const refundRequest = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    console.log("User ID from token:", userId);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const userRes = await pool.query(
      `SELECT u.account_id, u.first_name, u.last_name, u.email, a.plan_id 
       FROM users u
       JOIN accounts a ON u.account_id = a.id
       WHERE u.id = $1`,
      [userId]
    );
    if (userRes.rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    const {
      account_id: accountId,
      first_name,
      last_name,
      email,
      plan_id,
    } = userRes.rows[0];

    if (!accountId)
      return res.status(400).json({ error: "No account linked to this user" });

    // Get last payment
    const paymentRes = await pool.query(
      "SELECT * FROM payments WHERE account_id = $1 ORDER BY created_at DESC LIMIT 1",
      [accountId]
    );
    if (paymentRes.rows.length === 0)
      return res.status(404).json({ error: "No payments found" });

    const payment = paymentRes.rows[0];

    // Check 30-day refund
    const diffDays =
      (Date.now() - new Date(payment.created_at).getTime()) /
      (1000 * 60 * 60 * 24);
    if (diffDays > 30)
      return res.status(400).json({ error: "Refund period expired (30 days)" });

    const reason = req.body?.reason || "Not specified";

    // Insert refund request
    const refundRes = await pool.query(
      `INSERT INTO refund_requests 
       (payment_id, user_id, account_id, amount, status, reason)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        payment.id,
        userId,
        accountId,
        payment.amount_cents / 100,
        "pending",
        reason,
      ]
    );

    // Get plan name
    const planRes = await pool.query("SELECT name FROM plans WHERE id = $1", [
      plan_id,
    ]);
    const planName = planRes.rows.length
      ? planRes.rows[0].name
      : "Unknown Plan";

    await sendSlackRefundAlert({
      user_name: `${first_name} ${last_name}`,
      user_email: email,
      plan_name: planName,
      amount_cents: payment.amount_cents,
      created_at: payment.created_at,
      reason,
      refund_id: refundRes.rows[0].id,
    });
    await sendAdminRefundEmail({
      id: refundRes.rows[0].id,
      user_name: `${first_name} ${last_name}`,
      user_email: email,
    });

    return res.json({ message: "Refund request submitted" });
  } catch (err: any) {
    console.log("$$error", err);
    return res.status(500).json({ error: err.message });
  }
};

export const handleSlackRefundApprove = async (req: Request, res: Response) => {
  try {
    const payloadRaw = req.body.payload;
    if (!payloadRaw) return res.status(400).send("No payload received");

    const payload = JSON.parse(payloadRaw);
    const requestId = payload.actions?.[0]?.value;
    if (!requestId) return res.status(400).send("No refund ID found");

    res.status(200).send({ text: "Refund approval is being processed..." });

    // Call your existing approveRefund
    const mockReq = { body: { requestId } } as any;
    const mockRes = {
      json: (data: any) => console.log("Refund approved:", data),
      status: (code: number) => ({
        json: (data: any) => console.log(code, data),
      }),
    } as any;

    await approveRefund(mockReq, mockRes);
  } catch (err) {
    console.error("Slack refund approval error:", err);
    return res.status(500).send("Failed to process refund");
  }
};

export const approveRefund = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.body;
    if (!requestId)
      return res.status(400).json({ error: "Refund request ID is required" });

    const reqRes = await pool.query(
      `
  SELECT rr.*, 
         p.stripe_payment_intent_id, 
         p.amount_cents, 
         u.first_name, 
         u.last_name, 
         u.email, 
         a.owner_name, 
         a.company_name,
         pl.name AS plan_name
  FROM refund_requests rr
  JOIN payments p ON rr.payment_id = p.id
  JOIN users u ON rr.user_id = u.id
  JOIN accounts a ON rr.account_id = a.id
  LEFT JOIN plans pl ON pl.id = p.plan_id
  WHERE rr.id = $1
  `,
      [requestId]
    );

    if (reqRes.rows.length === 0)
      return res.status(404).json({ error: "Refund request not found" });

    const refundRequest = reqRes.rows[0];

    if (refundRequest.status === "approved") {
      return res
        .status(400)
        .json({ error: "Refund already approved / issued" });
    }

    //  Issue refund via Stripe
    const refund = await stripe.refunds.create({
      payment_intent: refundRequest.stripe_payment_intent_id,
      amount: refundRequest.amount_cents,
    });

    await pool.query(
      `
      UPDATE refund_requests
      SET status = 'approved',
          approved_at = NOW(),
          stripe_refund_id = $1
      WHERE id = $2
      `,
      [refund.id, requestId]
    );

    //  Notify admin via Slack
    await sendSlackRefundAlert({
      user_name: `${refundRequest.first_name} ${refundRequest.last_name}`,
      user_email: refundRequest.email,
      plan_name: refundRequest.plan_name || "N/A",
      created_at: refundRequest.created_at,
      amount_cents: refundRequest.amount_cents,
      reason: refundRequest.reason,
      status: "approved",
    });

    return res.json({ message: "Refund approved & issued successfully" });
  } catch (err: any) {
    console.error("Approve refund error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const createSetupIntent = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const userId = user.id;

    const result = await pool.query(
      `SELECT stripe_customer_id 
       FROM stripe_customers 
       WHERE user_id = $1`,
      [userId]
    );
    const customerId = result.rows[0]?.stripe_customer_id;

    if (!customerId) {
      return res.status(400).json({ error: "Stripe customer not found" });
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
    });

    return res.json({ clientSecret: setupIntent.client_secret });
  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ error: err.message });
  }
};

export const setDefaultCard = async (req: Request, res: Response) => {
  try {
    const { paymentMethodId } = req.body;
    const userId = (req as any).user?.id;

    if (!paymentMethodId)
      return res.status(400).json({ error: "paymentMethodId required" });

    const result = await pool.query(
      `SELECT stripe_customer_id, stripe_subscription_id FROM accounts WHERE user_id = $1`,
      [userId]
    );

    const {
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
    } = result.rows[0];

    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    await stripe.subscriptions.update(subscriptionId, {
      default_payment_method: paymentMethodId,
    });

    return res.json({ message: "Card updated successfully" });
  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ error: err.message });
  }
};

export const removeCard = async (req: Request, res: Response) => {
  try {
    const { paymentMethodId } = req.body;

    await stripe.paymentMethods.detach(paymentMethodId);

    return res.json({ message: "Card removed successfully" });
  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ error: err.message });
  }
};

export const getSavedCards = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const userId = user.id;

    console.log(":::::::::::::::::::::", userId);

    const result = await pool.query(
      `SELECT stripe_customer_id 
       FROM stripe_customers 
       WHERE user_id = $1`,
      [userId]
    );

    console.log("stripe_customers query result:", result.rows);

    const customerId = result.rows[0]?.stripe_customer_id;

    if (!customerId) {
      console.log("No stripe customer found for user:", userId);
      
      const accountResult = await pool.query(
        `SELECT sc.stripe_customer_id 
         FROM users u
         JOIN stripe_customers sc ON sc.account_id = u.account_id
         WHERE u.id = $1
         LIMIT 1`,
        [userId]
      );
      
      console.log("account id", accountResult.rows);
      
      const accountCustomerId = accountResult.rows[0]?.stripe_customer_id;
      
      if (!accountCustomerId) {
        console.log("No stripe customer found by account either");
        return res.json([]);
      }
      
      console.log("found customer by account id", accountCustomerId);
      
      const cards = await stripe.paymentMethods.list({
        customer: accountCustomerId,
        type: "card",
      });
      
      console.log("Payment methods found", cards.data.length);
      return res.json(cards.data);
    }

    console.log("Found customer id", customerId);
    const cards = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
    });
    console.log("+++++++++++++++++++++++++++++++",cards)
    
    return res.json(cards.data);
  } catch (err: any) {
    console.error("Error in getSavedCards", err);
    return res.status(500).json({ error: err.message });
  }
};

export const createBillingPortal = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.id;

    console.log("user id ===", adminId);
    const user = await UserModel.findById(adminId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    let returnUrl = "";
    if (user.user_type === "admin") {
      returnUrl = `${process.env.ADMIN_FRONTEND_URL}/settings`;
    } else if (user.user_type === "teacher") {
      returnUrl = `${process.env.TEACHER_FRONTEND_URL}/settings`;
    } else {
      null;
    }
    const result = await pool.query(
      `SELECT stripe_customer_id 
       FROM stripe_customers 
       WHERE user_id = $1`,
      [adminId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Stripe customer not found" });
    }

    const stripeCustomerId = result.rows[0].stripe_customer_id;

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create billing portal" });
  }
};

export const calculateUpgradePreview = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const userId = user.id;
    
    const result = await pool.query(
      `SELECT account_id FROM users WHERE id = $1`,
      [userId]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: "Account not found for user" });
    
    const accountId: string = result.rows[0].account_id;
    const { newPlanSlug, purchaseType, addons = {} } = req.body;
    
    if (!newPlanSlug)
      return res.status(400).json({ error: "New plan slug missing" });
    
    // Validate addon counts
    if (addons.students !== undefined && (addons.students < 0 || addons.students > 10000)) {
      return res.status(400).json({ error: "Invalid student count. Must be between 0 and 10000." });
    }
    if (addons.teachers !== undefined && (addons.teachers < 0 || addons.teachers > 1000)) {
      return res.status(400).json({ error: "Invalid teacher count. Must be between 0 and 1000." });
    }

    const account = await AccountModel.findById(accountId);
    if (!account) return res.status(404).json({ error: "Account not found" });

    const isInTrial = account?.subscription_status === "trialing";

    const currentPlan = account.plan_id
      ? await PlanModel.findById(account.plan_id)
      : null;
    
    const newPlan = await PlanModel.findBySlug(newPlanSlug);
    if (!newPlan) return res.status(404).json({ error: "New plan not found" });
    
    // Validate plan has required price ids
    if (purchaseType === "subscription" && !newPlan.stripe_monthly_price_id) {
      return res.status(400).json({ error: "Plan does not support monthly subscriptions" });
    }
    if (purchaseType === "one_time" && !newPlan.price_yearly) {
      return res.status(400).json({ error: "Plan does not support yearly purchases" });
    }

    const { studentPrice, teacherPrice } = getAddonPrices(newPlan, purchaseType);
    
    // Detect current payment type (monthly or yearly)
    const stripeCustomer = await PaymentModel.findByAccountId(accountId);
    const hasActiveSubscription = !!stripeCustomer?.stripe_subscription_id;
    
    const lastOneTimePayment = await pool.query(
      `SELECT addons, created_at, amount_cents FROM payments 
       WHERE account_id = $1 AND status = 'succeeded' AND mode = 'one_time'
       ORDER BY created_at DESC LIMIT 1`,
      [accountId]
    );
    const hasYearlyPayment = lastOneTimePayment.rows.length > 0;

    if (purchaseType === "subscription") {
      // Handle trial users calculating monthly upgrade
      if (isInTrial) {
        const finalStudentCount = addons.students ?? 0;
        const finalTeacherCount = addons.teachers ?? 0;
        const monthlyAddonCost = (finalStudentCount * studentPrice) + (finalTeacherCount * teacherPrice);
        const newMonthlyBasePrice = Number(newPlan.price_monthly ?? 0);
        const monthlyTotal = newMonthlyBasePrice + monthlyAddonCost;

        return res.status(200).json({
          status: "success",
          breakdown: {
            newPlanPrice: newMonthlyBasePrice,
            studentAddons: finalStudentCount * studentPrice,
            teacherAddons: finalTeacherCount * teacherPrice,
            totalAmount: monthlyTotal,
            isProrated: false,
            note: "Upgrading from free trial. Trial will end immediately and you will be charged the full amount.",
            addonCounts: { students: finalStudentCount, teachers: finalTeacherCount },
          },
          totalAddonCost: monthlyAddonCost,
          currency: "usd",
        });
      }

      // Switching from yearly to monthly
      if (!hasActiveSubscription && hasYearlyPayment) {
        const lastPayment = lastOneTimePayment.rows[0];
        const totalPaid = lastPayment.amount_cents / 100;
        let currentStudentCount = 0;
        let currentTeacherCount = 0;
        let addonCost = 0;
        
        if (lastPayment.addons) {
          currentStudentCount = lastPayment.addons.students || 0;
          currentTeacherCount = lastPayment.addons.teachers || 0;
          addonCost = lastPayment.addons.totalAddonCost || 0;
        }
        
        const oldBasePlanPrice = totalPaid - addonCost;
        const purchaseDate = new Date(lastPayment.created_at);
        const now = new Date();
        const daysUsed = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.max(0, 365 - daysUsed);
        const yearlyCredit = (daysRemaining / 365) * oldBasePlanPrice;
        
        const finalStudentCount = addons.students !== undefined ? addons.students : currentStudentCount;
        const finalTeacherCount = addons.teachers !== undefined ? addons.teachers : currentTeacherCount;
        const monthlyAddonCost = (finalStudentCount * studentPrice) + (finalTeacherCount * teacherPrice);
        
        const newMonthlyBasePrice = Number(newPlan.price_monthly ?? 0);
        const monthlyTotal = newMonthlyBasePrice + monthlyAddonCost;
        
        // Apply yearly credit to first month
        const firstMonthCharge = Math.max(0, monthlyTotal - yearlyCredit);
        
        const breakdown = {
          conversionType: "yearly_to_monthly",
          newPlanPrice: newMonthlyBasePrice,
          studentAddons: finalStudentCount * studentPrice,
          teacherAddons: finalTeacherCount * teacherPrice,
          monthlyTotal: monthlyTotal,
          oldYearlyBasePlanPrice: oldBasePlanPrice,
          yearlyCredit: yearlyCredit,
          daysUsedFromYearly: daysUsed,
          daysRemainingFromYearly: daysRemaining,
          firstMonthCharge: firstMonthCharge,
          subsequentMonthlyCharge: monthlyTotal,
          isProrated: yearlyCredit > 0,
          note: yearlyCredit > 0 
            ? `Converting from yearly to monthly. Credit of $${yearlyCredit.toFixed(2)} from unused yearly plan applied to first month. Base monthly rate: $${monthlyTotal}/month starts after credit is exhausted.`
            : "Converting from yearly to monthly subscription",
          addonCounts: {
            students: finalStudentCount,
            teachers: finalTeacherCount,
          },
          pricingNote: "Yearly credit applied to first month only. Regular monthly billing starts next cycle."
        };
        
        return res.status(200).json({
          status: "success",
          breakdown,
          totalAddonCost: monthlyAddonCost,
          currency: "usd",
        });
      }
      
      // Regular monthly to monthly upgrade
      const stripeSubscriptionId = stripeCustomer?.stripe_subscription_id;

      if (!stripeSubscriptionId) {
        return res.status(400).json({ error: "No active subscription found" });
      }

      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const existingItems = subscription.items.data;

      // Extract current addon counts
      let currentStudentCount = 0;
      let currentTeacherCount = 0;
      
      for (const item of existingItems.slice(1)) {
        const productName = item.price?.product 
          ? (typeof item.price.product === 'string' 
              ? item.price.product 
              : (item.price.product as any)?.name)
          : '';
        const metadata = item.price?.product 
          ? (typeof item.price.product !== 'string' 
              ? (item.price.product as any)?.metadata 
              : null)
          : null;
        
        if (metadata?.type === 'student_addon' || productName?.includes('Student')) {
          currentStudentCount = item.quantity || 0;
        } else if (metadata?.type === 'teacher_addon' || productName?.includes('Teacher')) {
          currentTeacherCount = item.quantity || 0;
        }
      }

      const finalStudentCount = addons.students !== undefined ? addons.students : currentStudentCount;
      const finalTeacherCount = addons.teachers !== undefined ? addons.teachers : currentTeacherCount;
      const finalAddonCost = (finalStudentCount * studentPrice) + (finalTeacherCount * teacherPrice);

      const newPlanBasePrice = Number(newPlan.price_monthly ?? 0);
      
      // For subscription preview, we can not get exact proration without creating the subscription
      // But we can estimate based on the cycle
      const breakdown = {
        newPlanPrice: newPlanBasePrice,
        studentAddons: finalStudentCount * studentPrice,
        teacherAddons: finalTeacherCount * teacherPrice,
        totalBeforeProration: newPlanBasePrice + finalAddonCost,
        proratedAmountDue: newPlanBasePrice + finalAddonCost, 
        isProrated: true,
        addonCounts: {
          students: finalStudentCount,
          teachers: finalTeacherCount,
        },
        note: "Estimated amount - actual proration will be calculated at checkout"
      };

      return res.status(200).json({
        status: "success",
        breakdown,
        totalAddonCost: finalAddonCost,
        currency: "usd",
      });
    } else {
      // Switching from monthly to yearly
      if (hasActiveSubscription && !hasYearlyPayment) {
        const subscription = await stripe.subscriptions.retrieve(stripeCustomer!.stripe_subscription_id!);
        const existingItems = subscription.items.data;
        
        // Extract current addon counts from subscription
        let currentStudentCount = 0;
        let currentTeacherCount = 0;
        
        for (const item of existingItems.slice(1)) {
          const productName = item.price?.product 
            ? (typeof item.price.product === 'string' 
                ? item.price.product 
                : (item.price.product as any)?.name)
            : '';
          const metadata = item.price?.product 
            ? (typeof item.price.product !== 'string' 
                ? (item.price.product as any)?.metadata 
                : null)
            : null;
          
          if (metadata?.type === 'student_addon' || productName?.includes('Student')) {
            currentStudentCount = item.quantity || 0;
          } else if (metadata?.type === 'teacher_addon' || productName?.includes('Teacher')) {
            currentTeacherCount = item.quantity || 0;
          }
        }
        
        // Get monthly base price from first item
        const baseItem = existingItems[0];
        if (!baseItem) {
          return res.status(400).json({ error: "No subscription items found" });
        }
        const monthlyBasePrice = (baseItem.price.unit_amount || 0) / 100;
        
        // Calculate remaining days in current billing cycle
        const currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);
        const now = new Date();
        const daysRemainingInMonth = Math.max(0, Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        
        // Calculate subscription credit (base plan only, not addons per our proration logic)
        const monthlyCredit = (daysRemainingInMonth / 30) * monthlyBasePrice;
        
        const finalStudentCount = addons.students !== undefined ? addons.students : currentStudentCount;
        const finalTeacherCount = addons.teachers !== undefined ? addons.teachers : currentTeacherCount;
        const yearlyAddonCost = (finalStudentCount * studentPrice) + (finalTeacherCount * teacherPrice);
        
        const newYearlyBasePrice = Number(newPlan.price_yearly ?? 0);
        const yearlyTotal = newYearlyBasePrice + yearlyAddonCost;
        
        // Apply monthly credit to yearly cost
        const finalYearlyCharge = Math.max(0, yearlyTotal - monthlyCredit);
        
        const breakdown = {
          conversionType: "monthly_to_yearly",
          newPlanPrice: newYearlyBasePrice,
          studentAddons: finalStudentCount * studentPrice,
          teacherAddons: finalTeacherCount * teacherPrice,
          yearlyTotal: yearlyTotal,
          oldMonthlyBasePlanPrice: monthlyBasePrice,
          monthlyCredit: monthlyCredit,
          daysRemainingInCurrentCycle: daysRemainingInMonth,
          finalYearlyCharge: finalYearlyCharge,
          isProrated: monthlyCredit > 0,
          note: monthlyCredit > 0 
            ? `Converting from monthly to yearly. Credit of $${monthlyCredit.toFixed(2)} from unused monthly subscription applied to yearly cost. Subscription will be cancelled and switched to yearly billing.`
            : "Converting from monthly to yearly payment",
          addonCounts: {
            students: finalStudentCount,
            teachers: finalTeacherCount,
          },
          pricingNote: "Monthly subscription credit applied. After purchase, you'll be on yearly billing (renews in 365 days).",
          warningNote: "Your current monthly subscription will be cancelled upon successful yearly purchase."
        };
        
        return res.status(200).json({
          status: "success",
          breakdown,
          totalAddonCost: yearlyAddonCost,
          currency: "usd",
          noPaymentRequired: finalYearlyCharge === 0,
        });
      }
      
      // Regular yearly to yearly upgrade
      const lastPaymentRes = lastOneTimePayment;
      
      let currentStudentCount = 0;
      let currentTeacherCount = 0;
      let oldPlanBasePriceOnly = 0;
      let oldPlanPurchaseDate: Date | null = null;
      
      if (lastPaymentRes.rows.length > 0) {
        const lastPayment = lastPaymentRes.rows[0];
        const totalPaid = lastPayment.amount_cents / 100;
        let addonCost = 0;
        
        if (lastPayment.addons) {
          currentStudentCount = lastPayment.addons.students || 0;
          currentTeacherCount = lastPayment.addons.teachers || 0;
          if (lastPayment.addons.totalAddonCost) {
            addonCost = lastPayment.addons.totalAddonCost;
          } else if (currentPlan) {
            const oldPrices = getAddonPrices(currentPlan, 'one_time');
            addonCost = (currentStudentCount * oldPrices.studentPrice) + (currentTeacherCount * oldPrices.teacherPrice);
          }
        }
        
        // Calculate base plan price: total paid - addon costs
        oldPlanBasePriceOnly = totalPaid - addonCost;
        oldPlanPurchaseDate = new Date(lastPayment.created_at);
        
        console.log("Old plan pricing breakdown -------", {
          totalPaid,
          addonCost,
          basePlanPrice: oldPlanBasePriceOnly,
          addons: { students: currentStudentCount, teachers: currentTeacherCount }
        });
      }
      
      // Handle trial users calculating yearly upgrade
      if (isInTrial) {
        const finalStudentCount = addons.students ?? 0;
        const finalTeacherCount = addons.teachers ?? 0;
        const finalAddonCost = (finalStudentCount * studentPrice) + (finalTeacherCount * teacherPrice);
        const baseAmount = Number(newPlan.price_yearly ?? 0);
        const totalNewPlanAmount = baseAmount + finalAddonCost;

        return res.status(200).json({
          status: "success",
          breakdown: {
            newPlanPrice: baseAmount,
            studentAddons: finalStudentCount * studentPrice,
            teacherAddons: finalTeacherCount * teacherPrice,
            totalAmount: totalNewPlanAmount,
            isProrated: false,
            note: "Upgrading from free trial. Trial will end immediately and you will be charged the full amount.",
            addonCounts: { students: finalStudentCount, teachers: finalTeacherCount },
          },
          totalAddonCost: finalAddonCost,
          currency: "usd",
        });
      }
      
      const finalStudentCount = addons.students !== undefined ? addons.students : currentStudentCount;
      const finalTeacherCount = addons.teachers !== undefined ? addons.teachers : currentTeacherCount;
      const finalAddonCost = (finalStudentCount * studentPrice) + (finalTeacherCount * teacherPrice);
      
      const baseAmount = Number(newPlan.price_yearly ?? newPlan.price_monthly ?? 0);
      const totalNewPlanAmount = baseAmount + finalAddonCost;
      
      // Calculate proration credit for unused time on old plan
      let proratedCredit = 0;
      let daysUsed = 0;
      let daysRemaining = 0;
      let totalDaysInYear = 365;
      
      if (oldPlanPurchaseDate && oldPlanBasePriceOnly > 0) {
        const now = new Date();
        const millisecondsUsed = now.getTime() - oldPlanPurchaseDate.getTime();
        daysUsed = Math.floor(millisecondsUsed / (1000 * 60 * 60 * 24));
        daysRemaining = Math.max(0, totalDaysInYear - daysUsed);
        // Calculate credit based only on base plan price (not including addons)
        proratedCredit = (daysRemaining / totalDaysInYear) * oldPlanBasePriceOnly;
        
        console.log("Proration calculation -------", {
          oldBasePlanPrice: oldPlanBasePriceOnly,
          daysUsed,
          daysRemaining,
          proratedCredit: proratedCredit.toFixed(2),
          note: "Credit calculated from base plan price only, excluding addon costs"
        });
      }
      
      const finalAmount = Math.max(0, totalNewPlanAmount - proratedCredit);
      
      const breakdown = {
        newPlanPrice: baseAmount,
        studentAddons: finalStudentCount * studentPrice,
        teacherAddons: finalTeacherCount * teacherPrice,
        totalNewPlanAmount: totalNewPlanAmount,
        oldBasePlanPrice: oldPlanBasePriceOnly,
        oldPlanCredit: proratedCredit,
        daysUsed,
        daysRemaining,
        totalAmount: finalAmount,
        isProrated: proratedCredit > 0,
        note: proratedCredit > 0 
          ? `Credit of $${proratedCredit.toFixed(2)} applied for ${daysRemaining} unused days on previous BASE PLAN (addons excluded from proration)`
          : "One-time purchase: full payment for new plan",
        addonCounts: {
          students: finalStudentCount,
          teachers: finalTeacherCount,
        },
        pricingNote: "Proration calculated on base plan price only. Addon costs are not prorated."
      };

      return res.status(200).json({
        status: "success",
        breakdown,
        totalAddonCost: finalAddonCost,
        currency: "usd",
        noPaymentRequired: finalAmount === 0,
      });
    }
  } catch (err: any) {
    console.error("Calculate upgrade preview error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const upgradePlan = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const userId = user.id;
    console.log("User id --------------", userId);
    const result = await pool.query(
      `SELECT account_id FROM users WHERE id = $1`,
      [userId]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: "Account not found for user" });
    const accountId: string = result.rows[0].account_id;
    console.log("Account id ---------", accountId);
    const { newPlanSlug, purchaseType, addons = {}, idempotencyKey } = req.body;
    console.log("Request body --------", req.body);
    
    // Check for duplicate submission
    if (idempotencyKey) {
      const existingUpgrade = await pool.query(
        `SELECT id FROM payments WHERE metadata->>'idempotencyKey' = $1 AND account_id = $2 AND created_at > NOW() - INTERVAL '1 hour'`,
        [idempotencyKey, accountId]
      );
      if (existingUpgrade.rows.length > 0) {
        return res.status(409).json({ error: "Duplicate request detected. This upgrade is already being processed." });
      }
    }
    if (!newPlanSlug)
      return res.status(400).json({ error: "New plan slug missing" });
    
    // Validate addon counts
    if (addons.students !== undefined && (addons.students < 0 || addons.students > 10000)) {
      return res.status(400).json({ error: "Invalid student count. Must be between 0 and 10000." });
    }
    if (addons.teachers !== undefined && (addons.teachers < 0 || addons.teachers > 1000)) {
      return res.status(400).json({ error: "Invalid teacher count. Must be between 0 and 1000." });
    }

    const account = await AccountModel.findById(accountId);
    console.log("Account -------", account);
    if (!account) return res.status(404).json({ error: "Account not found" });

    const isInTrial = account?.subscription_status === "trialing";

    const currentPlan = account.plan_id
      ? await PlanModel.findById(account.plan_id)
      : null;
    console.log("Current Plan --------", currentPlan);
    const newPlan = await PlanModel.findBySlug(newPlanSlug);
    console.log("NewPlan ------", newPlan);
    if (!newPlan) return res.status(404).json({ error: "New plan not found" });

    // Ensure stripe customer exists or not
    let stripeCustomer = await StripeCustomerModel.findByAccountId(accountId);
    console.log("Stripe customers --------", stripeCustomer);
    if (!stripeCustomer) {
      const customer = await stripe.customers.create({
        email: account.owner_email,
        metadata: { accountId },
      });
      stripeCustomer = await StripeCustomerModel.upsert({
        accountId,
        stripeCustomerId: customer.id,
        email: account.owner_email,
        userId,
      });
    }
    const stripeCustomerId = stripeCustomer.stripe_customer_id;
    console.log("Stripe customer id -------", stripeCustomerId);

    const { studentPrice, teacherPrice } = getAddonPrices(newPlan, purchaseType);
    const totalAddonCost =
      (addons.students || 0) * studentPrice + (addons.teachers || 0) * teacherPrice;
    console.log("Total addon cost --------", totalAddonCost);
    
    // Detect current payment type (subscription vs one-time)
    const latestPaymentForSubscriptionCheck = await PaymentModel.findByAccountId(accountId);
    const hasActiveSubscription = !!latestPaymentForSubscriptionCheck?.stripe_subscription_id;
    
    const lastOneTimePayment = await pool.query(
      `SELECT addons, created_at, amount_cents FROM payments 
       WHERE account_id = $1 AND status = 'succeeded' AND mode = 'one_time'
       ORDER BY created_at DESC LIMIT 1`,
      [accountId]
    );
    const hasYearlyPayment = lastOneTimePayment.rows.length > 0;
    
    // Check if trying to switch to the same plan (without changing billing cycle)
    if (currentPlan?.slug === newPlanSlug) {
      // Allow if changing billing cycle (monthly to yearly) or changing addons
      const isChangingBillingCycle = 
        (purchaseType === "subscription" && hasYearlyPayment && !hasActiveSubscription) ||
        (purchaseType === "one_time" && hasActiveSubscription && !hasYearlyPayment);
      
      const isChangingAddons = 
        addons.students !== undefined || addons.teachers !== undefined;
      
      if (!isChangingBillingCycle && !isChangingAddons) {
        return res.status(400).json({ 
          error: "You are already on this plan. To modify addons, please specify student or teacher counts." 
        });
      }
    }
    
    // Validate plan has required price ids
    if (purchaseType === "subscription" && !newPlan.stripe_monthly_price_id) {
      return res.status(400).json({ error: "Plan does not support monthly subscriptions" });
    }
    if (purchaseType === "one_time" && !newPlan.price_yearly) {
      return res.status(400).json({ error: "Plan does not support yearly purchases" });
    }
    
    if (purchaseType === "subscription") {
      // Handle conversion from yearly to monthly
      if (!hasActiveSubscription && hasYearlyPayment && !isInTrial) {
        const lastPayment = lastOneTimePayment.rows[0];
        const totalPaid = lastPayment.amount_cents / 100;
        let currentStudentCount = 0;
        let currentTeacherCount = 0;
        let addonCost = 0;
        
        if (lastPayment.addons) {
          currentStudentCount = lastPayment.addons.students || 0;
          currentTeacherCount = lastPayment.addons.teachers || 0;
          addonCost = lastPayment.addons.totalAddonCost || 0;
        }
        
        const oldBasePlanPrice = totalPaid - addonCost;
        const purchaseDate = new Date(lastPayment.created_at);
        const now = new Date();
        const daysUsed = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.max(0, 365 - daysUsed);
        const yearlyCredit = (daysRemaining / 365) * oldBasePlanPrice;
        
        const finalStudentCount = addons.students !== undefined ? addons.students : currentStudentCount;
        const finalTeacherCount = addons.teachers !== undefined ? addons.teachers : currentTeacherCount;
        const monthlyAddonCost = (finalStudentCount * studentPrice) + (finalTeacherCount * teacherPrice);
        
        const newMonthlyBasePrice = Number(newPlan.price_monthly ?? 0);
        const monthlyTotal = newMonthlyBasePrice + monthlyAddonCost;
        
        // Apply yearly credit to first month, rest goes to account balance
        const firstMonthCharge = Math.max(0, monthlyTotal - yearlyCredit);
        
        console.log("Yearly to Monthly conversion -------", {
          oldBasePlanPrice,
          yearlyCredit,
          daysRemaining,
          monthlyTotal,
          firstMonthCharge
        });
        
        // Get addon product ids
        const studentProductId = finalStudentCount > 0 ? await getOrCreateAddonProduct("student") : null;
        const teacherProductId = finalTeacherCount > 0 ? await getOrCreateAddonProduct("teacher") : null;
        
        // Create subscription with prorated first month
        const subscription = await stripe.subscriptions.create({
          customer: stripeCustomerId,
          items: [
            {
              price: newPlan.stripe_monthly_price_id,
            },
            ...(studentProductId ? [{
              price_data: {
                currency: "usd",
                product: studentProductId,
                recurring: { interval: "month" as const },
                unit_amount: 300,
              },
              quantity: finalStudentCount,
            }] : []),
            ...(teacherProductId ? [{
              price_data: {
                currency: "usd",
                product: teacherProductId,
                recurring: { interval: "month" as const },
                unit_amount: teacherPrice * 100,
              },
              quantity: finalTeacherCount,
            }] : []),
          ],
          payment_behavior: "default_incomplete",
          payment_settings: { save_default_payment_method: "on_subscription" },
          expand: ["latest_invoice.payment_intent"],
          metadata: {
            accountId,
            planSlug: newPlanSlug,
            purchaseType,
            conversionType: "yearly_to_monthly",
            yearlyCredit: String(yearlyCredit),
            addons: JSON.stringify({ students: finalStudentCount, teachers: finalTeacherCount }),
          },
        });
        
        // Apply credit to account balance if credit > first month charge
        if (yearlyCredit > monthlyTotal) {
          const remainingCredit = yearlyCredit - monthlyTotal;
          await stripe.customers.createBalanceTransaction(stripeCustomerId, {
            amount: -Math.round(remainingCredit * 100),
            currency: "usd",
            description: `Credit from yearly plan conversion (${daysRemaining} days remaining)`,
          });
        }
        
        const invoice: any = subscription.latest_invoice;
        const paymentIntentId = invoice?.payment_intent?.id || null;
        
        await StripeCustomerModel.upsert({
          accountId,
          stripeCustomerId,
          email: account.owner_email,
          userId,
        } as any);
        
        await PaymentModel.create({
          accountId,
          planId: newPlan.id ?? null,
          mode: "subscription",
          amountCents: firstMonthCharge > 0 ? Math.round(firstMonthCharge * 100) : 0,
          currency: "usd",
          stripePaymentIntentId: paymentIntentId ?? "",
          stripeSubscriptionId: subscription.id,
          status: firstMonthCharge === 0 ? "succeeded" : "pending",
          addons: {
            students: finalStudentCount,
            teachers: finalTeacherCount,
            totalAddonCost: monthlyAddonCost,
            totalCost: monthlyTotal,
          },
          metadata: {
            conversionType: "yearly_to_monthly",
            yearlyCredit,
            daysRemainingFromYearly: daysRemaining,
            idempotencyKey: idempotencyKey || undefined,
          }
        });
        
        const breakdown = {
          conversionType: "yearly_to_monthly",
          newPlanPrice: newMonthlyBasePrice,
          studentAddons: finalStudentCount * studentPrice,
          teacherAddons: finalTeacherCount * teacherPrice,
          monthlyTotal: monthlyTotal,
          oldYearlyBasePlanPrice: oldBasePlanPrice,
          yearlyCredit: yearlyCredit,
          daysUsedFromYearly: daysUsed,
          daysRemainingFromYearly: daysRemaining,
          firstMonthCharge: firstMonthCharge,
          subsequentMonthlyCharge: monthlyTotal,
          creditAppliedToBalance: yearlyCredit > monthlyTotal ? yearlyCredit - monthlyTotal : 0,
        };
        
        return res.status(200).json({
          status: "success",
          clientSecret: paymentIntentId ? invoice.payment_intent.client_secret : null,
          amount: firstMonthCharge,
          breakdown,
          totalAddonCost: monthlyAddonCost,
          currency: "usd",
          subscriptionId: subscription.id,
          noPaymentRequired: firstMonthCharge === 0,
        });
      }
      
      // Handle trial users upgrading to monthly subscription
      if (isInTrial) {
        const finalStudentCount = addons.students ?? 0;
        const finalTeacherCount = addons.teachers ?? 0;
        const monthlyAddonCost = (finalStudentCount * studentPrice) + (finalTeacherCount * teacherPrice);
        const newMonthlyBasePrice = Number(newPlan.price_monthly ?? 0);
        const monthlyTotal = newMonthlyBasePrice + monthlyAddonCost;

        // Get addon product ids
        const studentProductId = finalStudentCount > 0 ? await getOrCreateAddonProduct("student") : null;
        const teacherProductId = finalTeacherCount > 0 ? await getOrCreateAddonProduct("teacher") : null;

        // Create new subscription (ending trial immediately)
        const subscription = await stripe.subscriptions.create({
          customer: stripeCustomerId,
          items: [
            { price: newPlan.stripe_monthly_price_id },
            ...(studentProductId ? [{
              price_data: {
                currency: "usd",
                product: studentProductId,
                recurring: { interval: "month" as const },
                unit_amount: 300,
              },
              quantity: finalStudentCount,
            }] : []),
            ...(teacherProductId ? [{
              price_data: {
                currency: "usd",
                product: teacherProductId,
                recurring: { interval: "month" as const },
                unit_amount: teacherPrice * 100,
              },
              quantity: finalTeacherCount,
            }] : []),
          ],
          trial_end: "now",
          payment_behavior: "default_incomplete",
          collection_method: "charge_automatically",
          payment_settings: { 
            save_default_payment_method: "on_subscription",
            payment_method_types: ["card"],
          },
          expand: ["latest_invoice.payment_intent"],
          metadata: {
            accountId,
            planSlug: newPlanSlug,
            purchaseType,
            upgradedFromTrial: "true",
            addons: JSON.stringify({ students: finalStudentCount, teachers: finalTeacherCount }),
          },
        });

        // Get the initial invoice
        let invoice: any = subscription.latest_invoice;
        let clientSecret = null;
        let paymentIntentId = null;
        
        console.log("Initial subscription response:", {
          subscriptionId: subscription.id,
          status: subscription.status,
          latestInvoice: invoice?.id,
          invoiceStatus: invoice?.status,
          hasPaymentIntent: !!invoice?.payment_intent,
          paymentIntentType: typeof invoice?.payment_intent,
        });
        
        // For trial upgrades with default_incomplete, Stripe creates subscription but no payment intent
        // We need to manually create a payment intent for the invoice amount
        if (!invoice?.payment_intent && invoice?.id) {
          console.log("No payment intent found, creating one manually for invoice:", invoice.id);
          
          // Create a payment intent for the invoice amount
          const paymentIntent = await stripe.paymentIntents.create({
            customer: stripeCustomerId,
            amount: Math.round(monthlyTotal * 100),
            currency: "usd",
            automatic_payment_methods: { enabled: true },
            metadata: {
              subscriptionId: subscription.id,
              invoiceId: invoice.id,
              accountId,
              planSlug: newPlanSlug,
              upgradedFromTrial: "true",
            },
          });
          
          paymentIntentId = paymentIntent.id;
          clientSecret = paymentIntent.client_secret;
          
          console.log("Created manual payment intent:", {
            paymentIntentId,
            hasClientSecret: !!clientSecret,
            amount: paymentIntent.amount,
          });
        } else if (invoice?.payment_intent) {
          // Payment intent exists on invoice
          const paymentIntent: any = typeof invoice.payment_intent === 'string' 
            ? await stripe.paymentIntents.retrieve(invoice.payment_intent)
            : invoice.payment_intent;
          
          paymentIntentId = paymentIntent.id;
          clientSecret = paymentIntent.client_secret;
          
          console.log("Found payment intent from subscription:", {
            paymentIntentId,
            hasClientSecret: !!clientSecret,
          });
        }

        console.log("Trial upgrade subscription created:", {
          subscriptionId: subscription.id,
          invoiceId: invoice?.id,
          invoiceStatus: invoice?.status,
          paymentIntentId,
          clientSecret: clientSecret ? "present" : "missing",
          status: subscription.status,
        });

        if (!clientSecret) {
          console.error("Failed to retrieve client secret for trial upgrade");
          return res.status(500).json({
            error: "Failed to create payment intent for subscription",
            subscriptionId: subscription.id,
            invoiceId: invoice?.id,
          });
        }

        await PaymentModel.create({
          accountId,
          planId: newPlan.id ?? null,
          mode: "subscription",
          amountCents: Math.round(monthlyTotal * 100),
          currency: "usd",
          stripePaymentIntentId: paymentIntentId ?? "",
          stripeSubscriptionId: subscription.id,
          status: "pending",
          addons: {
            students: finalStudentCount,
            teachers: finalTeacherCount,
            totalAddonCost: monthlyAddonCost,
            totalCost: monthlyTotal,
          },
          metadata: {
            upgradeType: "trial_to_paid_subscription",
            newPlanSlug,
            upgradedAt: new Date().toISOString(),
            idempotencyKey: idempotencyKey || undefined,
          }
        });

        return res.status(200).json({
          status: "success",
          clientSecret: clientSecret,
          amount: monthlyTotal,
          breakdown: {
            newPlanPrice: newMonthlyBasePrice,
            studentAddons: finalStudentCount * studentPrice,
            teacherAddons: finalTeacherCount * teacherPrice,
            totalAmount: monthlyTotal,
            isProrated: false,
            note: "Upgrading from free trial. Trial ends immediately and full payment is required.",
            addonCounts: { students: finalStudentCount, teachers: finalTeacherCount },
          },
          totalAddonCost: monthlyAddonCost,
          currency: "usd",
          subscriptionId: subscription.id,
        });
      }

      // Regular monthly subscription upgrade
      const latestPayment = await PaymentModel.findLatestPaymentByAccountId(accountId);
      const stripeSubscriptionId = latestPayment?.stripe_subscription_id;
      console.log("Stripe subscription id ---------", stripeSubscriptionId);
      if (!stripeSubscriptionId)
        return res.status(400).json({ error: "No active subscription to upgrade" });

      const subscription = await stripe.subscriptions.retrieve(
        stripeSubscriptionId
      );
      console.log("Subscription -------", subscription);
      
      // Get ALL current subscription items
      const existingItems = subscription.items.data;
      const baseItemId = existingItems[0]?.id;
      if (!baseItemId) {
        return res.status(400).json({ error: "No subscription items found" });
      }

      // Extract current addon counts from existing subscription items
      let currentStudentCount = 0;
      let currentTeacherCount = 0;
      
      for (const item of existingItems.slice(1)) {
        const productName = item.price?.product 
          ? (typeof item.price.product === 'string' 
              ? item.price.product 
              : (item.price.product as any)?.name)
          : '';
        const metadata = item.price?.product 
          ? (typeof item.price.product !== 'string' 
              ? (item.price.product as any)?.metadata 
              : null)
          : null;
        
        if (metadata?.type === 'student_addon' || productName?.includes('Student')) {
          currentStudentCount = item.quantity || 0;
        } else if (metadata?.type === 'teacher_addon' || productName?.includes('Teacher')) {
          currentTeacherCount = item.quantity || 0;
        }
      }

      // Use new addon counts if provided, otherwise keep existing counts
      const finalStudentCount = addons.students !== undefined ? addons.students : currentStudentCount;
      const finalTeacherCount = addons.teachers !== undefined ? addons.teachers : currentTeacherCount;
      
      // Recalculate total addon cost with final counts
      const finalAddonCost = (finalStudentCount * studentPrice) + (finalTeacherCount * teacherPrice);
      
      console.log("Addon counts -------", {
        current: { students: currentStudentCount, teachers: currentTeacherCount },
        requested: { students: addons.students, teachers: addons.teachers },
        final: { students: finalStudentCount, teachers: finalTeacherCount },
        finalAddonCost
      });

      // Build new subscription items array
      const newItems: any[] = [
        {
          id: baseItemId, // Update existing base plan item
          price: newPlan.stripe_monthly_price_id,
        }
      ];

      // Delete old addon items anything beyond the first item
      for (let i = 1; i < existingItems.length; i++) {
        const itemId = existingItems[i]?.id;
        if (itemId) {
          newItems.push({
            id: itemId,
            deleted: true,
          });
        }
      }

      // Get addon product ids
      const studentProductId = finalStudentCount > 0 ? await getOrCreateAddonProduct("student") : null;
      const teacherProductId = finalTeacherCount > 0 ? await getOrCreateAddonProduct("teacher") : null;

      // Add student addon line items if count > 0
      if (studentProductId) {
        newItems.push({
          price_data: {
            currency: "usd",
            product: studentProductId,
            recurring: { interval: "month" as const },
            unit_amount: studentPrice * 100,
          },
          quantity: finalStudentCount,
        });
      }

      // Add teacher addon line items if count > 0
      if (teacherProductId) {
        newItems.push({
          price_data: {
            currency: "usd",
            product: teacherProductId,
            recurring: { interval: "month" as const },
            unit_amount: teacherPrice * 100,
          },
          quantity: finalTeacherCount,
        });
      }

      const updatedSubscription = await stripe.subscriptions.update(
        subscription.id,
        {
          items: newItems,
          proration_behavior: "create_prorations", // Prorates both upgrades and downgrades
          metadata: {
            accountId,
            oldPlanSlug: currentPlan?.slug || "",
            newPlanSlug,
            purchaseType,
            addons: JSON.stringify({ students: finalStudentCount, teachers: finalTeacherCount }),
            finalAddonCost: String(finalAddonCost),
          },
        }
      );
      console.log("Update subscription --------", updatedSubscription);
      
      // Get the latest invoice for payment intent
      let invoice: any = await stripe.invoices.retrieve(
        updatedSubscription.latest_invoice as string
      );
      console.log("Latest Invoice -------", invoice);
      
      // Finalize invoice if needed to get a payment intent
      if (!invoice.payment_intent && invoice.amount_due > 0) {
        invoice = await stripe.invoices.finalizeInvoice(invoice.id);
      }

      const paymentIntentId = invoice.payment_intent as string | null;
      console.log("Payment Intent id -------", paymentIntentId);
      const totalAmount = (invoice.amount_due ?? 0) / 100;
      console.log("Invoice total amount (prorated) ------", totalAmount);
      
      // Calculate breakdown for display purposes
      const newPlanBasePrice = Number(newPlan.price_monthly ?? 0);
      const breakdown = {
        newPlanPrice: newPlanBasePrice,
        studentAddons: finalStudentCount * studentPrice,
        teacherAddons: finalTeacherCount * teacherPrice,
        totalBeforeProration: newPlanBasePrice + finalAddonCost,
        proratedAmountDue: totalAmount, 
        isProrated: true,
        addonCounts: {
          students: finalStudentCount,
          teachers: finalTeacherCount,
        }
      };
      console.log("Breakdown -------", breakdown);
      
      await PaymentModel.create({
        accountId,
        planId: newPlan.id ?? null,
        mode: "subscription",
        amountCents: invoice.amount_due ?? 0,
        currency: "usd",
        stripePaymentIntentId: paymentIntentId ?? "",
        stripeSubscriptionId: subscription.id,
        status: totalAmount === 0 ? "succeeded" : "pending",
        addons: {
          students: finalStudentCount,
          teachers: finalTeacherCount,
          totalAddonCost: finalAddonCost,
          totalCost: totalAmount,
        },
        metadata: {
          upgradeType: "monthly_subscription",
          oldPlanSlug: currentPlan?.slug || "",
          newPlanSlug,
          upgradedAt: new Date().toISOString(),
          idempotencyKey: idempotencyKey || undefined,
        }
      });
      
      // Update account plan immediately for zero cost upgrades/downgrades
      if (totalAmount === 0) {
        await AccountModel.update(accountId, {
          plan_id: newPlan.id ?? null,
        });
      }

      return res.status(200).json({
        status: "success",
        clientSecret: paymentIntentId
          ? (await stripe.paymentIntents.retrieve(paymentIntentId))
              .client_secret
          : null,
        amount: totalAmount, 
        breakdown,
        totalAddonCost: finalAddonCost,
        currency: "usd",
        subscriptionId: subscription.id,
        noPaymentRequired: totalAmount === 0,
      });
    } else {
      // Handle trial users upgrading to yearly one time payment
      if (isInTrial) {
        const finalStudentCount = addons.students ?? 0;
        const finalTeacherCount = addons.teachers ?? 0;
        const finalAddonCost = (finalStudentCount * studentPrice) + (finalTeacherCount * teacherPrice);
        const baseAmount = Number(newPlan.price_yearly ?? 0);
        const totalNewPlanAmount = baseAmount + finalAddonCost;
        const amountCents = Math.round(totalNewPlanAmount * 100);

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountCents,
          currency: "usd",
          customer: stripeCustomerId,
          payment_method_types: ["card"],
          setup_future_usage: "off_session",
          metadata: {
            accountId,
            newPlanSlug,
            purchaseType,
            upgradedFromTrial: "true",
            addons: JSON.stringify({ students: finalStudentCount, teachers: finalTeacherCount }),
            totalAddonCost: String(finalAddonCost),
            totalCost: String(totalNewPlanAmount),
          },
        });

        await PaymentModel.create({
          accountId,
          planId: newPlan.id ?? null,
          mode: "one_time",
          amountCents,
          currency: "usd",
          stripePaymentIntentId: paymentIntent.id,
          status: "pending",
          addons: {
            students: finalStudentCount,
            teachers: finalTeacherCount,
            totalAddonCost: finalAddonCost,
            totalCost: totalNewPlanAmount,
            basePlanPrice: baseAmount,
          },
          metadata: {
            upgradeType: "trial_to_yearly_payment",
            newPlanSlug,
            upgradedAt: new Date().toISOString(),
            idempotencyKey: idempotencyKey || undefined,
          }
        });

        return res.status(200).json({
          status: "success",
          clientSecret: paymentIntent.client_secret,
          amount: totalNewPlanAmount,
          breakdown: {
            newPlanPrice: baseAmount,
            studentAddons: finalStudentCount * studentPrice,
            teacherAddons: finalTeacherCount * teacherPrice,
            totalAmount: totalNewPlanAmount,
            isProrated: false,
            note: "Upgrading from free trial. Trial ends immediately and full payment is required.",
            addonCounts: { students: finalStudentCount, teachers: finalTeacherCount },
          },
          totalAddonCost: finalAddonCost,
          currency: "usd",
        });
      }

      // Handle conversion from monthly to yearly
      if (hasActiveSubscription && !hasYearlyPayment) {
        const latestPayment = await PaymentModel.findLatestPaymentByAccountId(accountId);
        const subscriptionId = latestPayment?.stripe_subscription_id;
        
        if (!subscriptionId) {
          return res.status(400).json({ error: "No active subscription found for conversion" });
        }
        
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const existingItems = subscription.items.data;
        
        // Extract current addon counts from subscription
        let currentStudentCount = 0;
        let currentTeacherCount = 0;
        
        for (const item of existingItems.slice(1)) {
          const productName = item.price?.product 
            ? (typeof item.price.product === 'string' 
                ? item.price.product 
                : (item.price.product as any)?.name)
            : '';
          const metadata = item.price?.product 
            ? (typeof item.price.product !== 'string' 
                ? (item.price.product as any)?.metadata 
                : null)
            : null;
          
          if (metadata?.type === 'student_addon' || productName?.includes('Student')) {
            currentStudentCount = item.quantity || 0;
          } else if (metadata?.type === 'teacher_addon' || productName?.includes('Teacher')) {
            currentTeacherCount = item.quantity || 0;
          }
        }
        
        // Get monthly base price from first item
        const baseItem = existingItems[0];
        if (!baseItem) {
          return res.status(400).json({ error: "No subscription items found" });
        }
        const monthlyBasePrice = (baseItem.price.unit_amount || 0) / 100;
        
        // Calculate remaining days in current billing cycle
        const currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);
        const now = new Date();
        const daysRemainingInMonth = Math.max(0, Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        
        // Calculate subscription credit (base plan only, not addons per our proration logic)
        const monthlyCredit = (daysRemainingInMonth / 30) * monthlyBasePrice;
        
        const finalStudentCount = addons.students !== undefined ? addons.students : currentStudentCount;
        const finalTeacherCount = addons.teachers !== undefined ? addons.teachers : currentTeacherCount;
        const yearlyAddonCost = (finalStudentCount * studentPrice) + (finalTeacherCount * teacherPrice);
        
        const newYearlyBasePrice = Number(newPlan.price_yearly ?? 0);
        const yearlyTotal = newYearlyBasePrice + yearlyAddonCost;
        
        // Apply monthly credit to yearly cost
        const finalYearlyCharge = Math.max(0, yearlyTotal - monthlyCredit);
        const amountCents = Math.round(finalYearlyCharge * 100);
        
        console.log("Monthly to Yearly conversion -------", {
          monthlyBasePrice,
          monthlyCredit,
          daysRemainingInMonth,
          yearlyTotal,
          finalYearlyCharge
        });
        
        // Cancel the subscription at period end
        await stripe.subscriptions.update(subscription.id, {
          cancel_at_period_end: true,
        });
        
        if (amountCents <= 0) {
          // Credit covers the full yearly cost
          await PaymentModel.create({
            accountId,
            planId: newPlan.id ?? null,
            mode: "one_time",
            amountCents: 0,
            currency: "usd",
            stripePaymentIntentId: "",
            status: "succeeded",
            addons: {
              students: finalStudentCount,
              teachers: finalTeacherCount,
              totalAddonCost: yearlyAddonCost,
              totalCost: 0,
            },
            metadata: {
              conversionType: "monthly_to_yearly",
              monthlyCredit,
              daysRemainingInMonth,
              cancelledSubscriptionId: subscription.id,
            }
          });
          
          // Update account plan immediately
          await AccountModel.update(accountId, {
            plan_id: newPlan.id ?? null,
          });
          
          const breakdown = {
            conversionType: "monthly_to_yearly",
            newPlanPrice: newYearlyBasePrice,
            studentAddons: finalStudentCount * studentPrice,
            teacherAddons: finalTeacherCount * teacherPrice,
            yearlyTotal: yearlyTotal,
            oldMonthlyBasePlanPrice: monthlyBasePrice,
            monthlyCredit: monthlyCredit,
            daysRemainingInCurrentCycle: daysRemainingInMonth,
            finalYearlyCharge: 0,
            isProrated: true,
            addonCounts: {
              students: finalStudentCount,
              teachers: finalTeacherCount,
            },
          };
          
          return res.status(200).json({
            status: "success",
            noPaymentRequired: true,
            amount: 0,
            breakdown,
            totalAddonCost: yearlyAddonCost,
            currency: "usd",
            message: "Converted to yearly plan using monthly credit. Your monthly subscription will cancel at the end of current billing period."
          });
        }
        
        // Create payment intent for remaining amount
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountCents,
          currency: "usd",
          customer: stripeCustomerId,
          payment_method_types: ["card"],
          setup_future_usage: "off_session",
          metadata: {
            accountId,
            oldPlanSlug: currentPlan?.slug || "",
            newPlanSlug,
            purchaseType,
            conversionType: "monthly_to_yearly",
            monthlyCredit: String(monthlyCredit),
            daysRemainingInMonth: String(daysRemainingInMonth),
            cancelledSubscriptionId: subscription.id,
            addons: JSON.stringify({ students: finalStudentCount, teachers: finalTeacherCount }),
            totalAddonCost: String(yearlyAddonCost),
            totalCost: String(finalYearlyCharge),
          },
        });
        
        await PaymentModel.create({
          accountId,
          planId: newPlan.id ?? null,
          mode: "one_time",
          amountCents,
          currency: "usd",
          stripePaymentIntentId: paymentIntent.id,
          status: "pending",
          addons: {
            students: finalStudentCount,
            teachers: finalTeacherCount,
            totalAddonCost: yearlyAddonCost,
            totalCost: finalYearlyCharge,
            basePlanPrice: newYearlyBasePrice,
          },
          metadata: {
            conversionType: "monthly_to_yearly",
            monthlyCredit,
            daysRemainingInMonth,
            cancelledSubscriptionId: subscription.id,
          }
        });
        
        const breakdown = {
          conversionType: "monthly_to_yearly",
          newPlanPrice: newYearlyBasePrice,
          studentAddons: finalStudentCount * studentPrice,
          teacherAddons: finalTeacherCount * teacherPrice,
          yearlyTotal: yearlyTotal,
          oldMonthlyBasePlanPrice: monthlyBasePrice,
          monthlyCredit: monthlyCredit,
          daysRemainingInCurrentCycle: daysRemainingInMonth,
          finalYearlyCharge: finalYearlyCharge,
          isProrated: monthlyCredit > 0,
          addonCounts: {
            students: finalStudentCount,
            teachers: finalTeacherCount,
          },
        };
        
        return res.status(200).json({
          status: "success",
          clientSecret: paymentIntent.client_secret,
          amount: finalYearlyCharge,
          breakdown,
          totalAddonCost: yearlyAddonCost,
          currency: "usd",
          message: "Your monthly subscription will be cancelled at the end of current billing period and switched to yearly billing."
        });
      }
      
      // Regular yearly one time payment upgrade with proration and calculate credit for unused time on old plan and apply to new plan
      // Get current addon counts from the account
      const lastPaymentRes = await pool.query(
        `SELECT addons, created_at, amount_cents FROM payments 
         WHERE account_id = $1 AND status = 'succeeded' AND mode = 'one_time'
         ORDER BY created_at DESC LIMIT 1`,
        [accountId]
      );
      
      let currentStudentCount = 0;
      let currentTeacherCount = 0;
      let oldPlanBasePriceOnly = 0;
      let oldPlanPurchaseDate: Date | null = null;
      
      if (lastPaymentRes.rows.length > 0) {
        const lastPayment = lastPaymentRes.rows[0];
        const totalPaid = lastPayment.amount_cents / 100;
        let addonCost = 0;
        
        if (lastPayment.addons) {
          currentStudentCount = lastPayment.addons.students || 0;
          currentTeacherCount = lastPayment.addons.teachers || 0;
          // Extract addon cost if available, otherwise calculate it from current plan prices
          if (lastPayment.addons.totalAddonCost) {
            addonCost = lastPayment.addons.totalAddonCost;
          } else if (currentPlan) {
            const oldPrices = getAddonPrices(currentPlan, 'one_time');
            addonCost = (currentStudentCount * oldPrices.studentPrice) + (currentTeacherCount * oldPrices.teacherPrice);
          }
          // Use stored base plan price if available for upgrade credit calculation
          // Otherwise calculate from total paid for initial purchases
          oldPlanBasePriceOnly = lastPayment.addons.basePlanPrice || (totalPaid - addonCost);
        } else {
          // No addon data, assume entire payment was for base plan
          oldPlanBasePriceOnly = totalPaid;
        }
        
        oldPlanPurchaseDate = new Date(lastPayment.created_at);
        
        console.log("Old plan pricing breakdown -------", {
          totalPaid,
          addonCost,
          basePlanPrice: oldPlanBasePriceOnly,
          addons: { students: currentStudentCount, teachers: currentTeacherCount }
        });
      }
      
      // Use new addon counts if provided, otherwise keep existing counts
      const finalStudentCount = addons.students !== undefined ? addons.students : currentStudentCount;
      const finalTeacherCount = addons.teachers !== undefined ? addons.teachers : currentTeacherCount;
      
      // Recalculate with final counts
      const finalAddonCost = (finalStudentCount * studentPrice) + (finalTeacherCount * teacherPrice);
      
      console.log("One-time addon counts -------", {
        current: { students: currentStudentCount, teachers: currentTeacherCount },
        requested: { students: addons.students, teachers: addons.teachers },
        final: { students: finalStudentCount, teachers: finalTeacherCount },
        finalAddonCost
      });
      
      const baseAmount = Number(
        newPlan.price_yearly ?? newPlan.price_monthly ?? 0
      );
      const totalNewPlanAmount = baseAmount + finalAddonCost;
      
      // Calculate proration credit for unused time on old plan
      let proratedCredit = 0;
      let daysUsed = 0;
      let daysRemaining = 0;
      let totalDaysInYear = 365;
      
      if (oldPlanPurchaseDate && oldPlanBasePriceOnly > 0) {
        const now = new Date();
        const millisecondsUsed = now.getTime() - oldPlanPurchaseDate.getTime();
        daysUsed = Math.floor(millisecondsUsed / (1000 * 60 * 60 * 24));
        daysRemaining = Math.max(0, totalDaysInYear - daysUsed);
        
        // Calculate credit based only on base plan price (not including addons)
        // This ensures fair proration - users get credit for unused base plan time only
        proratedCredit = (daysRemaining / totalDaysInYear) * oldPlanBasePriceOnly;
        
        console.log("Proration calculation (BASE PLAN ONLY) -------", {
          oldBasePlanPrice: oldPlanBasePriceOnly,
          purchaseDate: oldPlanPurchaseDate,
          daysUsed,
          daysRemaining,
          proratedCredit: proratedCredit.toFixed(2),
          note: "Credit calculated from base plan price only, excluding addon costs"
        });
      }
      
      // Final amount = New plan price - Credit for unused time
      const finalAmount = Math.max(0, totalNewPlanAmount - proratedCredit);
      const amountCents = Math.round(finalAmount * 100);
      
      const breakdown = {
        newPlanPrice: baseAmount,
        studentAddons: finalStudentCount * studentPrice,
        teacherAddons: finalTeacherCount * teacherPrice,
        totalNewPlanAmount: totalNewPlanAmount,
        oldBasePlanPrice: oldPlanBasePriceOnly,
        oldPlanCredit: proratedCredit,
        daysUsed,
        daysRemaining,
        totalAmount: finalAmount,
        isProrated: proratedCredit > 0,
        note: proratedCredit > 0 
          ? `Credit of $${proratedCredit.toFixed(2)} applied for ${daysRemaining} unused days on previous BASE PLAN (addons excluded from proration)`
          : "One-time purchase: full payment for new plan",
        addonCounts: {
          students: finalStudentCount,
          teachers: finalTeacherCount,
        },
        pricingNote: "Proration calculated on base plan price only. Addon costs are not prorated."
      };
      
      console.log(
        "One time upgrade amounts --------",
        baseAmount,
        finalAmount,
        amountCents,
        breakdown
      );
      
      if (amountCents <= 0) {
        // If credit covers the full new plan amount, no payment needed
        await PaymentModel.create({
          accountId,
          planId: newPlan.id ?? null,
          mode: "one_time",
          amountCents: 0,
          currency: "usd",
          stripePaymentIntentId: "",
          status: "succeeded",
          addons: {
            students: finalStudentCount,
            teachers: finalTeacherCount,
            totalAddonCost: finalAddonCost,
            totalCost: 0,
            basePlanPrice: baseAmount, // Storing actual base plan price for future credit calculations
          },
          metadata: {
            upgradeType: "yearly_upgrade_no_charge",
            proratedCredit,
            daysRemaining,
            oldPlanSlug: currentPlan?.slug || "",
            newPlanSlug,
            upgradedAt: new Date().toISOString(),
            idempotencyKey: idempotencyKey || undefined,
          }
        });
        
        // Update account plan
        await AccountModel.update(accountId, {
          plan_id: newPlan.id ?? null,
        });
        
        return res.status(200).json({
          status: "success",
          noPaymentRequired: true,
          amount: 0,
          breakdown,
          totalAddonCost: finalAddonCost,
          currency: "usd",
          message: "Plan upgraded using credit from previous plan"
        });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: "usd",
        customer: stripeCustomerId,
        payment_method_types: ["card"],
        setup_future_usage: "off_session",
        metadata: {
          accountId,
          oldPlanSlug: currentPlan?.slug || "",
          newPlanSlug,
          purchaseType,
          addons: JSON.stringify({ students: finalStudentCount, teachers: finalTeacherCount }),
          totalAddonCost: String(finalAddonCost),
          totalCost: String(finalAmount),
          proratedCredit: String(proratedCredit),
          daysUsed: String(daysUsed),
          daysRemaining: String(daysRemaining),
        },
      });
      console.log("Payment Intent", paymentIntent);
      await PaymentModel.create({
        accountId,
        planId: newPlan.id ?? null,
        mode: "one_time",
        amountCents,
        currency: "usd",
        stripePaymentIntentId: paymentIntent.id,
        status: "pending",
        addons: {
          students: finalStudentCount,
          teachers: finalTeacherCount,
          totalAddonCost: finalAddonCost,
          totalCost: finalAmount,
          basePlanPrice: baseAmount, // Store actual base plan price for future credit calculations
        },
        metadata: {
          upgradeType: "yearly_upgrade_with_charge",
          proratedCredit,
          daysRemaining,
          oldPlanSlug: currentPlan?.slug || "",
          newPlanSlug,
          upgradedAt: new Date().toISOString(),
          idempotencyKey: idempotencyKey || undefined,
        }
      });
      console.log(
        "Final done --------",
        paymentIntent.client_secret,
        finalAmount,
        finalAddonCost
      );
      return res.status(200).json({
        status: "success",
        clientSecret: paymentIntent.client_secret,
        amount: finalAmount,
        breakdown, // Include breakdown showing proration details
        totalAddonCost: finalAddonCost,
        currency: "usd",
      });
    }
  } catch (err: any) {
    console.error("Upgrade plan error:", err);
    return res.status(err.status || 500).json({ error: err.message });
  }
};
