import { Request, Response } from "express";
import Feedback, { IFeedback } from "../models/feedback.model";
import { ApiError, asyncHandler } from "../utils/ApiError";

/**
 * Feedback form actions.
 * A signed-in user creates and reads their own notes.
 * Admin list and delete-any live in the admin controller and reuse toPublicFeedback.
 */

// One response shape for a feedback item, used by both user and admin routes.
export const toPublicFeedback = (feedback: IFeedback) => ({
  id: feedback._id,
  user: feedback.user,
  title: feedback.title,
  description: feedback.description ?? null,
  createdAt: feedback.createdAt,
  updatedAt: feedback.updatedAt,
});

// Saves the form against the logged-in user, so the note has an owner.
// POST /api/v1/feedback
export const createFeedback = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required. Please log in.");
  }

  const feedback = await Feedback.create({
    user: req.user.userId,
    title: req.body.title,
    description: req.body.description,
  });

  res.status(201).json({
    success: true,
    message: "Feedback submitted successfully",
    data: {
      feedback: toPublicFeedback(feedback),
    },
  });
});

// A user sees only their notes. An admin sees the whole collection from this route too.
// GET /api/v1/feedback
export const getFeedbacks = asyncHandler(async (req: Request, res: Response) => {
  const filter = req.user?.role === "admin" ? {} : { user: req.user?.userId };
  const feedbacks = await Feedback.find(filter).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: {
      feedbacks: feedbacks.map(toPublicFeedback),
    },
  });
});

// req.feedback was loaded and permission-checked by loadFeedback.
// GET /api/v1/feedback/:id
export const getFeedback = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      feedback: toPublicFeedback(req.feedback as IFeedback),
    },
  });
});

// Removes the item loadFeedback already confirmed this caller may access.
// DELETE /api/v1/feedback/:id
export const deleteFeedback = asyncHandler(async (req: Request, res: Response) => {
  await req.feedback?.deleteOne();

  res.status(200).json({
    success: true,
    message: "Feedback deleted successfully",
  });
});
