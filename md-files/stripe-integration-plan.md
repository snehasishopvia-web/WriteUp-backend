# Stripe Payment Integration Plan

## Current State Snapshot
- Framework: Express 5 (TypeScript) with modular folders (`controllers`, `routes`, `models`, `validators`, `middleware`).
- Database: PostgreSQL via shared `pool` (`src/config/postgres.db.ts`); migrations managed with `node-pg-migrate`.
- Auth: JWT secured routes with onboarding flows; supports cookie parsing, rate limiting, and compression.
- Stripe SDK: `stripe` dependency already in `package.json`; config file present at `src/config/stripe.ts` but unused elsewhere.
- Pending artifacts: `src/routes/paymentRoutes.ts` exists but empty; no controllers, models, migrations, or webhook handling for payments.

## Alignment and Assumptions (To Confirm)
1. **Payment Flows** - Decide whether we will ship:
   - Checkout Session flow for one-time purchases.
   - Checkout Session flow for subscriptions (recurring).
   - Payment Intents plus Elements for custom UI or pay-per-use.
   - Combination of the above (plan currently presumes support for the first and third options).
2. **Products and Pricing** - Clarify what is being sold, billing currency (INR assumed), and whether amounts are dynamic or driven by Stripe Dashboard Prices.
3. **User Mapping** - Confirm every paying user maps to an internal `user_id` (UUID) and we can require login before initiating payments.
4. **Success Criteria** - Define end-to-end acceptance (for example, payment record persisted, user entitlement updated, emails sent).
5. **Environments** - Test versus production Stripe accounts, webhook URL exposure strategy (Stripe CLI, tunnel, or deployed endpoint).

## Phase 0 - Discovery and Preparation
- Catalogue user journeys (purchase triggers, post-payment entitlements, failure fallbacks).
- Inventory required Stripe products (Prices, Products, Tax settings, Customer Portal).
- Validate environment variables already tracked in deployment pipeline (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, success and cancel URLs, price IDs).
- Confirm logging or monitoring expectations (CloudWatch, DataDog, and similar) for payment events.
- Document compliance expectations (PCI scope, data retention).

## Phase 1 - Environment and Configuration
- Extend `.env.example` (and secrets management) with all Stripe keys and URLs.
- Update `src/config/stripe.ts` to:
  - Source keys from centralized config helper (if available) instead of direct `dotenv.config()`.
  - Export typed helper functions for reuse (for example, `getStripeClient()` with pinned API version).
  - Enforce optional idempotency defaults and telemetry hooks (for example, request logging).
- Ensure `src/server.ts` loads Stripe webhook route before `express.json()` (requires raw body).
- Add configuration validation step (Zod or manual) at startup to fail fast when keys are missing.

## Phase 2 - Database and Persistence
- Draft schemas (using node-pg-migrate) for:
  - `payments` table capturing `user_id`, `stripe_payment_intent_id`, `stripe_checkout_session_id`, mode, amount (minor units), currency, status, metadata JSONB, created and updated timestamps.
  - `stripe_customers` table linking internal users to `stripe_customer_id`.
  - `subscriptions` table (if recurring offerings) with subscription status, period end, plan metadata.
  - Optional `payment_events` audit table for webhook snapshots.
- Write forward and backward migrations with indexes (unique on Stripe IDs; index on status and user).
- Extend models and services to persist and query these tables (mirror style used by existing models, which rely on SQL queries via `pool`).
- Plan seed or backfill scripts if existing users need customer records created retroactively.

## Phase 3 - Domain Services and Utilities
- Create `src/services/stripe-customer.service.ts` (or similar) to encapsulate:
  - Finding or creating Stripe Customer tied to internal user.
  - Syncing metadata (for example, email, name, school).
- Build `payment.service.ts` to:
  - Create PaymentIntents or Checkout Sessions with necessary metadata, idempotency keys, and dynamic amount validation.
  - Persist local `payments` records and expose status lookups.
  - Handle refunds or resends as future extensibility hooks.
- Add error mapping utility translating Stripe errors to API-safe messages.
- Ensure all services leverage centralized logging and metric instrumentation.

