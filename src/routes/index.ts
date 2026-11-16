/**
 * API map under /api/v1.
 * Each feature has its own router. This file only attaches them
 * and exposes a health check used by app.ts as well.
 */
import { Router, Request, Response } from "express";
import adminRoutes from "./admin.routes";
import authRoutes from "./auth.routes";
import chatRoutes from "./chat.routes";
import feedbackRoutes from "./feedback.routes";
import { env } from "../config/env";
import { ResponseStatus, sendResponse } from "../types/http-response";

const router = Router();

// Lets Bruno and hosting checks see that the process is up.
export const healthCheck = (_req: Request, res: Response) => {
  sendResponse(res, 200, {
    data: {
      environment: env.CLIENT_URL,
      timestamp: new Date().toISOString(),
    },
    status: ResponseStatus.SUCCESS,
    message: "The API is running successfully.",
  });
};

router.get("/health", healthCheck);

// Accounts: register, login, profile, password, refresh, logout.
router.use("/auth", authRoutes);
// Full access: create an admin, then manage every user and every feedback item.
router.use("/admin", adminRoutes);
// The feedback form: submit, list, read, and delete.
router.use("/feedback", feedbackRoutes);
// Gemini chats for the signed-in user, with per-account limits.
router.use("/chat", chatRoutes);

export default router;
