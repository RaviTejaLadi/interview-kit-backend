/**
 * Feedback form rules.
 * Checked before a submission is saved, and before an id is used to load one item.
 */
import { z } from "zod";

// The short subject of the form.
const titleSchema = z
  .string()
  .trim()
  .min(3, "Title must be at least 3 characters")
  .max(60, "Title cannot exceed 60 characters");

// The longer note. A one-character note is rejected.
const descriptionSchema = z
  .string()
  .trim()
  .min(2, "Description must be at least 2 characters long")
  .max(250, "Description cannot exceed 250 characters");

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
      .string()
      .regex(/^[a-fA-F0-9]{24}$/, "Invalid feedback id"),
  }),
});
