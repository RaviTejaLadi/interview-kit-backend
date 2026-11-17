/**
 * Progress routes at /api/v1/progress.
 * Every route requires login. The caller only reads and writes their own maps.
 */
import { Router } from "express";
import {
  batchTopicProgress,
  getProgress,
  syncProgress,
  upsertGuideProgress,
  upsertTopicProgress,
} from "../controllers/progress.controller";
import { protect } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  batchTopicProgressSchema,
  syncProgressSchema,
  upsertGuideProgressSchema,
  upsertTopicProgressSchema,
} from "../schemas/progress.schema";

const router = Router();

router.use(protect);

router.get("/", getProgress);
router.put("/sync", validate(syncProgressSchema), syncProgress);
router.put("/topics/batch", validate(batchTopicProgressSchema), batchTopicProgress);
router.put("/topics", validate(upsertTopicProgressSchema), upsertTopicProgress);
router.put("/guides", validate(upsertGuideProgressSchema), upsertGuideProgress);

export default router;
