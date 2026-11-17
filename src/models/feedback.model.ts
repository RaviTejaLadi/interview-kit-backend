/**
 * Feedback submissions.
 * A logged-in user sends a title and description. The user id records who wrote it,
 * so a person can see their own items and an admin can see every item.
 * Admins can move status between open, in_progress, and resolved.
 */
import mongoose, { Document, Schema } from "mongoose";

export const FEEDBACK_STATUSES = ["open", "in_progress", "resolved"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export interface IFeedback extends Document {
  user: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  status: FeedbackStatus;
  createdAt: Date;
  updatedAt: Date;
}

const feedbackSchema = new Schema<IFeedback>(
  {
    // Link back to the account. Indexed because lists are filtered by this field.
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      index: true,
    },

    // Short subject shown in a feedback list.
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [3, "Title must be at least 3 characters"],
      maxlength: [60, "Title cannot exceed 60 characters"],
    },

    // Longer note. Empty is allowed here; a real note must be at least 2 characters.
    description: {
      type: String,
      trim: true,
      maxlength: [250, "Description cannot exceed 250 characters"],
      validate: {
        validator(value: string | null | undefined) {
          if (value == null || value === "") return true;
          return value.length >= 2;
        },
        message: "Description must be at least 2 characters",
      },
    },

    // Moderation state. New submissions start open until an admin updates them.
    status: {
      type: String,
      enum: {
        values: FEEDBACK_STATUSES,
        message: "Status must be open, in_progress, or resolved.",
      },
      default: "open",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Reuse the compiled model during nodemon reloads, which import this file again.
const Feedback =
  mongoose.models.Feedback ||
  mongoose.model<IFeedback>("Feedback", feedbackSchema);

export default Feedback;
