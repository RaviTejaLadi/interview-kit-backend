import { Router } from "express";
import {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  refreshAccessToken,
  logout,
} from "../controllers/auth.controller";
import { protect } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  refreshTokenSchema,
} from "../schemas/auth.schema";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/refresh", validate(refreshTokenSchema), refreshAccessToken);

// Protected routes
router.get("/me", protect, getMe);
router.patch("/me", protect, validate(updateProfileSchema), updateProfile);
router.put(
  "/change-password",
  protect,
  validate(changePasswordSchema),
  changePassword
);
router.post("/logout", protect, logout);

export default router;
