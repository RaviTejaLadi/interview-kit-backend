import { Request, Response } from "express";
import { setTokenCookies, toPublicUser } from "./auth.controller";
import { toPublicFeedback } from "./feedback.controller";
import Feedback from "../models/feedback.model";
import { User } from "../models/user.model";
import { ApiError, asyncHandler } from "../utils/ApiError";
import { JwtPayload, signAccessToken, signRefreshToken } from "../utils/jwt";

/**
 * Admin actions.
 * These exist so one trusted account can see and change every user and every feedback item.
 * Normal registration cannot set role to admin. This controller is the only place that does.
 */

// Creates an admin. The first one can be created with no login.
// After that, only an existing admin can create another, so the route cannot stay open.
// POST /api/v1/admin/register
export const createAdmin = asyncHandler(async (req: Request, res: Response) => {
  const adminExists = Boolean(await User.exists({ role: "admin" }));
  if (adminExists && req.user?.role !== "admin") {
    throw new ApiError(403, "Only an admin can create another admin");
  }

  const { firstName, lastName, userName, email, password, phoneNumber, dob, bio } =
    req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, "Email is already registered");
  }

  const user = await User.create({
    firstName,
    lastName,
    userName,
    email,
    password,
    phoneNumber,
    dob,
    bio,
    role: "admin",
  });

  // The first admin has nobody to log them in, so this response includes a session.
  if (!adminExists) {
    const payload: JwtPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    setTokenCookies(res, accessToken, refreshToken);

    res.status(201).json({
      success: true,
      message: "Admin account created successfully",
      data: {
        user: toPublicUser(user),
        accessToken,
        refreshToken,
      },
    });
    return;
  }

  // A later admin is created by someone who is already logged in, so no new session is issued.
  res.status(201).json({
    success: true,
    message: "Admin account created successfully",
    data: {
      user: toPublicUser(user),
    },
  });
});

// The full account list. Passwords stay hidden because toPublicUser omits them.
// GET /api/v1/admin/users
export const getUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await User.find().sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: {
      users: users.map(toPublicUser),
    },
  });
});

// One account by id, including accounts the admin does not own.
// GET /api/v1/admin/users/:id
export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.status(200).json({
    success: true,
    data: {
      user: toPublicUser(user),
    },
  });
});

// Changes any profile field and can promote or demote a role.
// PATCH /api/v1/admin/users/:id
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { firstName, lastName, userName, phoneNumber, dob, bio, role } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Keep at least one admin so the project cannot lose every account that can manage it.
  if (role === "user" && user.role === "admin") {
    const adminCount = await User.countDocuments({ role: "admin" });
    if (adminCount <= 1) {
      throw new ApiError(400, "At least one admin is required");
    }
  }

  const updates = Object.fromEntries(
    Object.entries({ firstName, lastName, userName, phoneNumber, dob, bio, role }).filter(
      ([, value]) => value !== undefined
    )
  );

  const updatedUser = await User.findByIdAndUpdate(user._id, updates, {
    new: true,
    runValidators: true,
  });

  if (!updatedUser) {
    throw new ApiError(404, "User not found");
  }

  res.status(200).json({
    success: true,
    message: "User updated successfully",
    data: {
      user: toPublicUser(updatedUser),
    },
  });
});

// Removes another account and the feedback that belongs to it.
// DELETE /api/v1/admin/users/:id
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // An admin must not lock themselves out by deleting the account they are using.
  if (user._id.toString() === req.user?.userId) {
    throw new ApiError(400, "You cannot delete your own account");
  }

  if (user.role === "admin") {
    const adminCount = await User.countDocuments({ role: "admin" });
    if (adminCount <= 1) {
      throw new ApiError(400, "At least one admin is required");
    }
  }

  // Feedback stores a user id. Delete those notes so they do not point at a missing account.
  await Feedback.deleteMany({ user: user._id });
  await user.deleteOne();

  res.status(200).json({
    success: true,
    message: "User deleted successfully",
  });
});

// Every feedback submission, not only the ones this admin wrote.
// GET /api/v1/admin/feedback
export const getAllFeedback = asyncHandler(async (_req: Request, res: Response) => {
  const feedbacks = await Feedback.find().sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: {
      feedbacks: feedbacks.map(toPublicFeedback),
    },
  });
});

// Reads one submission without the owner check used by the user feedback route.
// GET /api/v1/admin/feedback/:id
export const getAnyFeedback = asyncHandler(async (req: Request, res: Response) => {
  const feedback = await Feedback.findById(req.params.id);
  if (!feedback) {
    throw new ApiError(404, "Feedback not found");
  }

  res.status(200).json({
    success: true,
    data: {
      feedback: toPublicFeedback(feedback),
    },
  });
});

// Removes any submission, including one written by another user.
// DELETE /api/v1/admin/feedback/:id
export const deleteAnyFeedback = asyncHandler(async (req: Request, res: Response) => {
  const feedback = await Feedback.findById(req.params.id);
  if (!feedback) {
    throw new ApiError(404, "Feedback not found");
  }

  await feedback.deleteOne();

  res.status(200).json({
    success: true,
    message: "Feedback deleted successfully",
  });
});
