import { Router } from "express";
import {
  createFeedback,
  deleteFeedback,
  getFeedback,
  getFeedbacks,
} from "../controllers/feedback.controller";
import { protect } from "../middlewares/auth.middleware";
import { loadFeedback } from "../middlewares/feedback.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createFeedbackSchema,
  feedbackIdSchema,
} from "../schemas/feedback.schema";

const router = Router();

router.use(protect);

router.post("/", validate(createFeedbackSchema), createFeedback);
router.get("/", getFeedbacks);
router.get("/:id", validate(feedbackIdSchema), loadFeedback, getFeedback);
router.delete("/:id", validate(feedbackIdSchema), loadFeedback, deleteFeedback);

export default router;
