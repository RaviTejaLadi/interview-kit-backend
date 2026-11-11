import { Router, Request, Response } from "express";
import authRoutes from "./auth.routes";
import { env } from "../config/env";

const router = Router();

export const healthCheck = (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "API is running smoothly",
    environment: env.CLIENT_URL,
    timestamp: new Date().toISOString(),
  });
};

router.get("/health", healthCheck);

router.use("/auth", authRoutes);

export default router;
