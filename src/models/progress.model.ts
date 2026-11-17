/**
 * Per-account study progress.
 * Topics track completed/important. Guides track read/starred.
 * Keys are the same string ids the frontend uses in local storage.
 */
import mongoose, { Document, Schema } from "mongoose";

export type TopicProgressEntry = {
  completed: boolean;
  important: boolean;
};

export type GuideProgressEntry = {
  read: boolean;
  starred: boolean;
};

export interface IProgress extends Document {
  user: mongoose.Types.ObjectId;
  topics: Record<string, TopicProgressEntry>;
  guides: Record<string, GuideProgressEntry>;
  createdAt: Date;
  updatedAt: Date;
}

const progressSchema = new Schema<IProgress>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      unique: true,
      index: true,
    },
    topics: {
      type: Schema.Types.Mixed,
      default: {},
    },
    guides: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const Progress =
  mongoose.models.Progress ||
  mongoose.model<IProgress>("Progress", progressSchema);

export default Progress;
