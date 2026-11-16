import { NextFunction, Request, Response } from "express";
import Feedback from "../models/feedback.model";
import { ApiError, asyncHandler } from "../utils/ApiError";

export const loadFeedback = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) {
      throw new ApiError(404, "Feedback not found");
    }

    const isOwner = feedback.user.toString() === req.user?.userId;
    const isAdmin = req.user?.role === "admin";
    if (!isOwner && !isAdmin) {
      throw new ApiError(403, "You do not have permission to access this feedback");
    }

    req.feedback = feedback;
    next();
  }
);
