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

/**
 * Account actions.
 * These create and maintain a login. Admin code reuses toPublicUser and
 * setTokenCookies so user responses and cookies stay in one shape.
 */

// Password and refresh token stay out of API responses.
export const toPublicUser = (user: IUser) => ({
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

// Cookies let a browser stay logged in. Bruno can ignore them and use the JSON tokens.
export const setTokenCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
) => {
  const isProd = env.NODE_ENV === "production";

  res.cookie("accessToken", accessToken, {
    httpOnly: true, // JavaScript on the page cannot read the token.
    secure: isProd, // Production sends the cookie only over HTTPS.
    sameSite: isProd ? "strict" : "lax", // Limits when the browser attaches the cookie.
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matching the longer refresh lifetime.
  });
};

// Creates a normal user and logs them in. Role stays the model default, "user".
// POST /api/v1/auth/register
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { firstName, lastName, userName, email, password, phoneNumber, dob, bio } =
    req.body;

  // One email can belong to only one account.
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
  // The password was already hashed on create. Skip validators so this token save cannot fail them.
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

// Checks email and password, then replaces the stored refresh token with a new session.
// POST /api/v1/auth/login
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Password is hidden by default, so login must ask for it.
  const user = await User.findOne({ email }).select("+password");
  // The same message for a missing user and a bad password avoids revealing which emails exist.
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

// Returns the account for the token, so the client can show the logged-in profile.
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

// Edits only the caller's profile. Role and email are left out so this route cannot grant admin.
// PATCH /api/v1/auth/me
export const updateProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const { firstName, lastName, userName, phoneNumber, dob, bio } = req.body;
    // Drop fields the client did not send, so omitted values are not written as empty.
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

// Requires the current password, then save() runs the hash hook on the new one.
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

// Issues a new access token without asking for the password again.
// The stored refresh token must match, so logout and a newer login invalidate the old one.
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
    // A valid signature is not enough. It must still be the token saved for this user.
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

// Clears the saved refresh token and the browser cookies, ending the session.
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
