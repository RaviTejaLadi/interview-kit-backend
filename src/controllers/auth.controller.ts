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
import { PasswordReset } from "../models/password-reset.model";
import { isMailConfigured, sendPasswordResetOtp } from "../services/mail.service";
import { ResponseStatus, sendResponse } from "../types/http-response";
import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  RESET_TOKEN_TTL_MS,
  generateOtp,
  generateResetToken,
  hashSecret,
  secretsMatch,
} from "../utils/otp";

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
  phoneNumber: user.phoneNumber ?? null,
  dob: user.dob ?? null,
  bio: user.bio ?? null,
  avatar: user.avatar ?? null,
  provider: user.provider ?? "local",
  google: Boolean(user.googleId),
  github: Boolean(user.githubId),
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
    // The site and this API are different hosts. Strict cookies are not sent on that cross-site login.
    sameSite: isProd ? "none" : "lax",
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
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
    throw new ApiError(409, "This email address is already registered. Please use a different email address.");
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

  sendResponse(res, 201, {
    data: {
      user: toPublicUser(user),
      accessToken,
      refreshToken,
    },
    status: ResponseStatus.SUCCESS,
    message: "Your account has been created and you are now logged in.",
  });
});

// Checks email and password, then replaces the stored refresh token with a new session.
// POST /api/v1/auth/login
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Password is hidden by default, so login must ask for it.
  const user = await User.findOne({ email }).select("+password");
  if (user && !user.password && (user.googleId || user.githubId)) {
    throw new ApiError(401, "This account uses Google or GitHub sign-in. Continue with that provider.");
  }
  // The same message for a missing user and a bad password avoids revealing which emails exist.
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, "The email or password you entered is incorrect.");
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

  sendResponse(res, 200, {
    data: {
      user: toPublicUser(user),
      accessToken,
      refreshToken,
    },
    status: ResponseStatus.SUCCESS,
    message: "You have logged in successfully.",
  });
});

// Returns the account for the token, so the client can show the logged-in profile.
// GET /api/v1/auth/me
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user?.userId);
  if (!user) {
    throw new ApiError(404, "The requested user could not be found.");
  }

  sendResponse(res, 200, {
    data: {
      user: toPublicUser(user),
    },
    status: ResponseStatus.SUCCESS,
    message: "Your profile has been retrieved successfully.",
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
      throw new ApiError(404, "The requested user could not be found.");
    }

    sendResponse(res, 200, {
      data: {
        user: toPublicUser(user),
      },
      status: ResponseStatus.SUCCESS,
      message: "Your profile has been updated successfully.",
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
      throw new ApiError(404, "The requested user could not be found.");
    }

    if (!user.password) {
      throw new ApiError(400, "This account uses Google or GitHub sign-in and does not have a password yet.");
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new ApiError(401, "The current password you entered is incorrect.");
    }

    user.password = newPassword;
    await user.save();

    sendResponse(res, 200, {
      data: null,
      status: ResponseStatus.SUCCESS,
      message: "Your password has been updated successfully.",
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
      throw new ApiError(401, "A refresh token is required to continue this session.");
    }

    let decoded: JwtPayload;
    try {
      decoded = verifyRefreshToken(incomingRefreshToken);
    } catch {
      throw new ApiError(401, "The refresh token is invalid or has expired. Please log in again.");
    }

    const user = await User.findById(decoded.userId).select("+refreshToken");
    // A valid signature is not enough. It must still be the token saved for this user.
    if (!user || user.refreshToken !== incomingRefreshToken) {
      throw new ApiError(401, "The refresh token is no longer valid. Please log in again.");
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

    sendResponse(res, 200, {
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
      status: ResponseStatus.SUCCESS,
      message: "Your session tokens have been refreshed successfully.",
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

  sendResponse(res, 200, {
    data: null,
    status: ResponseStatus.SUCCESS,
    message: "You have been logged out successfully.",
  });
});

const RESET_REQUEST_MESSAGE =
  "If an account exists for this email, a reset code has been sent.";

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const isDuplicateKey = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: number }).code === 11000;

// Upsert by email. Two requests at the same moment can both try to insert the row.
const savePasswordReset = async (
  email: string,
  update: Record<string, unknown>
) => {
  try {
    await PasswordReset.findOneAndUpdate({ email }, update, { upsert: true });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    await PasswordReset.updateOne({ email }, update);
  }
};

// Sends a 6-digit code. Unknown emails get the same success message as known ones.
// POST /api/v1/auth/forgot-password
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const email = normalizeEmail(req.body.email);
  const now = Date.now();

  if (env.isProduction && !isMailConfigured()) {
    throw new ApiError(503, "Password reset email is not available right now.");
  }

  const existing = await PasswordReset.findOne({ email });
  if (
    existing?.lastSentAt &&
    now - existing.lastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS
  ) {
    throw new ApiError(429, "Please wait a minute before requesting another code.");
  }

  const user = await User.findOne({ email });
  if (!user) {
    await savePasswordReset(email, {
      email,
      lastSentAt: new Date(now),
      otpHash: null,
      otpExpiresAt: null,
      attempts: 0,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    });
    sendResponse(res, 200, {
      data: null,
      status: ResponseStatus.SUCCESS,
      message: RESET_REQUEST_MESSAGE,
    });
    return;
  }

  const otp = generateOtp();
  await savePasswordReset(email, {
    email,
    otpHash: hashSecret(`${email}:${otp}`),
    otpExpiresAt: new Date(now + OTP_TTL_MS),
    attempts: 0,
    lastSentAt: new Date(now),
    resetTokenHash: null,
    resetTokenExpiresAt: null,
  });

  const mailReady = isMailConfigured();
  if (mailReady) {
    try {
      await sendPasswordResetOtp(email, otp);
    } catch (error) {
      console.error(
        "Password reset email failed",
        error instanceof Error ? error.name : "Error"
      );
      await PasswordReset.updateOne(
        { email },
        { otpHash: null, otpExpiresAt: null, lastSentAt: null }
      );
      throw new ApiError(502, "The reset code could not be sent. Please try again.");
    }
  }

  // Local Bruno can read the code when SMTP is not set. Production never includes it.
  const exposeOtp = !env.isProduction && !mailReady;
  sendResponse(res, 200, {
    data: exposeOtp ? { otp } : null,
    status: ResponseStatus.SUCCESS,
    message: exposeOtp
      ? "Email delivery is not configured, so the reset code is included in this response."
      : RESET_REQUEST_MESSAGE,
  });
});

