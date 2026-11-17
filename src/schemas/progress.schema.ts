/**
 * Progress payload rules.
 * Topic and guide ids are free-form content ids from the frontend catalog,
 * not Mongo object ids, so path params are avoided and ids travel in the body.
 */
import { z } from "zod";

const progressIdSchema = z
  .string({
    required_error: "Progress id is required.",
    invalid_type_error: "Progress id must be text.",
  })
  .trim()
  .min(1, "Progress id is required.")
  .max(500, "Progress id is too long.");

const booleanFlagSchema = z.boolean({
  invalid_type_error: "Flag must be true or false.",
});

const topicEntrySchema = z
  .object({
    completed: booleanFlagSchema.optional(),
    important: booleanFlagSchema.optional(),
  })
  .refine(
    (value) => value.completed !== undefined || value.important !== undefined,
    "Provide completed and/or important."
  );

const guideEntrySchema = z
  .object({
    read: booleanFlagSchema.optional(),
    starred: booleanFlagSchema.optional(),
  })
  .refine(
    (value) => value.read !== undefined || value.starred !== undefined,
    "Provide read and/or starred."
  );

export const upsertTopicProgressSchema = z.object({
  body: z
    .object({
      id: progressIdSchema,
      completed: booleanFlagSchema.optional(),
      important: booleanFlagSchema.optional(),
    })
    .refine(
      (value) => value.completed !== undefined || value.important !== undefined,
      "Provide completed and/or important."
    ),
});

export const batchTopicProgressSchema = z.object({
  body: z
    .object({
      ids: z
        .array(progressIdSchema)
        .min(1, "Provide at least one topic id.")
        .max(500, "Too many topic ids in one request."),
      completed: booleanFlagSchema.optional(),
      important: booleanFlagSchema.optional(),
    })
    .refine(
      (value) => value.completed !== undefined || value.important !== undefined,
      "Provide completed and/or important."
    ),
});

export const upsertGuideProgressSchema = z.object({
  body: z
    .object({
      id: progressIdSchema,
      read: booleanFlagSchema.optional(),
      starred: booleanFlagSchema.optional(),
    })
    .refine(
      (value) => value.read !== undefined || value.starred !== undefined,
      "Provide read and/or starred."
    ),
});

const topicMapSchema = z.record(
  z.string().trim().min(1).max(500),
  z.object({
    completed: booleanFlagSchema,
    important: booleanFlagSchema,
  })
);

const guideMapSchema = z.record(
  z.string().trim().min(1).max(500),
  z.object({
    read: booleanFlagSchema,
    starred: booleanFlagSchema,
  })
);

export const syncProgressSchema = z.object({
  body: z
    .object({
      topics: topicMapSchema.optional(),
      guides: guideMapSchema.optional(),
    })
    .refine(
      (value) => value.topics !== undefined || value.guides !== undefined,
      "Provide topics and/or guides to sync."
    ),
});

export type TopicEntryPatch = z.infer<typeof topicEntrySchema>;
export type GuideEntryPatch = z.infer<typeof guideEntrySchema>;
