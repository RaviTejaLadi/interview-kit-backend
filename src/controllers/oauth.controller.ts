/**
 * Google and GitHub sign-in.
 * The browser is sent to the provider, then returns here with a code.
 * A matching email reuses the existing account. Otherwise a new account is created
 * without a password, phone number, or date of birth.
 */
import { Request, Response } from "express";
import { env } from "../config/env";
import { IUser, User } from "../models/user.model";
import {
  fetchGithubProfile,
  fetchGoogleProfile,
  githubAuthUrl,
  googleAuthUrl,
  OAuthProfile,
} from "../services/oauth.service";
import { ApiError, asyncHandler } from "../utils/ApiError";
import { signAccessToken, signRefreshToken, JwtPayload } from "../utils/jwt";
import { OAuthProviderName, signOAuthState, verifyOAuthState } from "../utils/oauth-state";
import { ResponseStatus, sendResponse } from "../types/http-response";
import { setTokenCookies } from "./auth.controller";

const callbackPath = (provider: OAuthProviderName): string =>
  `/api/v1/auth/${provider}/callback`;

// Google treats localhost and 127.0.0.1 as different callbacks.
// The local provider apps are registered on 127.0.0.1.
export const publicApiBase = (req: Request): string => {
  if (!env.isProduction) return `http://127.0.0.1:${env.PORT}`;
  if (env.API_PUBLIC_URL) return env.API_PUBLIC_URL;
  return `${req.protocol}://${req.get("host")}`;
};

const redirectUri = (req: Request, provider: OAuthProviderName): string =>
  `${publicApiBase(req)}${callbackPath(provider)}`;

const allowedReturnOrigin = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim()) return env.CLIENT_URL;
  try {
    const origin = new URL(value).origin;
    if (env.CLIENT_ORIGINS.includes(origin)) return origin;
  } catch {
    return env.CLIENT_URL;
  }
  return env.CLIENT_URL;
};

const frontendCallback = (origin = env.CLIENT_URL): URL => new URL("/oauth/callback", origin);

const redirectOAuthError = (res: Response, message: string, origin = env.CLIENT_URL) => {
  const target = frontendCallback(origin);
  target.searchParams.set("error", message);
  res.redirect(target.toString());
};

const isDuplicateKey = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: number }).code === 11000;

const providerField = (provider: OAuthProviderName): "googleId" | "githubId" =>
  provider === "google" ? "googleId" : "githubId";

const linkProvider = (user: IUser, profile: OAuthProfile) => {
  const field = providerField(profile.provider);
  const current = user[field];
  if (current && current !== profile.providerId) {
    throw new ApiError(
      409,
      `This email is already linked to a different ${profile.provider} account.`
    );
  }
  user[field] = profile.providerId;
  if (!user.avatar && profile.avatar) user.avatar = profile.avatar;
};

const findOrCreateUser = async (profile: OAuthProfile): Promise<IUser> => {
  const field = providerField(profile.provider);
  let user = await User.findOne({ [field]: profile.providerId });
  if (!user) {
    user = await User.findOne({ email: profile.email });
    if (user) linkProvider(user, profile);
  }

  if (!user) {
    try {
      user = await User.create({
        firstName: profile.firstName,
        lastName: profile.lastName,
        userName: profile.userName,
        email: profile.email,
        provider: profile.provider,
        [field]: profile.providerId,
        avatar: profile.avatar,
      });
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      user = await User.findOne({
        $or: [{ email: profile.email }, { [field]: profile.providerId }],
      });
      if (!user) throw error;
      linkProvider(user, profile);
    }
  }

  return user;
};

const finishLogin = async (res: Response, user: IUser, returnTo: string) => {
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

  const target = frontendCallback(returnTo);
  const hash = new URLSearchParams({ accessToken, refreshToken });
  target.hash = hash.toString();
  res.redirect(target.toString());
};

const providerReady = (provider: OAuthProviderName): boolean =>
  provider === "google"
    ? Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
    : Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);

// Tells the frontend which buttons it can show.
// GET /api/v1/auth/oauth/providers
export const oauthProviders = asyncHandler(async (req: Request, res: Response) => {
  const base = publicApiBase(req);
  sendResponse(res, 200, {
    data: {
      google: providerReady("google"),
      github: providerReady("github"),
      googleUrl: `${base}/api/v1/auth/google`,
      githubUrl: `${base}/api/v1/auth/github`,
    },
    status: ResponseStatus.SUCCESS,
    message: "Sign-in providers have been retrieved successfully.",
  });
});

const startOAuth = (provider: OAuthProviderName, buildUrl: (redirectUri: string, state: string) => string) =>
  asyncHandler(async (req: Request, res: Response) => {
    if (!providerReady(provider)) {
      throw new ApiError(503, `${provider === "google" ? "Google" : "GitHub"} sign-in is not configured.`);
    }
    const returnTo = allowedReturnOrigin(req.query.returnTo);
    const state = signOAuthState(provider, returnTo);
    res.redirect(buildUrl(redirectUri(req, provider), state));
  });

// GET /api/v1/auth/google
export const startGoogle = startOAuth("google", googleAuthUrl);

// GET /api/v1/auth/github
export const startGithub = startOAuth("github", githubAuthUrl);

const handleCallback = (
  provider: OAuthProviderName,
  loadProfile: (code: string, redirectUri: string) => Promise<OAuthProfile>
) =>
  asyncHandler(async (req: Request, res: Response) => {
    let returnTo = env.CLIENT_URL;
    try {
      if (!providerReady(provider)) {
        throw new ApiError(503, `${provider === "google" ? "Google" : "GitHub"} sign-in is not configured.`);
      }
      if (typeof req.query.error === "string") {
        throw new ApiError(401, `${provider === "google" ? "Google" : "GitHub"} sign-in was cancelled.`);
      }
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      if (!code || !state) {
        throw new ApiError(400, "The sign-in response was incomplete. Please try again.");
      }
      returnTo = allowedReturnOrigin(verifyOAuthState(state, provider).returnTo);
      const profile = await loadProfile(code, redirectUri(req, provider));
      const user = await findOrCreateUser(profile);
      await finishLogin(res, user, returnTo);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : `${provider === "google" ? "Google" : "GitHub"} sign-in could not be completed. Please try again.`;
      redirectOAuthError(res, message, returnTo);
    }
  });

// GET /api/v1/auth/google/callback
export const googleCallback = handleCallback("google", fetchGoogleProfile);

// GET /api/v1/auth/github/callback
export const githubCallback = handleCallback("github", fetchGithubProfile);
