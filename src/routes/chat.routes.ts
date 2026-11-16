/**
 * Gemini chat routes at /api/v1/chat.
 * Every route requires login. A user can open only the chats they started.
 * /usage is registered before /:id so the word "usage" is not treated as a chat id.
 */
import { Router } from "express";
import {
  createChat,
  deleteChat,
  getChat,
  getChatUsage,
  listChats,
  sendChatMessage,
} from "../controllers/chat.controller";
import { protect } from "../middlewares/auth.middleware";
import { loadChat } from "../middlewares/chat.middleware";
import { validate } from "../middlewares/validate.middleware";
import { chatIdSchema, createChatSchema, sendChatMessageSchema } from "../schemas/chat.schema";

const router = Router();

router.use(protect);

router.get("/usage", getChatUsage);
router.get("/", listChats);
router.post("/", validate(createChatSchema), createChat);
router.get("/:id", validate(chatIdSchema), loadChat, getChat);
router.delete("/:id", validate(chatIdSchema), loadChat, deleteChat);
router.post("/:id/messages", validate(sendChatMessageSchema), loadChat, sendChatMessage);

export default router;
