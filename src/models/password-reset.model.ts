/**
 * One password-reset attempt per email.
 * The code and the later reset token are stored only as hashes.
 * A missing account still gets a row so repeated requests can be slowed down
 * without telling the caller whether that email is registered.
 */
import mongoose, { Document, Schema } from "mongoose";

export interface IPasswordReset extends Document {
  email: string;
  otpHash?: string | null;
  otpExpiresAt?: Date | null;
  attempts: number;
  lastSentAt?: Date | null;
  resetTokenHash?: string | null;
  resetTokenExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const passwordResetSchema = new Schema<IPasswordReset>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    otpHash: {
      type: String,
      default: null,
    },
    otpExpiresAt: {
      type: Date,
      default: null,
    },
    // Wrong codes against the current OTP. A new code sets this back to zero.
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastSentAt: {
      type: Date,
      default: null,
    },
    resetTokenHash: {
      type: String,
      default: null,
    },
    resetTokenExpiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const PasswordReset =
  (mongoose.models.PasswordReset as mongoose.Model<IPasswordReset>) ||
  mongoose.model<IPasswordReset>("PasswordReset", passwordResetSchema);
