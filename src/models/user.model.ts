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
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
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
    dob: {
      type: String,
      required: [true, "Date of birth is required"],
      trim: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format"],
    },
    bio: {
      type: String,
      required: false,
      trim: true,
      minlength: [2, "Bio must be at least 2 characters long"],
      maxlength: [250, "Bio cannot exceed 250 characters"],
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    refreshToken: {
      type: String,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
  },
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare candidate password with stored hash
userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>("User", userSchema);
