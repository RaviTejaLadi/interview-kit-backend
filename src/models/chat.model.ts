/**
 * Saved Gemini conversations.
 * Each document belongs to one account. The messages array is the transcript
 * sent back to Gemini on the next turn, so the role order stays user then model.
 * userMessageCount is what the per-chat limit checks, separate from the daily counter.
 */
import mongoose, { Document, Schema } from "mongoose";

export type ChatRole = "user" | "model";

export interface IChatMessage {
  role: ChatRole;
  text: string;
  createdAt: Date;
}

export interface IChat extends Document {
  user: mongoose.Types.ObjectId;
  title: string;
  messages: IChatMessage[];
  userMessageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IChatMessage>(
  {
    // Gemini accepts "user" and "model". Keeping those names avoids a translation step.
    role: {
      type: String,
      enum: ["user", "model"],
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: [20000, "A stored message cannot exceed 20000 characters"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const chatSchema = new Schema<IChat>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    // Taken from the first user message so a list can show a label without opening the chat.
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [80, "Title cannot exceed 80 characters"],
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
    // Counts only the user's turns. A model reply does not spend the per-chat allowance.
    userMessageCount: {
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

// List queries filter by owner and sort by the last turn.
chatSchema.index({ user: 1, updatedAt: -1 });

export const Chat =
  (mongoose.models.Chat as mongoose.Model<IChat>) ||
  mongoose.model<IChat>("Chat", chatSchema);
