/**
 * Daily chat allowance.
 * One row per account per UTC day. Deleting a chat does not lower this count,
 * so removing a conversation cannot be used to send more messages the same day.
 */
import mongoose, { Document, Schema } from "mongoose";

export interface IChatUsage extends Document {
  user: mongoose.Types.ObjectId;
  day: string;
  count: number;
  createdAt: Date;
  updatedAt: Date;
}

const chatUsageSchema = new Schema<IChatUsage>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // UTC calendar day, YYYY-MM-DD. The next day starts a new row and a fresh allowance.
    day: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Day must be YYYY-MM-DD"],
    },
    count: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

chatUsageSchema.index({ user: 1, day: 1 }, { unique: true });

export const ChatUsage =
  (mongoose.models.ChatUsage as mongoose.Model<IChatUsage>) ||
  mongoose.model<IChatUsage>("ChatUsage", chatUsageSchema);
