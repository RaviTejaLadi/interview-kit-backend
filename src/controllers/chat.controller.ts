/**
 * Gemini chat actions.
 * A signed-in user starts conversations, continues them, and reads only their own.
 * Three limits apply: saved chats, messages inside one chat, and messages per UTC day.
 * The daily count is reserved before Gemini is called and given back if the call fails.
 */
import { Request, Response } from "express";
import { env } from "../config/env";
import { Chat, IChat, IChatMessage } from "../models/chat.model";
import { ChatUsage } from "../models/chat-usage.model";
import { generateGeminiReply } from "../services/gemini.service";
import { ApiError, asyncHandler } from "../utils/ApiError";
import { ResponseStatus, sendResponse } from "../types/http-response";

const utcDayKey = (date = new Date()): string => date.toISOString().slice(0, 10);

const titleFromMessage = (message: string): string => {
  const compact = message.replace(/\s+/g, " ").trim();
  return compact.length <= 60 ? compact : `${compact.slice(0, 57)}...`;
};

const toPublicMessage = (message: IChatMessage) => ({
  role: message.role,
  text: message.text,
  createdAt: message.createdAt,
});

const toPublicChat = (chat: IChat, includeMessages: boolean) => ({
  id: chat._id,
  title: chat.title,
  userMessageCount: chat.userMessageCount,
  messagesRemainingInChat: Math.max(0, env.GEMINI_MAX_MESSAGES_PER_CHAT - chat.userMessageCount),
  createdAt: chat.createdAt,
  updatedAt: chat.updatedAt,
  ...(includeMessages ? { messages: chat.messages.map(toPublicMessage) } : {}),
});

const usageSnapshot = (chatsUsed: number, messagesToday: number) => ({
  chatsUsed,
  chatsLimit: env.GEMINI_MAX_CHATS_PER_USER,
  chatsRemaining: Math.max(0, env.GEMINI_MAX_CHATS_PER_USER - chatsUsed),
  messagesToday,
  dailyMessageLimit: env.GEMINI_DAILY_MESSAGE_LIMIT,
  messagesRemainingToday: Math.max(0, env.GEMINI_DAILY_MESSAGE_LIMIT - messagesToday),
  messagesPerChatLimit: env.GEMINI_MAX_MESSAGES_PER_CHAT,
  maxMessageCharacters: env.GEMINI_MAX_MESSAGE_CHARS,
  // The daily counter uses UTC, so it resets at 00:00 UTC rather than local midnight.
  resetsAt: "00:00 UTC",
});

const readUsage = async (userId: string) => {
  const day = utcDayKey();
  const [chatsUsed, usage] = await Promise.all([
    Chat.countDocuments({ user: userId }),
    ChatUsage.findOne({ user: userId, day }),
  ]);
  return {
    day,
    chatsUsed,
    messagesToday: usage?.count ?? 0,
  };
};

// Holds one daily slot before the external call. A failed reply gives the slot back.
const isDuplicateKey = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: number }).code === 11000;

const reserveDailyMessage = async (userId: string): Promise<string> => {
  const day = utcDayKey();
  try {
    // Creates today's row at zero when this is the account's first message of the day.
    await ChatUsage.updateOne(
      { user: userId, day },
      { $setOnInsert: { user: userId, day, count: 0 } },
      { upsert: true }
    );
  } catch (error) {
    // Two first messages at the same moment can both try to insert that row.
    if (!isDuplicateKey(error)) throw error;
  }

  const reserved = await ChatUsage.findOneAndUpdate(
    { user: userId, day, count: { $lt: env.GEMINI_DAILY_MESSAGE_LIMIT } },
    { $inc: { count: 1 } },
    { new: true }
  );

  if (!reserved) {
    throw new ApiError(
      429,
      `You have reached today's limit of ${env.GEMINI_DAILY_MESSAGE_LIMIT} messages. The allowance resets at 00:00 UTC.`
    );
  }

  return day;
};

const releaseDailyMessage = async (userId: string, day: string) => {
  await ChatUsage.updateOne(
    { user: userId, day, count: { $gt: 0 } },
    { $inc: { count: -1 } }
  );
};

const assertChatSlotAvailable = (chatsUsed: number) => {
  if (chatsUsed >= env.GEMINI_MAX_CHATS_PER_USER) {
    throw new ApiError(
      429,
      `You can keep up to ${env.GEMINI_MAX_CHATS_PER_USER} chats. Delete one before starting another.`
    );
  }
};

const assertChatHasRoom = (userMessageCount: number) => {
  if (userMessageCount >= env.GEMINI_MAX_MESSAGES_PER_CHAT) {
    throw new ApiError(
      429,
      `This chat has reached the limit of ${env.GEMINI_MAX_MESSAGES_PER_CHAT} messages. Start a new chat to continue.`
    );
  }
};

const pairMessages = (userText: string, modelText: string): IChatMessage[] => {
  const now = new Date();
  return [
    { role: "user", text: userText, createdAt: now },
    { role: "model", text: modelText, createdAt: new Date(now.getTime() + 1) },
  ];
};

