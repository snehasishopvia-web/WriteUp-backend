import express from "express";
import { scrapeWebsite } from "../controllers/scrape.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", authenticate, scrapeWebsite);

export default router;
