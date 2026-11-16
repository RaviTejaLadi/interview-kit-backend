/**
 * Loads one feedback item for the user routes.
 * The owner may open or delete their own submission.
 * An admin may open or delete any submission.
 * The controller then uses req.feedback instead of querying again.
 */
import { NextFunction, Request, Response } from "express";
import Feedback from "../models/feedback.model";
import { ApiError, asyncHandler } from "../utils/ApiError";

export const loadFeedback = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) {
      throw new ApiError(404, "The requested feedback could not be found.");
    }

    const isOwner = feedback.user.toString() === req.user?.userId;
    const isAdmin = req.user?.role === "admin";
    if (!isOwner && !isAdmin) {
      throw new ApiError(403, "You do not have permission to access this feedback.");
    }

    req.feedback = feedback;
    next();
  }
);