// Shows the caller's remaining chats and today's remaining messages.
// GET /api/v1/chat/usage
export const getChatUsage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "Please log in to continue.");
  }

  const usage = await readUsage(req.user.userId);
  sendResponse(res, 200, {
    data: {
      usage: usageSnapshot(usage.chatsUsed, usage.messagesToday),
    },
    status: ResponseStatus.SUCCESS,
    message: "Your chat limits have been retrieved successfully.",
  });
});

// Newest activity first. The list omits transcripts so it stays small.
// GET /api/v1/chat
export const listChats = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "Please log in to continue.");
  }

  const [chats, usage] = await Promise.all([
    Chat.find({ user: req.user.userId }).sort({ updatedAt: -1 }),
    readUsage(req.user.userId),
  ]);

  sendResponse(res, 200, {
    data: {
      chats: chats.map((chat) => toPublicChat(chat, false)),
      usage: usageSnapshot(usage.chatsUsed, usage.messagesToday),
    },
    status: ResponseStatus.SUCCESS,
    message: "Chats have been retrieved successfully.",
  });
});

// Opens a conversation with the first user message and the model reply.
// POST /api/v1/chat
export const createChat = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "Please log in to continue.");
  }

  const message = String(req.body.message).trim();
  const usage = await readUsage(req.user.userId);
  assertChatSlotAvailable(usage.chatsUsed);

  const day = await reserveDailyMessage(req.user.userId);
  let reply: string;
  try {
    reply = await generateGeminiReply([{ role: "user", text: message }]);
  } catch (error) {
    await releaseDailyMessage(req.user.userId, day);
    throw error;
  }

  let chat: IChat;
  try {
    chat = await Chat.create({
      user: req.user.userId,
      title: titleFromMessage(message),
      messages: pairMessages(message, reply),
      userMessageCount: 1,
    });
  } catch (error) {
    await releaseDailyMessage(req.user.userId, day);
    throw error;
  }

  const after = await readUsage(req.user.userId);
  sendResponse(res, 201, {
    data: {
      chat: toPublicChat(chat, true),
      reply,
      usage: usageSnapshot(after.chatsUsed, after.messagesToday),
    },
    status: ResponseStatus.SUCCESS,
    message: "Your chat has been started.",
  });
});

// Full transcript for one chat the caller owns.
// GET /api/v1/chat/:id
export const getChat = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.chat) {
    throw new ApiError(401, "Please log in to continue.");
  }

  const usage = await readUsage(req.user.userId);
  sendResponse(res, 200, {
    data: {
      chat: toPublicChat(req.chat, true),
      usage: usageSnapshot(usage.chatsUsed, usage.messagesToday),
    },
    status: ResponseStatus.SUCCESS,
    message: "The chat has been retrieved successfully.",
  });
});

// Adds one user turn and the model reply to an existing chat.
// POST /api/v1/chat/:id/messages
export const sendChatMessage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.chat) {
    throw new ApiError(401, "Please log in to continue.");
  }

  const message = String(req.body.message).trim();
  assertChatHasRoom(req.chat.userMessageCount);

  const day = await reserveDailyMessage(req.user.userId);
  let reply: string;
  try {
    reply = await generateGeminiReply([
      ...req.chat.messages.map((item) => ({ role: item.role, text: item.text })),
      { role: "user", text: message },
    ]);
  } catch (error) {
    await releaseDailyMessage(req.user.userId, day);
    throw error;
  }

  let updated: IChat | null;
  try {
    updated = await Chat.findOneAndUpdate(
      {
        _id: req.chat._id,
        user: req.user.userId,
        userMessageCount: { $lt: env.GEMINI_MAX_MESSAGES_PER_CHAT },
      },
      {
        $push: { messages: { $each: pairMessages(message, reply) } },
        $inc: { userMessageCount: 1 },
      },
      { new: true }
    );
  } catch (error) {
    await releaseDailyMessage(req.user.userId, day);
    throw error;
  }

  if (!updated) {
    await releaseDailyMessage(req.user.userId, day);
    throw new ApiError(
      429,
      `This chat has reached the limit of ${env.GEMINI_MAX_MESSAGES_PER_CHAT} messages. Start a new chat to continue.`
    );
  }

  const usage = await readUsage(req.user.userId);
  sendResponse(res, 200, {
    data: {
      chat: toPublicChat(updated, true),
      reply,
      usage: usageSnapshot(usage.chatsUsed, usage.messagesToday),
    },
    status: ResponseStatus.SUCCESS,
    message: "The reply has been added to this chat.",
  });
});

// Removes one conversation. This frees a saved-chat slot and does not refund today's messages.
// DELETE /api/v1/chat/:id
export const deleteChat = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.chat) {
    throw new ApiError(401, "Please log in to continue.");
  }

  await req.chat.deleteOne();
  const usage = await readUsage(req.user.userId);

  sendResponse(res, 200, {
    data: {
      usage: usageSnapshot(usage.chatsUsed, usage.messagesToday),
    },
    status: ResponseStatus.SUCCESS,
    message: "The chat has been deleted successfully.",
  });
});
