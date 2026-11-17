/**
 * Feedback form rules.
 * Checked before a submission is saved, and before an id is used to load one item.
 * Admins may also update moderation status on any item.
 */
import { z } from "zod";
import { FEEDBACK_STATUSES } from "../models/feedback.model";

// The short subject of the form.
const titleSchema = z
  .string({
    required_error: "Title is required.",
    invalid_type_error: "Title must be text.",
  })
  .trim()
  .min(3, "Title must be at least 3 characters.")
  .max(60, "Title cannot exceed 60 characters.");

// The longer note. A one-character note is rejected.
const descriptionSchema = z
  .string({
    required_error: "Description is required.",
    invalid_type_error: "Description must be text.",
  })
  .trim()
  .min(2, "Description must be at least 2 characters.")
  .max(250, "Description cannot exceed 250 characters.");

export const createFeedbackSchema = z.object({
  body: z.object({
    title: titleSchema,
    // A blank string becomes undefined so the length check still applies to real text.
    description: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? undefined : value,
      descriptionSchema
    ),
  }),
});

// Mongo ids are 24 hex characters. This stops a bad id before the database query.
export const feedbackIdSchema = z.object({
  params: z.object({
    id: z
      .string({
        required_error: "Feedback id is required.",
        invalid_type_error: "Feedback id must be text.",
      })
      .regex(/^[a-fA-F0-9]{24}$/, "Please provide a valid feedback id."),
  }),
});

// Admin-only status change for feedback moderation.
export const adminUpdateFeedbackSchema = z.object({
  params: feedbackIdSchema.shape.params,
  body: z.object({
    status: z.enum(FEEDBACK_STATUSES, {
      errorMap: () => ({
        message: "Status must be open, in_progress, or resolved.",
      }),
    }),
  }),
});
