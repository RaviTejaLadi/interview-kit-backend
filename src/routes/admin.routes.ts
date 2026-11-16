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

router.post("/register", optionalProtect, validate(createAdminSchema), createAdmin);

router.use(protect, authorize("admin"));

router.get("/users", getUsers);
router.get("/users/:id", validate(adminUserIdSchema), getUser);
router.patch("/users/:id", validate(adminUpdateUserSchema), updateUser);
router.delete("/users/:id", validate(adminUserIdSchema), deleteUser);

router.get("/feedback", getAllFeedback);
router.get("/feedback/:id", validate(feedbackIdSchema), getAnyFeedback);
router.delete("/feedback/:id", validate(feedbackIdSchema), deleteAnyFeedback);

export default router;