## Phase 4 - API Surface Design
- Define controller and router pairs aligned with existing structure:
  - `POST /api/v1/payments/checkout-session` -> creates Checkout session, returns URL.
  - `POST /api/v1/payments/payment-intent` -> creates PaymentIntent, returns client secret.
  - `GET /api/v1/payments/:id` -> fetches payment status for polling.
  - `POST /api/v1/payments/refund` (optional phase) -> triggers refund logic with authorization.
  - `POST /api/v1/payments/customer-portal` (optional) -> generates Billing Portal link.
- Apply existing auth middleware (`verifyAccessToken` or equivalent) to protect creation endpoints.
- Validate request bodies using current validator pattern (likely `express-validator` in `src/validators`).
- Update `paymentRoutes.ts` with grouped routes; mount under `/api/v1/payments` in `src/server.ts`.
- Extend controllers with service calls, validation handling, and standardized responses (`success: true`, etc.).

## Phase 5 - Webhook Handling
- Create dedicated route (for example, `src/routes/stripe-webhook.routes.ts`) mounted at `/webhook/stripe/:token` (include secret token in path).
- Implement Express raw body middleware only for this route; ensure ordering before generic JSON middleware.
- Verify signatures with `stripe.webhooks.constructEvent`.
- Handle core events:
  - `checkout.session.completed` -> mark payment paid; optionally create subscription rows.
  - `payment_intent.succeeded` and `payment_intent.payment_failed`.
  - `charge.refunded`, `customer.subscription.*`.
- Persist event payloads (if audit table used) and update domain tables safely (use transactions when touching multiple tables).
- Make webhook idempotent (store processed event IDs).
- Add safe logging (structured, no sensitive card data).

## Phase 6 - Business Integrations
- Update downstream services impacted by payment completion (for example, granting plan access, enabling premium features).
- Coordinate with `plan` or `account` controllers to reflect payment status in user entitlements.
- Define messaging or email triggers (if necessary) using existing notification mechanism.
- Consider scheduler or cron job to reconcile subscription status nightly via Stripe APIs.

## Phase 7 - Testing and Quality Assurance
- Unit tests:
  - Mock Stripe client using dependency injection; test service logic for success and failure paths.
  - Validate database helpers via in-memory or test database (confirm existing setup).
- Integration tests:
  - Spin up local server, hit endpoints with supertest, stub Stripe via fixtures.
- Webhook tests:
  - Use Stripe CLI in test mode; script sample payload replays to ensure idempotency.
- Manual test matrix:
  - Success, requires_action (3DS), declined card, refund.
  - Subscription create, cancel, trial expiration.
- Load and race-condition testing for idempotent PaymentIntent creation.

## Phase 8 - Observability and Operations
- Add structured logs for payment lifecycle events (creation, success, failure, refund).
- Create metrics counters or gauges (if using StatsD or Prometheus) for succeeded or failed payments.
- Set up alerting for webhook failures and elevated error rates.
- Document runbooks: how to replay webhooks, issue refunds, and rotate keys.
- Plan key rotation procedure and schedule.

## Documentation and Developer Experience
- Update `README.md` (server) with local setup steps, required env vars, and Stripe CLI commands.
- Add migration docs explaining new tables and relationships.
- Provide Postman collection updates for new endpoints.
- Create onboarding doc for support staff (how to verify a payment).

## Rollout Strategy
- Implement behind feature flag or environment toggle to soft launch.
- Deploy migrations first, then application changes.
- Run in test mode end-to-end; capture sample transactions for QA.
- Coordinate production launch with Stripe live key enablement and DNS for webhook endpoint.
- Schedule monitoring review post-launch (24-48 hours).

## Open Questions / Decisions Needed
1. Exact product catalog and pricing logic (static versus dynamic amounts).
2. Refund policy and whether refunds must be initiated from admin dashboard.
3. Requirement for invoices or tax invoices (GST in India).
4. Need for subscription upgrades or downgrades and proration handling.
5. Expected SLA for payment confirmation (do we need webhooks plus polling?).
6. Whether to integrate Stripe Customer Portal for self-service management.

## Next Steps (Post-Approval)
1. Validate assumptions above with stakeholders.
2. Approve database schema drafts and migration naming.
3. Prioritize target flows (one-time, subscription, custom UI).
4. Once requirements are locked, begin implementation following phase order.
