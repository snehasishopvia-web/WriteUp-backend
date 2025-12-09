import { stripe } from "../config/stripe.js";
import { StripeCustomerModel } from "../models/stripe-customer.model.js";
import { PlanModel } from "../models/plan.model.js";
import { PaymentModel } from "../models/payment.model.js";
import { createError } from "../middleware/error.middleware.js";
import { AccountModel } from "@/models/account.model.js";
import { UserModel } from "@/models/user.model.js";
import Stripe from "stripe";
import { getAddonPrices } from "@/helper/getTeacherAddonPrice.js";

type PurchaseType = "one_time" | "subscription";

interface CreateCheckoutSessionOptions {
  accountId: string;
  planSlug: string;
  purchaseType: PurchaseType;
  successUrl: string;
  cancelUrl: string;
  currency?: string;
  addons?: { students: number; teachers: number };
}

const DEFAULT_CURRENCY = "usd";

const roundToMinorUnits = (amount: number): number => Math.round(amount * 100);

const resolveAmountForPurchaseType = (
  plan: Awaited<ReturnType<typeof PlanModel.findBySlug>>,
  purchaseType: PurchaseType
): number => {
  if (!plan) throw createError("Plan not found while resolving amount", 404);

  if (purchaseType === "subscription") {
    const raw = Number(plan.price_monthly);
    if (Number.isNaN(raw))
      throw createError("Plan monthly price is invalid", 422);
    return raw;
  }

  const raw = Number(plan.price_yearly ?? plan.price_monthly);
  if (Number.isNaN(raw)) throw createError("Plan price is invalid", 422);
  return raw;
};

export const createCheckoutSession = async (
  options: CreateCheckoutSessionOptions
) => {
  const { accountId, planSlug, purchaseType, successUrl, cancelUrl, addons } =
    options;
  const currency = "usd";
  console.log("🟡 Starting checkout session for", {
    accountId,
    planSlug,
    purchaseType,
  });

  const plan = await PlanModel.findBySlug(planSlug);
  if (!plan) throw createError("Plan not found", 404);

  const account = await AccountModel.findById(accountId);
  if (!account) throw createError("Account not found", 404);

  // const amount = resolveAmountForPurchaseType(plan, purchaseType);
  const baseAmount = resolveAmountForPurchaseType(plan, purchaseType);
  const { studentPrice, teacherPrice } = getAddonPrices(plan, purchaseType);
  const addonsTotal =
    (options.addons?.students || 0) * studentPrice + (options.addons?.teachers || 0) * teacherPrice;
  const totalAmount = baseAmount + addonsTotal;
  const amountCents = roundToMinorUnits(totalAmount);

  // const amountCents = roundToMinorUnits(amount);
  console.log("💰 Amount resolved:", {
    baseAmount,
    amountCents,
    currency,
    totalAmount,
    addonsTotal,
  });
  if (amountCents <= 0)
    throw createError("Amount must be greater than zero", 400);

  const existingStripeCustomer = await StripeCustomerModel.findByAccountId(
    accountId
  );

  let stripeCustomerId = existingStripeCustomer?.stripe_customer_id ?? null;
  let linkedUserId: string | null = existingStripeCustomer?.user_id ?? null;

  if (!linkedUserId) {
    const accountUser = await UserModel.findPrimaryByAccountId(accountId);
    linkedUserId = accountUser?.id ?? null;
  }

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: account.owner_email ?? undefined,
      metadata: {
        accountId,
      },
    });
    stripeCustomerId = customer.id;
    console.log("✅ Created Stripe customer:", stripeCustomerId);
    await StripeCustomerModel.upsert({
      accountId,
      stripeCustomerId: customer.id,
      email: customer.email ?? account.owner_email ?? null,
      userId: linkedUserId ?? null,
    });
    console.log("⚙️ Creating checkout session with:", {
      mode: purchaseType === "subscription" ? "subscription" : "payment",
      amountCents,
      currency,
      stripeCustomerId,
    });
  } else if (
    account.owner_email &&
    existingStripeCustomer?.email &&
    existingStripeCustomer.email !== account.owner_email
  ) {
    // Keep email in sync for future billing communication
    await stripe.customers.update(stripeCustomerId, {
      email: account.owner_email,
    });
    await StripeCustomerModel.upsert({
      accountId,
      stripeCustomerId,
      email: account.owner_email,
      userId: linkedUserId ?? null,
    });
  }

  const mode = purchaseType === "subscription" ? "subscription" : "payment";
  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode,
      customer: stripeCustomerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: accountId,
      metadata: {
        accountId,
        planId: plan.id ?? "",
        planSlug,
        purchaseType,
        addons: JSON.stringify(options.addons || {}),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: plan.name,
              metadata: {
                planId: plan.id ?? "",
                planSlug,
                addons: JSON.stringify(options.addons || {}),
              },
            },
            ...(mode === "subscription"
              ? { recurring: { interval: "month" as const } }
              : {}),
          },
        },
      ],
      allow_promotion_codes: true,
    });
  } catch (error: any) {
    console.error("❌ Stripe session creation failed:");
    console.error("Message:", error.message);
    console.error("Type:", error.type);
    console.error("Code:", error.code);
    console.error("Raw:", error.raw);

    throw createError(
      `Failed to create Stripe checkout session: ${error.message}`,
      500
    );
  }
  console.log("✅ Stripe session created:", session.id);
  await PaymentModel.create({
    userId: linkedUserId ?? null,
    accountId: account.id,
    planId: plan.id ?? null,
    mode: purchaseType,
    amountCents,
    currency,
    status: "pending",
    // stripeCheckoutSessionId: null,
    stripePaymentIntentId: "",
    stripeSubscriptionId: "",
    metadata: {
      planSlug,
      planName: plan.name,
      purchaseType,
      amount: totalAmount,
      accountEmail: account.owner_email,
      accountName: account.owner_name,
    },
    addons,
  });

  return {
    session,
    amount: totalAmount,
    amountCents,
    currency,
    mode,
  };
};

