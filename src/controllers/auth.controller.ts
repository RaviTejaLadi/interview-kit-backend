import { Request, Response } from "express";
import { IUser, User } from "../models/user.model";
import { ApiError, asyncHandler } from "../utils/ApiError";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  JwtPayload,
} from "../utils/jwt";
import { env } from "../config/env";

const toPublicUser = (user: IUser) => ({
  id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  userName: user.userName,
  email: user.email,
  phoneNumber: user.phoneNumber,
  dob: user.dob,
  bio: user.bio ?? null,
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const setTokenCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
) => {
  const isProd = env.NODE_ENV === "production";

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

// POST /api/v1/auth/register
export const register = asyncHandler(async (req: Request, res: Response) => {
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
  });

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
    message: "User registered successfully",
    data: {
      user: toPublicUser(user),
      accessToken,
      refreshToken,
    },
  });
});

// POST /api/v1/auth/login
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, "Invalid email or password");
  }

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

  res.status(200).json({
    success: true,
    message: "Logged in successfully",
    data: {
      user: toPublicUser(user),
      accessToken,
      refreshToken,
    },
  });
});

// GET /api/v1/auth/me
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user?.userId);
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

// PATCH /api/v1/auth/me
export const updateProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const { firstName, lastName, userName, phoneNumber, dob, bio } = req.body;
    const updates = Object.fromEntries(
      Object.entries({ firstName, lastName, userName, phoneNumber, dob, bio }).filter(
        ([, value]) => value !== undefined
      )
    );

    const user = await User.findByIdAndUpdate(req.user?.userId, updates, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: toPublicUser(user),
      },
    });
  }
);

// PUT /api/v1/auth/change-password
export const changePassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user?.userId).select("+password");
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new ApiError(401, "Current password is incorrect");
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  }
);

// POST /api/v1/auth/refresh
export const refreshAccessToken = asyncHandler(
  async (req: Request, res: Response) => {
    const incomingRefreshToken =
      req.body.refreshToken || req.cookies?.refreshToken;

    if (!incomingRefreshToken) {
      throw new ApiError(401, "Refresh token is required");
    }

    let decoded: JwtPayload;
    try {
      decoded = verifyRefreshToken(incomingRefreshToken);
    } catch {
      throw new ApiError(401, "Invalid or expired refresh token");
    }

    const user = await User.findById(decoded.userId).select("+refreshToken");
    if (!user || user.refreshToken !== incomingRefreshToken) {
      throw new ApiError(401, "Refresh token is revoked or invalid");
    }

    const payload: JwtPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken(payload);

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    setTokenCookies(res, newAccessToken, newRefreshToken);

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  }
);

// POST /api/v1/auth/logout
export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.userId) {
    await User.findByIdAndUpdate(req.user.userId, { refreshToken: null });
  }

  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});
