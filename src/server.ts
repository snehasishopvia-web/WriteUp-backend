import express, { Request, Response, NextFunction } from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";
import compression from "compression";

import { pool } from "./config/postgres.db.js";
import errorHandlerMiddleware, {
  createError,
} from "./middleware/error.middleware.js";
import { limiter } from "./middleware/security.middleware.js";

import planRoutes from "./routes/plan.routes.js";
import accountRoutes from "./routes/account.routes.js";
import departmentRoutes from "./routes/department.routes.js";
import userRoutes from "./routes/user.routes.js";
import authRoutes from "./routes/auth.routes.js";
import onboardingRoutes from "./routes/onboarding.routes.js";
import classRoutes from "./routes/class.routes.js";
import classInvitationRoutes from "./routes/class-invitation.routes.js";
import classJoinLinkRoutes from "./routes/class-join-link.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import folderRoutes from "./routes/folder.routes.js";
import documentRoutes from "./routes/document.routes.js";
import assignmentRoutes from "./routes/assignment.routes.js";
import signupRoutes from "./routes/signup.routes.js";
import teacherFeedbackRoutes from "./routes/teacher-feedback.routes.js";
import submissionRoutes from "./routes/submission.routes.js";

import scrapeRoutes from "./routes/scrape.router.js";

import paymentRoutes from "./routes/paymentRoutes.js";
import stripeWebhookRoutes from "./routes/stripe-webhook.routes.js";
import { startCronJobs } from "./cronjob/index.js";

process.on("uncaughtException", async (err: Error) => {
  console.error("Uncaught Exception");
  console.error({
    name: err.name,
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  });
});

const app = express();
startCronJobs();
const PORT = process.env.PORT || 8192;
const NODE_ENV = process.env.NODE_ENV || "development";
const adminUrl = process.env.ADMIN_FRONTEND_URL;
const teacherUrl = process.env.TEACHER_FRONTEND_URL;
const studentUrl = process.env.STUDENT_FRONTEND_URL;
const userUrl = process.env.USER_FRONTEND_URL;

const corsOptions: CorsOptions = {
  origin:
    process.env.IS_DEVELOPMENT === "dev"
      ? [
          "http://localhost:3000",
          "https://writeup-teacher-portal.netlify.app/",
          "https://writeup-admin-portal.netlify.app/",
          "https://writeup-student-portal.netlify.app/",
          adminUrl!,
          teacherUrl!,
          studentUrl!,
          userUrl!,
        ]
      : process.env.CORS_ORIGIN?.split(",") || "",
  methods: ["GET", "POST", "DELETE", "PUT", "PATCH"],
  credentials: true, // Required for cookies
  maxAge: 86400, // 24 hours
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(limiter);

app.use("/webhooks/stripe", stripeWebhookRoutes);
console.log("✅ Stripe webhook route registered at /webhooks/stripe");

app.use(express.json({ limit: "10mb" }));
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({
      success: false,
      status: "error",
      message: "Invalid JSON payload",
    });
  }
  next();
});
app.use(
  express.urlencoded({
    limit: "10mb",
    extended: true,
    parameterLimit: 50000,
  })
);

app.use(cookieParser());
app.use(compression());

if (NODE_ENV === "development")
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    message: "Server is healthy",
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Authentication routes
app.use("/api/v1/auth", authRoutes);

// Onboarding routes
app.use("/api/v1/auth/onboarding", onboardingRoutes);

app.use("/api/v1/users", userRoutes);

// Department routes
app.use("/api/v1/departments", departmentRoutes);

// Plan routes
app.use("/api/v1/plans", planRoutes);

// Account routes
app.use("/api/v1/accounts", accountRoutes);

// Class routes
app.use("/api/v1/classes", classRoutes);
app.use("/api/v1/classes", classInvitationRoutes);
app.use("/api/v1/classes", classJoinLinkRoutes);

// Profile routes
app.use("/api/v1/profiles", profileRoutes);

// Document & Folder routes (migrated from press-backend)
app.use("/api/v1/folders", folderRoutes);
app.use("/api/v1/documents", documentRoutes);
app.use("/api/v1/scrape", scrapeRoutes);

//assignment creation
app.use("/api/v1/assignments", assignmentRoutes);

//user onboarding
app.use("/api/v1/auth", signupRoutes);

// Teacher feedback routes
app.use("/api/v1/teacher-feedbacks", teacherFeedbackRoutes);

// Submission routes
app.use("/api/v1/submissions", submissionRoutes);

// Payment routes
app.use("/api/v1/payments", paymentRoutes);

// Catch all 404 routes - must be last
app.use((req: Request, res: Response, next: NextFunction) => {
  next(createError(`Cannot find ${req.originalUrl} on this server!`, 404));
});

app.use(errorHandlerMiddleware);

const server = app.listen(PORT, async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ Database connection verified");

    console.log(`
      ${new Date()}
      🚀 Server is running in ${NODE_ENV} mode
      🔊 Listening on port ${PORT}
      `);
  } catch (error) {
    console.error("Server startup error:", error);
    process.exit(1);
  }
});

process.on("unhandledRejection", async (err: Error) => {
  console.error(err.name, err.message);

  server.close(() => {
    console.error("UNHANDLED REJECTION! server terminated.");
    process.exit(1);
  });
});

process.on("SIGTERM", async () => {
  server.close(() => {
    console.log("SIGTERM received server terminated!");
  });
});

process.on("SIGINT", async () => {
  server.close(() => {
    console.log("SIGINT received closing server.");
    process.exit(0);
  });
});

export default app;
