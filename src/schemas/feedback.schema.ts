import { z } from "zod";

const titleSchema = z
  .string()
  .trim()
  .min(3, "Title must be at least 3 characters")
  .max(60, "Title cannot exceed 60 characters");

const descriptionSchema = z
  .string()
  .trim()
  .min(2, "Description must be at least 2 characters long")
  .max(250, "Description cannot exceed 250 characters");

export const createFeedbackSchema = z.object({
  body: z.object({
    title: titleSchema,
    description: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? undefined : value,
      descriptionSchema
    ),
  }),
});

export const feedbackIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(/^[a-fA-F0-9]{24}$/, "Invalid feedback id"),
  }),
});
