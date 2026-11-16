/**
 * Chat request rules.
 * A message is checked before a chat is created or continued.
 * An id is checked before a chat is loaded.
 */
import { z } from "zod";
import { env } from "../config/env";

const messageSchema = z
  .string({
    required_error: "A message is required.",
    invalid_type_error: "A message must be text.",
  })
  .trim()
  .min(1, "A message is required.")
  .max(
    env.GEMINI_MAX_MESSAGE_CHARS,
    `A message cannot exceed ${env.GEMINI_MAX_MESSAGE_CHARS} characters.`
  );

const chatIdField = z
  .string({
    required_error: "Chat id is required.",
    invalid_type_error: "Chat id must be text.",
  })
  .regex(/^[a-fA-F0-9]{24}$/, "Please provide a valid chat id.");

export const createChatSchema = z.object({
  body: z.object({
    message: messageSchema,
  }),
});

export const chatIdSchema = z.object({
  params: z.object({
    id: chatIdField,
  }),
});

export const sendChatMessageSchema = z.object({
  body: z.object({
    message: messageSchema,
  }),
  params: z.object({
    id: chatIdField,
  }),
});
