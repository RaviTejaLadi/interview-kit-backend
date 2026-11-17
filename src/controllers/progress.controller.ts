/**
 * Study progress actions.
 * A signed-in user reads and updates only their own topic/guide progress maps.
 */
import { Request, Response } from "express";
import Progress, {
  GuideProgressEntry,
  IProgress,
  TopicProgressEntry,
} from "../models/progress.model";
import { ApiError, asyncHandler } from "../utils/ApiError";
import { ResponseStatus, sendResponse } from "../types/http-response";

const EMPTY_TOPIC: TopicProgressEntry = { completed: false, important: false };
const EMPTY_GUIDE: GuideProgressEntry = { read: false, starred: false };

const sanitizeTopicMap = (value: unknown): Record<string, TopicProgressEntry> => {
  const cleaned: Record<string, TopicProgressEntry> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return cleaned;
  }

  for (const [topicId, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!topicId || !entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const maybe = entry as { completed?: unknown; important?: unknown };
    const completed = maybe.completed === true;
    const important = maybe.important === true;
    if (!completed && !important) {
      continue;
    }
    cleaned[topicId] = { completed, important };
  }

  return cleaned;
};

const sanitizeGuideMap = (value: unknown): Record<string, GuideProgressEntry> => {
  const cleaned: Record<string, GuideProgressEntry> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return cleaned;
  }

  for (const [guideId, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!guideId || !entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const maybe = entry as { read?: unknown; starred?: unknown };
    const read = maybe.read === true;
    const starred = maybe.starred === true;
    if (!read && !starred) {
      continue;
    }
    cleaned[guideId] = { read, starred };
  }

  return cleaned;
};

const toPublicProgress = (progress: IProgress) => ({
  topics: sanitizeTopicMap(progress.topics),
  guides: sanitizeGuideMap(progress.guides),
  updatedAt: progress.updatedAt,
});

const getOrCreateProgress = async (userId: string): Promise<IProgress> => {
  const existing = await Progress.findOne({ user: userId });
  if (existing) {
    return existing;
  }

  try {
    return await Progress.create({
      user: userId,
      topics: {},
      guides: {},
    });
  } catch (error) {
    // Two first requests can race on the unique user index.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      const raced = await Progress.findOne({ user: userId });
      if (raced) {
        return raced;
      }
    }
    throw error;
  }
};

const applyTopicPatch = (
  current: Record<string, TopicProgressEntry>,
  topicId: string,
  patch: { completed?: boolean; important?: boolean }
): Record<string, TopicProgressEntry> => {
  const existing = current[topicId] ?? EMPTY_TOPIC;
  const next: TopicProgressEntry = {
    completed: patch.completed ?? existing.completed,
    important: patch.important ?? existing.important,
  };

  if (next.completed === existing.completed && next.important === existing.important) {
    return current;
  }

  const updated = { ...current };
  if (!next.completed && !next.important) {
    delete updated[topicId];
    return updated;
  }

  updated[topicId] = next;
  return updated;
};

const applyGuidePatch = (
  current: Record<string, GuideProgressEntry>,
  guideId: string,
  patch: { read?: boolean; starred?: boolean }
): Record<string, GuideProgressEntry> => {
  const existing = current[guideId] ?? EMPTY_GUIDE;
  const next: GuideProgressEntry = {
    read: patch.read ?? existing.read,
    starred: patch.starred ?? existing.starred,
  };

  if (next.read === existing.read && next.starred === existing.starred) {
    return current;
  }

  const updated = { ...current };
  if (!next.read && !next.starred) {
    delete updated[guideId];
    return updated;
  }

  updated[guideId] = next;
  return updated;
};

const mergeTopicMaps = (
  base: Record<string, TopicProgressEntry>,
  incoming: Record<string, TopicProgressEntry>
) => {
  let next = { ...base };
  for (const [topicId, entry] of Object.entries(incoming)) {
    next = applyTopicPatch(next, topicId, {
      completed: Boolean(base[topicId]?.completed || entry.completed),
      important: Boolean(base[topicId]?.important || entry.important),
    });
  }
  return next;
};

