/**
 * Account routes at /api/v1/auth.
 * Public routes create a session. protect marks routes that need a logged-in user.
 * validate runs the matching schema before the controller.
 */
import { Router } from "express";
import {
  register,
  login,
  forgotPassword,
  verifyOtp,
  resetPassword,
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
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
} from "../schemas/auth.schema";

const router = Router();

// Open on purpose. A new person has no token yet.
router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
// Refresh accepts an existing refresh token, so it is not behind the access-token check.
router.post("/refresh", validate(refreshTokenSchema), refreshAccessToken);
// Password reset is public. The code is the proof, not an access token.
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/verify-otp", validate(verifyOtpSchema), verifyOtp);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

// Everything below needs the access token from login or register.
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
