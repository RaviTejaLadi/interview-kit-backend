/**
 * User accounts.
 * This collection is the source of identity for the whole API.
 * Registration, login, profile edits, and admin user management all read and write it.
 * Passwords are stored only as a hash. The role decides who may use admin routes.
 */
import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  password: string;
  phoneNumber: string;
  dob: string;
  bio?: string;
  role: "user" | "admin";
  refreshToken?: string | null;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    // Profile names shown back to the client and editable by the user or an admin.
    firstName: {
      type: String,
      required: [true, "First Name is required"],
      trim: true,
      minlength: [3, "First Name must be at least 3 characters"],
      maxlength: [60, "First Name cannot exceed 60 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Last Name is required"],
      trim: true,
      minlength: [3, "Last Name must be at least 3 characters"],
      maxlength: [60, "Last Name cannot exceed 60 characters"],
    },
    userName: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [60, "Name cannot exceed 60 characters"],
    },
    // Login identifier. Unique so two accounts cannot share an email.
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // select: false keeps the hash out of normal queries. Login asks for it explicitly.
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone Number is required"],
      match: [/^[6-9]\d{9}$/, "Please enter a valid 10-digit phone number"],
    },
    // Stored as text in YYYY-MM-DD so the profile form does not depend on time zones.
    dob: {
      type: String,
      required: [true, "Date of birth is required"],
      trim: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format"],
    },
    // Optional short introduction. Registration does not require it.
    bio: {
      type: String,
      required: false,
      trim: true,
      minlength: [2, "Bio must be at least 2 characters long"],
      maxlength: [250, "Bio cannot exceed 250 characters"],
    },
    // "user" is the normal account. "admin" may manage every user and every feedback item.
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    // The current refresh token. Logout sets this to null so the old token stops working.
    refreshToken: {
      type: String,
      default: null,
      select: false,
    },
  },
  {
    // createdAt and updatedAt let clients show when an account changed.
    timestamps: true,
  },
);

// Hash only when the password is new or changed, so a profile save does not rehash it.
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Login and change-password use this instead of comparing plain text to the stored hash.
userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>("User", userSchema);
