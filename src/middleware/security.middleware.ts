import rateLimit from "express-rate-limit";

export const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 1000,
  message: "Too many requests from this IP, please try again after 55 minutes",
});

// Stricter rate limiter for payment upgrade endpoints(in a single time avoid multiple upgrade requests)
export const paymentUpgradeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20, 
  message: "Too many upgrade requests. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