export const createPaymentIntent = async ({
  accountId,
  planSlug,
  purchaseType,
  addons,
}: {
  accountId: string;
  planSlug: string;
  purchaseType: "one_time" | "subscription";
  addons?: { students: number; teachers: number };
}) => {
  const plan = await PlanModel.findBySlug(planSlug);
  if (!plan) throw new Error("Plan not found");

  // validate plan has required pricing based on purchase type
  if (purchaseType === "subscription") {
    if (!plan.price_monthly || plan.price_monthly <= 0) {
      throw new Error(`Plan ${planSlug} does not have valid monthly pricing`);
    }
    if (!plan.stripe_monthly_price_id) {
      throw new Error(`Plan ${planSlug} is missing Stripe monthly price ID`);
    }
  } else {
    if (!plan.price_yearly || plan.price_yearly <= 0) {
      throw new Error(`Plan ${planSlug} does not have valid yearly pricing`);
    }
  }

  const account = await AccountModel.findById(accountId);
  if (!account) {
    throw new Error("Account not found");
  }
  
  const customerEmail = account?.owner_email ?? undefined;
  
  // Validate customer email for stripe customer creation
  if (!customerEmail) {
    console.warn(`Account ${accountId} has no email, using placeholder`);
  }

  // Ensure stripe customer exists or not
  const existingCustomer = await StripeCustomerModel.findByAccountId(accountId);
  let stripeCustomerId = existingCustomer?.stripe_customer_id ?? null;

  if (!stripeCustomerId) {
    try {
      // Create stripe customer with idempotency key to prevent duplicates on retry
      const idempotencyKey = `customer_create_${accountId}_${Date.now()}`;
      const customer = await stripe.customers.create(
        {
          email: customerEmail || `no-email-${accountId}@placeholder.com`,
          metadata: { 
            accountId,
            createdAt: new Date().toISOString(),
          },
        },
        {
          idempotencyKey,
        }
      );
      stripeCustomerId = customer.id;
      
      const primaryUser = await UserModel.findPrimaryByAccountId(accountId);
      const userIdToSave = primaryUser?.id ?? null;
      
      await StripeCustomerModel.upsert({
        accountId,
        stripeCustomerId,
        email: customer.email ?? customerEmail ?? null,
        userId: userIdToSave ?? null,
      });
      
      console.log(`Created Stripe customer ${stripeCustomerId} for account: ${accountId}`);
    } catch (error: any) {
      console.error("Failed to create Stripe customer", {
        error: error.message,
        accountId,
        email: customerEmail,
      });
      throw new Error(`Failed to create Stripe customer: ${error.message}`);
    }
  } else {
    console.log(`Using existing Stripe customer ${stripeCustomerId}`);
  }

  const { studentPrice, teacherPrice } = getAddonPrices(plan, purchaseType);

  const totalAddonCost =
    (addons?.students || 0) * studentPrice + (addons?.teachers || 0) * teacherPrice;

  // Monthly subscription
  if (purchaseType === "subscription") {
    const baseAmount = Number(plan.price_monthly);
    if (isNaN(baseAmount) || baseAmount <= 0) {
      throw new Error(`Invalid monthly price for plan ${planSlug}: ${plan.price_monthly}`);
    }
    
    const totalAmount = baseAmount + totalAddonCost;
    const amountCents = Math.round(totalAmount * 100);
    
    if (amountCents <= 0) {
      throw new Error(`Invalid total amount: ${totalAmount}`);
    }

    const accountHasTrial = account?.has_used_trial === true;

    // First Time Monthly Plan to GIVE TRIAL
    const trialDays = accountHasTrial ? 0 : 7;

    // Build subscription items array with base plan and addons
    const subscriptionItems: Stripe.SubscriptionCreateParams.Item[] = [
      {
        price: plan.stripe_monthly_price_id!,
        quantity: 1,
      },
    ];

    // Add student addon as separate line item if needed
    if (addons?.students && addons.students > 0) {
      try {
        // Create an ephemeral price for student addons
        const studentPriceObj = await stripe.prices.create({
          currency: "usd",
          unit_amount: Math.round(studentPrice * 100),
          recurring: { interval: "month" },
          product_data: {
            name: `Additional Students - ${plan.name}`,
            metadata: {
              addon_type: "students",
              plan_slug: planSlug,
            },
          },
        });
        
        subscriptionItems.push({
          price: studentPriceObj.id,
          quantity: addons.students,
        });
      } catch (error: any) {
        console.error("Failed to create student addon price:", error.message);
        throw new Error(`Failed to add student addons: ${error.message}`);
      }
    }

    // Add teacher addon as separate line item if needed
    if (addons?.teachers && addons.teachers > 0) {
      try {
        if (teacherPrice <= 0) {
          throw new Error(`Invalid teacher price: ${teacherPrice}`);
        }
        
        // Create an ephemeral price for teacher addons
        const teacherPriceObj = await stripe.prices.create({
          currency: "usd",
          unit_amount: Math.round(teacherPrice * 100), 
          recurring: { interval: "month" },
          product_data: {
            name: `Additional Teachers - ${plan.name}`,
            metadata: {
              addon_type: "teachers",
              plan_slug: planSlug,
            },
          },
        });
        
        subscriptionItems.push({
          price: teacherPriceObj.id,
          quantity: addons.teachers,
        });
      } catch (error: any) {
        console.error("Failed to create teacher addon price:", error.message);
        throw new Error(`Failed to add teacher addons: ${error.message}`);
      }
    }

    let subscription;
    try {
      // Create subscription with idempotency key
      const idempotencyKey = `sub_create_${accountId}_${planSlug}_${Date.now()}`;
      
      subscription = await stripe.subscriptions.create(
        {
          customer: stripeCustomerId,
          items: subscriptionItems,
          trial_period_days: trialDays,
          // Allow subscription to be created; payment intent will be created for immediate charges
          collection_method: "charge_automatically",
          payment_behavior: "default_incomplete",
          payment_settings: {
            save_default_payment_method: "on_subscription",
            payment_method_types: ["card"],
          },
          trial_settings: {
            end_behavior: { missing_payment_method: "cancel" },
          },
          // Expand invoice or payment_intent in case there's an immediate invoice (no trial)
          expand: ["latest_invoice.payment_intent"],
          metadata: {
            accountId,
            planSlug,
            purchaseType,
            addons: JSON.stringify(addons || {}),
            totalAddonCost: String(totalAddonCost),
            totalCost: String(totalAmount),
            trialApplied: trialDays > 0 ? "yes" : "no",
            createdAt: new Date().toISOString(),
          },
        },
        {
          idempotencyKey,
        }
      );
      
      console.log(`Created subscription: ${subscription.id} for account: ${accountId}`);
    } catch (error: any) {
      console.error("Failed to create subscription:", {
        error: error.message,
        type: error.type,
        code: error.code,
        accountId,
        planSlug,
        stripeCustomerId,
      });
      throw new Error(`Failed to create subscription: ${error.message}`);
    }

    // Get the latest invoice and payment intent
    let latestInvoice = subscription.latest_invoice as Stripe.Invoice | null;
    let paymentIntent: Stripe.PaymentIntent | undefined | null = null;

    // If latest_invoice is just an id, fetch the full invoice object
    if (latestInvoice && typeof latestInvoice === 'string') {
      latestInvoice = await stripe.invoices.retrieve(latestInvoice, {
        expand: ['payment_intent'],
      });
    }

    // Extract payment intent
    if (latestInvoice) {
      const piFromInvoice = (latestInvoice as any).payment_intent;
      
      // If payment_intent is just an id, fetch the full object
      if (piFromInvoice && typeof piFromInvoice === 'string') {
        paymentIntent = await stripe.paymentIntents.retrieve(piFromInvoice);
      } else if (piFromInvoice) {
        paymentIntent = piFromInvoice as Stripe.PaymentIntent;
      }
    }

    // Save Payment Record (subscription created)
    try {
      await PaymentModel.create({
        accountId,
        planId: plan.id ?? null,
        mode: "subscription",
        amountCents,
        currency: "usd",
        stripePaymentIntentId: paymentIntent?.id ?? "",
        stripeSubscriptionId: subscription.id,
        status:
          trialDays > 0 ? "trialing" : paymentIntent ? "pending" : "pending",
        addons: {
          students: addons?.students ?? 0,
          teachers: addons?.teachers ?? 0,
          totalAddonCost,
          totalCost: totalAmount,
        },
      });
      console.log(`Created payment record for subscription: ${subscription.id}`);
    } catch (error: any) {
      console.error("Failed to create payment record:", {
        error: error.message,
        subscriptionId: subscription.id,
        accountId,
      });
      
      // if subscription created in Stripe but payment record failed
      // Try to cancel the subscription to prevent subscription
      try {
        console.warn(`Attempting to cancel orphaned subscription ${subscription.id}`);
        await stripe.subscriptions.cancel(subscription.id);
        console.log(`Canceled orphaned subscription ${subscription.id}`);
      } catch (cancelError: any) {
        console.error(`Failed to cancel orphaned subscription ${subscription.id}`, cancelError.message);
      
      }
      
      throw new Error(`Payment record creation failed: ${error.message}`);
    }

    // Mark trial as USED
    if (!accountHasTrial) {
      await AccountModel.update(accountId, {
        has_used_trial: true,
        billing_cycle: "monthly",
      });
    }

    // If there's an immediate payment intent (no trial or immediate invoice), return its client_secret so frontend can complete payment
    if (paymentIntent && paymentIntent.client_secret) {
      return {
        clientSecret: paymentIntent.client_secret,
        subscriptionId: subscription.id,
        trialDays,
        amount: totalAmount,
        totalAddonCost,
        currency: "usd",
        mode: "subscription",
        requiresAction: false,
      };
    }

    // For trialing subscriptions: create a SetupIntent so frontend can collect and save the customer's card for automatic off-session charges after trial ends
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        accountId,
        subscriptionId: subscription.id,
        planSlug,
      },
    });

    if (!setupIntent.client_secret) {
      throw new Error("Failed to create SetupIntent - no client_secret returned");
    }

    return {
      clientSecret: setupIntent.client_secret,
      subscriptionId: subscription.id,
      trialDays,
      amount: totalAmount,
      totalAddonCost,
      currency: "usd",
      mode: "subscription",
      requiresAction: false,
    };
  } else {
    // for yearly purchase  create a one-time PaymentIntent (not a subscription)
    const baseAmount = Number(plan.price_yearly ?? plan.price_monthly ?? 0);
    if (isNaN(baseAmount) || baseAmount <= 0) {
      throw new Error(`Invalid yearly price for plan ${planSlug}: ${plan.price_yearly}`);
    }
    
    const totalAmount = baseAmount + totalAddonCost;
    const amountCents = Math.round(totalAmount * 100);
    if (amountCents <= 0 || amountCents > 99999999) {
      throw new Error(`Invalid payment amount: $${totalAmount}`);
    }

    // Create a PaymentIntent for one time payment
    let paymentIntent;
    try {
      const idempotencyKey = `pi_create_${accountId}_${planSlug}_${Date.now()}`;
      
      paymentIntent = await stripe.paymentIntents.create(
        {
          amount: amountCents,
          currency: "usd",
          customer: stripeCustomerId,
          automatic_payment_methods: { enabled: true },
          setup_future_usage: "off_session",
          metadata: {
            accountId,
            planSlug,
            purchaseType: "one_time",
            addons: JSON.stringify(addons || {}),
            studentsCount: String(addons?.students ?? 0),
            teachersCount: String(addons?.teachers ?? 0),
            totalAddonCost: String(totalAddonCost),
            totalCost: String(totalAmount),
            createdAt: new Date().toISOString(),
          },
          description: `Yearly plan: ${plan.name} with addons`,
        },
        {
          idempotencyKey,
        }
      );
      
      console.log(`Created PaymentIntent: ${paymentIntent.id} for account: ${accountId}`);
    } catch (error: any) {
      console.error("Failed to create PaymentIntent:", {
        error: error.message,
        type: error.type,
        code: error.code,
        accountId,
        planSlug,
        amount: amountCents,
      });
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }

    console.log("PaymentIntent created for yearly purchase:", {
      paymentIntentId: paymentIntent.id,
      amount: amountCents,
      status: paymentIntent.status,
    });

    try {
      await PaymentModel.create({
        accountId,
        planId: plan.id ?? null,
        mode: "one_time",
        amountCents,
        currency: "usd",
        stripePaymentIntentId: paymentIntent.id,
        stripeSubscriptionId: null,
        status: "pending",
        metadata: {
          planSlug,
          purchaseType,
          addons: {
            ...addons,
            totalAddonCost,
            totalCost: totalAmount,
          },
        },
        addons: {
          students: addons?.students ?? 0,
          teachers: addons?.teachers ?? 0,
          totalAddonCost,
          totalCost: totalAmount,
        },
      });
      console.log(`Created payment record for PaymentIntent: ${paymentIntent.id}`);
    } catch (error: any) {
      console.error("Failed to create payment record:", {
        error: error.message,
        paymentIntentId: paymentIntent.id,
        accountId,
      });
      
      // if paymentIntent created in Stripe but payment record failed
      // Try to cancel the PaymentIntent to prevent charges
      try {
        console.warn(`Attempting to cancel orphaned PaymentIntent: ${paymentIntent.id}`);
        await stripe.paymentIntents.cancel(paymentIntent.id);
        console.log(`Canceled orphaned PaymentIntent: ${paymentIntent.id}`);
      } catch (cancelError: any) {
        console.error(`Failed to cancel orphaned PaymentIntent: ${paymentIntent.id}`, cancelError.message);
      }
      
      throw new Error(`Payment record creation failed: ${error.message}`);
    }

    if (!paymentIntent.client_secret) {
      console.error("Payment intent exists but no client_secret:", {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
      });
      throw new Error("PaymentIntent created but no client_secret returned");
    }

    return {
      clientSecret: paymentIntent.client_secret,
      subscriptionId: null,
      amount: totalAmount,
      totalAddonCost,
      currency: "usd",
      mode: "one_time",
    };
  }
};