// Checks the code and returns a short-lived reset token for the password form.
// POST /api/v1/auth/verify-otp
export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const email = normalizeEmail(req.body.email);
  const otp = String(req.body.otp).trim();
  const record = await PasswordReset.findOne({ email });
  const invalid = new ApiError(400, "The code is invalid or has expired. Request a new one.");

  if (!record?.otpHash || !record.otpExpiresAt || record.otpExpiresAt.getTime() < Date.now()) {
    throw invalid;
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    throw new ApiError(429, "Too many incorrect codes. Request a new one.");
  }

  if (!secretsMatch(`${email}:${otp}`, record.otpHash)) {
    await PasswordReset.updateOne({ email }, { $inc: { attempts: 1 } });
    throw invalid;
  }

  const resetToken = generateResetToken();
  record.otpHash = null;
  record.otpExpiresAt = null;
  record.attempts = 0;
  record.resetTokenHash = hashSecret(`${email}:${resetToken}`);
  record.resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await record.save();

  sendResponse(res, 200, {
    data: {
      resetToken,
    },
    status: ResponseStatus.SUCCESS,
    message: "The code has been verified. You can now choose a new password.",
  });
});

// Replaces the password after the code has been verified. Older sessions stop working.
// POST /api/v1/auth/reset-password
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const email = normalizeEmail(req.body.email);
  const resetToken = String(req.body.resetToken).trim();
  const newPassword = String(req.body.newPassword);
  const record = await PasswordReset.findOne({ email });
  const invalid = new ApiError(
    400,
    "This reset session is invalid or has expired. Verify the code again."
  );

  if (
    !record?.resetTokenHash ||
    !record.resetTokenExpiresAt ||
    record.resetTokenExpiresAt.getTime() < Date.now() ||
    !secretsMatch(`${email}:${resetToken}`, record.resetTokenHash)
  ) {
    throw invalid;
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    throw invalid;
  }

  if (await user.comparePassword(newPassword)) {
    throw new ApiError(400, "The new password must be different from the current password.");
  }

  user.password = newPassword;
  user.refreshToken = null;
  await user.save();
  await record.deleteOne();

  sendResponse(res, 200, {
    data: null,
    status: ResponseStatus.SUCCESS,
    message: "Your password has been updated. Please log in with the new password.",
  });
});