const mergeGuideMaps = (
  base: Record<string, GuideProgressEntry>,
  incoming: Record<string, GuideProgressEntry>
) => {
  let next = { ...base };
  for (const [guideId, entry] of Object.entries(incoming)) {
    next = applyGuidePatch(next, guideId, {
      read: Boolean(base[guideId]?.read || entry.read),
      starred: Boolean(base[guideId]?.starred || entry.starred),
    });
  }
  return next;
};

// GET /api/v1/progress
export const getProgress = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "Please log in to continue.");
  }

  const progress = await getOrCreateProgress(req.user.userId);
  sendResponse(res, 200, {
    data: toPublicProgress(progress),
    status: ResponseStatus.SUCCESS,
    message: "Progress has been retrieved successfully.",
  });
});

// PUT /api/v1/progress/topics
export const upsertTopicProgress = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "Please log in to continue.");
  }

  const { id, completed, important } = req.body as {
    id: string;
    completed?: boolean;
    important?: boolean;
  };

  const progress = await getOrCreateProgress(req.user.userId);
  const topics = sanitizeTopicMap(progress.topics);
  progress.topics = applyTopicPatch(topics, id, { completed, important });
  progress.markModified("topics");
  await progress.save();

  sendResponse(res, 200, {
    data: toPublicProgress(progress),
    status: ResponseStatus.SUCCESS,
    message: "Topic progress has been saved.",
  });
});

// PUT /api/v1/progress/topics/batch
export const batchTopicProgress = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "Please log in to continue.");
  }

  const { ids, completed, important } = req.body as {
    ids: string[];
    completed?: boolean;
    important?: boolean;
  };

  const progress = await getOrCreateProgress(req.user.userId);
  let topics = sanitizeTopicMap(progress.topics);
  for (const id of ids) {
    topics = applyTopicPatch(topics, id, { completed, important });
  }
  progress.topics = topics;
  progress.markModified("topics");
  await progress.save();

  sendResponse(res, 200, {
    data: toPublicProgress(progress),
    status: ResponseStatus.SUCCESS,
    message: "Topic progress has been updated.",
  });
});

// PUT /api/v1/progress/guides
export const upsertGuideProgress = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "Please log in to continue.");
  }

  const { id, read, starred } = req.body as {
    id: string;
    read?: boolean;
    starred?: boolean;
  };

  const progress = await getOrCreateProgress(req.user.userId);
  const guides = sanitizeGuideMap(progress.guides);
  progress.guides = applyGuidePatch(guides, id, { read, starred });
  progress.markModified("guides");
  await progress.save();

  sendResponse(res, 200, {
    data: toPublicProgress(progress),
    status: ResponseStatus.SUCCESS,
    message: "Guide progress has been saved.",
  });
});

// PUT /api/v1/progress/sync
// Merges local maps into the account so browser progress is not lost after login.
export const syncProgress = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "Please log in to continue.");
  }

  const body = req.body as {
    topics?: Record<string, TopicProgressEntry>;
    guides?: Record<string, GuideProgressEntry>;
  };

  const progress = await getOrCreateProgress(req.user.userId);
  const currentTopics = sanitizeTopicMap(progress.topics);
  const currentGuides = sanitizeGuideMap(progress.guides);

  if (body.topics) {
    progress.topics = mergeTopicMaps(currentTopics, sanitizeTopicMap(body.topics));
    progress.markModified("topics");
  }
  if (body.guides) {
    progress.guides = mergeGuideMaps(currentGuides, sanitizeGuideMap(body.guides));
    progress.markModified("guides");
  }

  await progress.save();

  sendResponse(res, 200, {
    data: toPublicProgress(progress),
    status: ResponseStatus.SUCCESS,
    message: "Progress has been synced.",
  });
});
