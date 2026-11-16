/**
 * Feedback form routes at /api/v1/feedback.
 * Every route requires login. A user works with their own submissions.
 * loadFeedback also lets an admin open one item by id.
 */
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

// Applied to every route in this file.
router.use(protect);

// Submit the form.
router.post("/", validate(createFeedbackSchema), createFeedback);
// List the caller's items. An admin receives every item.
router.get("/", getFeedbacks);
// Read or delete one item after the id and ownership checks.
router.get("/:id", validate(feedbackIdSchema), loadFeedback, getFeedback);
router.delete("/:id", validate(feedbackIdSchema), loadFeedback, deleteFeedback);

export default router;
