import bcrypt from "bcryptjs";
import express from "express";
import Stripe from "stripe";
import { stripe } from "../config/stripe.js";
import { PaymentModel } from "../models/payment.model.js";
import { AccountModel } from "../models/account.model.js";
import { UserModel } from "../models/user.model.js";
import { StripeCustomerModel } from "../models/stripe-customer.model.js";
import { PlanModel } from "../models/plan.model.js";
import {
  notifyPaymentFailure,
  notifyPaymentSuccess,
} from "../controllers/payment.controller.js";
import { applyPlanLimits } from "@/helper/applyPlanLimits.js";

const router = express.Router();
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

declare global {
  namespace Express {
    interface Request {
      billingData?: {
        firstName: string | null;
        lastName: string | null;
        phone: string | null;
        address: string | null;
      };
    }
  }
}

router.post(
  "/",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET missing");
      return res.status(500).send("Webhook misconfigured");
    }

    const signature = req.headers["stripe-signature"];
    if (!signature || Array.isArray(signature)) {
      return res.status(400).send("Missing Stripe signature");
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.error("Stripe webhook signature verification failed", err);
      return res.status(400).send("Invalid signature");
    }

    console.log("Received event:", event.type);

    try {
      switch (event.type) {
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const paymentIntentId = paymentIntent.id;

          console.log("payment_intent.succeeded received:", {
            id: paymentIntentId,
            amount: paymentIntent.amount,
            customer: paymentIntent.customer,
            payment_method: paymentIntent.payment_method,
            status: paymentIntent.status,
          });

          const pi = (await stripe.paymentIntents.retrieve(paymentIntentId, {
            expand: ["latest_charge", "payment_method"],
          })) as Stripe.PaymentIntent;

          const charge = pi.latest_charge as Stripe.Charge;

          console.log({
            id: pi.id,
            receipt_email: pi.receipt_email,
            charge_receipt_url: charge?.receipt_url,
            charge_id: charge?.id,
          });

          console.log("PaymentIntent succeeded:", paymentIntentId);
          const payment = await PaymentModel.findByIntentId(paymentIntentId);
          if (!payment) {
            console.warn(
              "No matching payment record for intent:",
              paymentIntentId
            );
            break;
          }

          // Idempotency check - if already processed, skip
          if (payment.status === "succeeded") {
            console.log(
              "Payment already processed as succeeded, skipping:",
              paymentIntentId
            );
            break;
          }
          let firstName: string | null = null;
          let lastName: string | null = null;
          let phone: string | null = null;
          let formattedAddress: string | null = null;
          // Validate payment amount matches expected amount
          const expectedAmount = payment.amount_cents;
          const actualAmount = paymentIntent.amount;
          if (expectedAmount !== actualAmount) {
            console.error("Payment amount mismatch!", {
              paymentIntentId,
              expectedAmount,
              actualAmount,
              difference: actualAmount - expectedAmount,
            });
            // Continue processing but log the discrepancy for investigation
          }

          // Attach payment method to customer for future use (for all purchases)
          console.log("Checking payment method attachment:", {
            hasPaymentMethod: !!paymentIntent.payment_method,
            hasCustomer: !!paymentIntent.customer,
            paymentMethodType: typeof paymentIntent.payment_method,
            customerType: typeof paymentIntent.customer,
          });

          if (paymentIntent.payment_method && paymentIntent.customer) {
            try {
              const paymentMethodId =
                typeof paymentIntent.payment_method === "string"
                  ? paymentIntent.payment_method
                  : paymentIntent.payment_method.id;
              const customerId =
                typeof paymentIntent.customer === "string"
                  ? paymentIntent.customer
                  : paymentIntent.customer.id;

              console.log("Attempting to save payment method for future use:", {
                paymentMethodId,
                customerId,
              });

              // Retrieve the payment method to check if it's already attached
              const paymentMethod = await stripe.paymentMethods.retrieve(
                paymentMethodId
              );

              console.log("Payment method current state:", {
                id: paymentMethod.id,
                customer: paymentMethod.customer,
                type: paymentMethod.type,
              });

              // Only attach if not already attached to this customer
              if (paymentMethod.customer !== customerId) {
                console.log("Attaching payment method to customer...");
                await stripe.paymentMethods.attach(paymentMethodId, {
                  customer: customerId,
                });
                console.log("Payment method attached successfully");
              } else {
                console.log("Payment method already attached to customer");
              }

              // Set as default payment method for future invoice payments
              await stripe.customers.update(customerId, {
                invoice_settings: {
                  default_payment_method: paymentMethodId,
                },
              });

              console.log("Payment method set as default for customer:", {
                paymentMethodId,
                customerId,
              });

              // Verify the attachment worked by listing payment methods
              const pmList = await stripe.paymentMethods.list({
                customer: customerId,
                type: "card",
              });
              console.log("Verification - Payment methods for customer:", {
                customerId,
                count: pmList.data.length,
                paymentMethods: pmList.data.map((pm) => ({
                  id: pm.id,
                  brand: pm.card?.brand,
                  last4: pm.card?.last4,
                })),
              });
            } catch (err: any) {
              console.error("Failed to attach payment method:", {
                error: err.message,
                type: err.type,
                code: err.code,
              });
              // Don't throw - payment already succeeded, this is just a convenience feature
            }
          } else {
            console.log("No payment method or customer to attach");
          }

          const updated = await PaymentModel.updateStatusByIntentId(
            paymentIntentId,
            {
              status: "succeeded",
              metadata: paymentIntent.metadata,
            }
          );
          console.log(
            "UPDATED PAYMENT::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::",
            updated
          );

          if (!updated) {
            console.warn(
              `No payment record found for intent: ${paymentIntentId}`
            );
            // This could be a webhook for a payment created outside our system
            break;
          }

          if (!updated.account_id) {
            console.error(`Payment record ${updated.id} has no account_id`);
            break;
          }

          const account = await AccountModel.findById(updated.account_id);

          if (!account) {
            console.error(
              `Account not found for payment: ${updated.id}, account_id: ${updated.account_id}`
            );
            break;
          }

          // Ensure user exists
          // let user = await UserModel.findPrimaryByAccountId(updated.account_id);
          let user =
            (await UserModel.findPrimaryByAccountId(updated.account_id)) ||
            (await UserModel.findByEmail(account.owner_email));

          if (!user) {
            let user_type: "student" | "teacher" | "admin" = "student";
            switch (updated.metadata?.planSlug) {
              // case "personal":
              //   user_type = "student";
              //   break;
              case "single-class":
                user_type = "teacher";
                break;
              case "multi-class":
              case "department":
              case "school":
                user_type = "admin";
                break;
            }

            const email =
              account.owner_email || `user_${Date.now()}@example.com`;

            let password: string;

            if (account.password) {
              console.log("Using existing hashed password");
              password = account.password;
            } else {
              console.log("No password found, generating new one");
              password = await bcrypt.hash(
                Math.random().toString(36).slice(-8),
                12
              );
            }

            // Extract firstname, lastname, address, phone number from Stripe ----------
            if (charge?.billing_details) {
              const billing = charge.billing_details;
              const fullName = billing.name || "";

              firstName = fullName.split(" ")[0] || null;
              lastName = fullName.split(" ").slice(1).join(" ") || null;

              phone = billing.phone || null;

              const addr = (billing.address || {}) as Stripe.Address;

              formattedAddress = Object.entries({
                line1: addr.line1,
                line2: addr.line2,
                city: addr.city,
                state: addr.state,
                postal_code: addr.postal_code,
                country: addr.country,
              })
                .filter(([_, value]) => Boolean(value))
                .map(([key, value]) => `${key}: ${value}`)
                .join(", ");

              req.billingData = {
                firstName,
                lastName,
                phone,
                address: formattedAddress || null,
              };

              console.log(
                "::::::::::::::::::::::::::::::::::::::::::@@",
                firstName,
                lastName,
                phone,
                formattedAddress
              );
            }

            user = await UserModel.create({
              first_name: firstName || "Unknown",
              last_name: lastName || "Unknown",
              email,
              password,
              user_type,
              account_id: updated.account_id,
              address: formattedAddress || null,
            });
          }

          await PaymentModel.attachUserToIntent(paymentIntentId, user.id);
          await StripeCustomerModel.attachUser(updated.account_id, user.id);

          // Update account plan and subscription
          const plan = updated.plan_id
            ? await PlanModel.findById(updated.plan_id)
            : null;

          const startDate = new Date();

          let endDate = null;

          // If subscription mode => monthly
          if (updated.mode === "subscription") {
            endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + 1);
          }
          // If subscription mode => yearly
          if (updated.mode === "one_time") {
            endDate = new Date(startDate);
            endDate.setFullYear(endDate.getFullYear() + 1);
          }

          await AccountModel.update(updated.account_id, {
            plan_id: updated.plan_id,
            subscription_status:
              updated.mode === "subscription" ? "active" : "paid",
            subscription_start_date: startDate.toISOString().slice(0, 10),
            subscription_end_date: endDate
              ? endDate.toISOString().slice(0, 10)
              : null,
            billing_cycle:
              updated.mode === "subscription" ? "monthly" : "one_time",
            payment_status: "paid",
            owner_name: `${firstName || "Unknown"} ${lastName || ""}`,
            phone: phone || null,
            address: formattedAddress || null,
          });

          const extra_students = updated.addons?.students || 0;
          const extra_teachers = updated.addons?.teachers || 0;

          await UserModel.update(user.id, {
            total_students:
              (plan?.max_students_per_school || 0) + extra_students,
            total_teachers:
              (plan?.max_teachers_per_school || 0) + extra_teachers,
            total_classes: plan?.max_classes_per_school || 0,
            total_schools: plan?.max_schools || 0,
          });

          // Handle conversion-specific logic
          const conversionType =
            updated.metadata?.conversionType ||
            paymentIntent.metadata?.conversionType;
          const upgradedFromTrial =
            updated.metadata?.upgradedFromTrial ||
            paymentIntent.metadata?.upgradedFromTrial;

          if (upgradedFromTrial === "true") {
            console.log("Trial to Paid upgrade completed", {
              accountId: updated.account_id,
              mode: updated.mode,
              amount: updated.amount_cents / 100,
            });

            // Account status already set to "active" or "paid" above
            // Trial period ended when subscription was created with trial_end: "now"
          } else if (conversionType === "monthly_to_yearly") {
            console.log("Monthly to Yearly conversion completed", {
              accountId: updated.account_id,
              cancelledSubscriptionId:
                updated.metadata?.cancelledSubscriptionId,
            });

            // Subscription will be cancelled by Stripe automatically at period end
            // Account status already set to "paid" above

            // Clear subscription ID from stripe_customers table
            await StripeCustomerModel.updateByAccountId(updated.account_id, {
              stripe_subscription_id: null,
            } as any);
          } else if (conversionType === "yearly_to_monthly") {
            console.log("Yearly to Monthly conversion completed", {
              accountId: updated.account_id,
              subscriptionId: updated.stripe_subscription_id,
              yearlyCredit: updated.metadata?.yearlyCredit,
            });

            // Subscription already created, account status set to "active" above
            // Yearly credit already applied via Stripe balance or first invoice
          }

          await notifyPaymentSuccess(paymentIntentId);
          break;
        }

        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const message =
            paymentIntent.last_payment_error?.message || "Payment failed";

          await PaymentModel.updateStatusByIntentId(paymentIntent.id, {
            status: "failed",
            failReason: message,
          });

          await notifyPaymentFailure(paymentIntent.id, message);
          break;
        }

        case "customer.subscription.created": {
          const subscription = event.data.object as Stripe.Subscription;
          console.log("Subscription created:", subscription.id);

          const accountId = subscription.metadata?.accountId;
          const planSlug = subscription.metadata?.planSlug;
          const upgradedFromTrial = subscription.metadata?.upgradedFromTrial;

          if (!accountId) {
            console.error(
              "No accountId in subscription metadata:",
              subscription.id
            );
            break;
          }

          // Check if this is an upgrade from trial (trial_end: "now" was set)
          const isTrialUpgrade =
            upgradedFromTrial === "true" || subscription.trial_end === null;

          if (subscription.id) {
            await PaymentModel.updateBySubscriptionId(subscription.id, {
              status: isTrialUpgrade ? "pending" : "trialing",
              stripeSubscriptionId: subscription.id,
              metadata: {
                ...(subscription.metadata ?? {}),
              },
            });
          }

          // Update account status based on whether this is a trial upgrade or new trial
          if (accountId) {
            if (isTrialUpgrade) {
              // Trial upgrade - set to active, payment will be processed
              console.log("Subscription created from trial upgrade:", {
                subscriptionId: subscription.id,
                accountId,
                status: subscription.status,
              });

              // Don't set to trialing - wait for payment_intent.succeeded to set to active
            } else {
              // New trial subscription
              const startDate = new Date();
              const endDate = new Date(startDate);
              endDate.setDate(endDate.getDate() + 7);
              await AccountModel.update(accountId, {
                subscription_status: "trialing",
                subscription_start_date: startDate.toISOString().slice(0, 10),
                subscription_end_date: endDate.toISOString().slice(0, 10),
                billing_cycle: "monthly",
              });
            }
          }

          let user = await UserModel.findPrimaryByAccountId(accountId);
          if (!user) {
            const account = await AccountModel.findById(accountId);
            const email =
              account?.owner_email ?? `user_${Date.now()}@example.com`;
            const password =
              account?.password ??
              (await bcrypt.hash(Math.random().toString(36).slice(-8), 12));
            user = await UserModel.create({
              first_name: "Unknown",
              last_name: "Unknown",
              email,
              password,
              user_type: planSlug === "single-class" ? "teacher" : "admin",
              account_id: accountId,
              address: null
            });
          }

          if (user && accountId) {
            await StripeCustomerModel.updateByAccountId(accountId, {
              user_id: user.id,
            });
            await PaymentModel.updateUserIdForAccount(accountId, user.id);
          }
          let extraTeachers = 0;
          let extraStudents = 0;

          if (subscription.metadata?.addons) {
            const addons = JSON.parse(subscription.metadata.addons);
            extraTeachers = addons.teachers || 0;
            extraStudents = addons.students || 0;
          }
          if (accountId && planSlug) {
            await applyPlanLimits(accountId, planSlug, {
              teachers: extraTeachers,
              students: extraStudents,
            });
          }
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object as Stripe.Invoice;
          console.log("Invoice payment succeeded:", invoice.id);

          const subscriptionId = (invoice as any).subscription as string | null;
          const paymentIntentId = (invoice as any).payment_intent as
            | string
            | null;

          if (paymentIntentId) {
            const existingPayment = await PaymentModel.findByIntentId(
              paymentIntentId
            );
            // Idempotency check
            if (existingPayment && existingPayment.status === "succeeded") {
              console.log(
                "Payment intent already succeeded, skipping:",
                paymentIntentId
              );
            } else {
              await PaymentModel.updateStatusByIntentId(paymentIntentId, {
                status: "succeeded",
                metadata: invoice.metadata ?? {},
              });
              await notifyPaymentSuccess(paymentIntentId);
            }
          }

          const acctId = invoice.metadata?.accountId ?? null;
          const planSlug = invoice.metadata?.planSlug ?? null;

          if (!subscriptionId) {
            console.warn("No subscription ID in invoice:", invoice.id);
            break;
          }

          const subscription = await stripe.subscriptions.retrieve(
            subscriptionId as string
          );
          const defaultPaymentMethod = subscription.default_payment_method as
            | string
            | null;

          if (defaultPaymentMethod && acctId) {
            await StripeCustomerModel.updateByAccountId(acctId, {
              default_payment_method: defaultPaymentMethod,
            } as any);
          }

          await PaymentModel.updateBySubscriptionId(subscriptionId as string, {
            status: "succeeded",
            stripeSubscriptionId: subscriptionId,
            metadata: invoice.metadata ?? {},
          });

          const startDate = new Date();
          let endDate = null;
          if (acctId) {
            endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + 1);
            await AccountModel.update(acctId, {
              subscription_status: "active",
              subscription_start_date: startDate.toISOString().slice(0, 10),
              subscription_end_date: endDate.toISOString().slice(0, 10),
              billing_cycle: "monthly",
              payment_status: "paid",
            });
            let extraTeachers = 0;
            let extraStudents = 0;

            if (invoice.metadata?.addons) {
              const addons = JSON.parse(invoice.metadata.addons);
              extraTeachers = addons.teachers || 0;
              extraStudents = addons.students || 0;
            }

            if (planSlug) {
              await applyPlanLimits(acctId, planSlug, {
                teachers: extraTeachers,
                students: extraStudents,
              });
            }
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const paymentIntentId = (invoice as any).payment_intent as
            | string
            | null;
          console.log("Invoice payment failed:", invoice.id);

          if (paymentIntentId) {
            await PaymentModel.updateStatusByIntentId(paymentIntentId, {
              status: "failed",
              failReason: "invoice.payment_failed",
            });
            await notifyPaymentFailure(
              paymentIntentId,
              "Invoice payment failed"
            );
          }

          const subscriptionId = (invoice as any).subscription as string | null;
          if (subscriptionId) {
            await PaymentModel.updateBySubscriptionId(subscriptionId, {
              status: "past_due",
            });
          }
          break;
        }

        case "customer.subscription.updated": {
          const sub = event.data.object as Stripe.Subscription;
          const accountId = sub.metadata?.accountId;

          console.log("Subscription updated:", {
            subscriptionId: sub.id,
            status: sub.status,
            cancel_at_period_end: sub.cancel_at_period_end,
            accountId,
            metadata: sub.metadata,
          });

          // Handle subscription status changes
          if (sub.status === "active") {
            if (accountId) {
              await AccountModel.update(accountId, {
                subscription_status: "active",
                payment_status: "paid",
              });
            }

            await PaymentModel.updateBySubscriptionId(sub.id, {
              status: "succeeded",
            });
          }

          // Handle cancellation (e.g., when converting monthly to yearly)
          if (sub.cancel_at_period_end) {
            console.log("Subscription marked for cancellation at period end:", {
              subscriptionId: sub.id,
              current_period_end: (sub as any).current_period_end,
              accountId,
            });

            // Update payment record to indicate scheduled cancellation
            await PaymentModel.updateBySubscriptionId(sub.id, {
              metadata: {
                ...sub.metadata,
                cancel_at_period_end: "true",
                cancellation_date: new Date(
                  (sub as any).current_period_end * 1000
                ).toISOString(),
              } as any,
            });

            // Note: Don't update account status yet - wait for actual cancellation
            console.log(
              "Subscription will cancel at:",
              new Date((sub as any).current_period_end * 1000)
            );
          }

          // Handle plan/addon changes (upgrades/downgrades)
          if (sub.items && sub.items.data.length > 0 && accountId) {
            const metadata = sub.metadata || {};
            const planSlug = metadata.newPlanSlug || metadata.planSlug;

            if (planSlug) {
              // Extract addon counts from subscription items or metadata
              let extraStudents = 0;
              let extraTeachers = 0;

              if (metadata.addons) {
                try {
                  const addons = JSON.parse(metadata.addons);
                  extraStudents = addons.students || 0;
                  extraTeachers = addons.teachers || 0;
                } catch (e) {
                  console.error("Failed to parse addons metadata:", e);
                }
              }

              // Update addon counts from subscription items if available
              for (const item of sub.items.data.slice(1)) {
                const productName = item.price?.product
                  ? typeof item.price.product === "string"
                    ? item.price.product
                    : (item.price.product as any)?.name
                  : "";
                const itemMetadata = item.price?.product
                  ? typeof item.price.product !== "string"
                    ? (item.price.product as any)?.metadata
                    : null
                  : null;

                if (
                  itemMetadata?.type === "student_addon" ||
                  productName?.includes("Student")
                ) {
                  extraStudents = item.quantity || 0;
                } else if (
                  itemMetadata?.type === "teacher_addon" ||
                  productName?.includes("Teacher")
                ) {
                  extraTeachers = item.quantity || 0;
                }
              }

              console.log("Applying updated plan limits:", {
                planSlug,
                extraStudents,
                extraTeachers,
              });

              // Apply updated plan limits
              await applyPlanLimits(accountId, planSlug, {
                students: extraStudents,
                teachers: extraTeachers,
              });
            }
          }

          break;
        }

        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          const accountId = sub.metadata?.accountId;

          console.log("Subscription deleted:", {
            subscriptionId: sub.id,
            accountId,
            metadata: sub.metadata,
          });

          if (accountId) {
            // Check if this was a planned cancellation (e.g., monthly→yearly conversion)
            const conversionType = sub.metadata?.conversionType;

            if (conversionType === "monthly_to_yearly") {
              console.log(
                "Subscription cancelled as part of monthly→yearly conversion"
              );
              // Don't change subscription_status - the yearly payment will have already set it to "paid"
              // Just clear the subscription ID from stripe_customers
              await StripeCustomerModel.updateByAccountId(accountId, {
                stripe_subscription_id: null,
              } as any);
            } else {
              // Regular cancellation - update account status
              await AccountModel.update(accountId, {
                subscription_status: "cancelled",
                subscription_end_date: new Date().toISOString().slice(0, 10),
              });

              await StripeCustomerModel.updateByAccountId(accountId, {
                stripe_subscription_id: null,
              } as any);
            }

            // Update payment records
            await PaymentModel.updateBySubscriptionId(sub.id, {
              status: "cancelled",
              metadata: {
                ...sub.metadata,
                cancelled_at: new Date().toISOString(),
              } as any,
            });
          }

          break;
        }

        case "charge.succeeded":
        case "mandate.updated":
        case "charge.updated":
        case "payment_intent.processing":
          console.log(`Ignored event type: ${event.type}`);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
          break;
      }

      return res.json({ received: true });
    } catch (error) {
      console.error("Error handling Stripe webhook event", error);
      return res.status(500).send("Webhook handler error");
    }
  }
);

export default router;
