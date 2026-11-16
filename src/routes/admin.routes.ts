/**
 * Admin routes at /api/v1/admin.
 * register is special: the first admin can be created before any admin exists.
 * Every later route requires a live admin role, so a normal user cannot manage the project.
 */
import { Router } from "express";
import {
  createAdmin,
  deleteAnyFeedback,
  deleteUser,
  getAllFeedback,
  getAnyFeedback,
  getUser,
  getUsers,
  updateUser,
} from "../controllers/admin.controller";
import { authorize, optionalProtect, protect } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  adminUpdateUserSchema,
  adminUserIdSchema,
  createAdminSchema,
} from "../schemas/admin.schema";
import { feedbackIdSchema } from "../schemas/feedback.schema";

const router = Router();

// optionalProtect allows the first call with no token, and still reads a token when one is sent.
router.post("/register", optionalProtect, validate(createAdminSchema), createAdmin);

// From here on, the caller must be logged in and their saved role must be admin.
router.use(protect, authorize("admin"));

// Full user directory.
router.get("/users", getUsers);
router.get("/users/:id", validate(adminUserIdSchema), getUser);
router.patch("/users/:id", validate(adminUpdateUserSchema), updateUser);
router.delete("/users/:id", validate(adminUserIdSchema), deleteUser);

// Full feedback directory, including items the admin did not write.
router.get("/feedback", getAllFeedback);
router.get("/feedback/:id", validate(feedbackIdSchema), getAnyFeedback);
router.delete("/feedback/:id", validate(feedbackIdSchema), deleteAnyFeedback);

export default router;
