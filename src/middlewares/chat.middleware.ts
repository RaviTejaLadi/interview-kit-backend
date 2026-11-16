/**
 * Loads one chat for the signed-in owner.
 * Chats stay private to the account that started them.
 * The controller then uses req.chat instead of querying again.
 */
import { NextFunction, Request, Response } from "express";
import { Chat } from "../models/chat.model";
import { ApiError, asyncHandler } from "../utils/ApiError";

export const loadChat = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, "Please log in to continue.");
    }

    const chat = await Chat.findOne({ _id: req.params.id, user: req.user.userId });
    if (!chat) {
      throw new ApiError(404, "The requested chat could not be found.");
    }

    req.chat = chat;
    next();
  }
);
