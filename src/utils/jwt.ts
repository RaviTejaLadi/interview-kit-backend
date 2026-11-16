/**
 * Login tokens.
 * The access token proves who is calling on each request.
 * The refresh token is longer lived and is only used to get a new access token.
 * They use different secrets so one leaked key does not unlock both.
 */
import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

// What a verified token is allowed to say about the caller.
export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

// Short-lived token sent as Bearer or the accessToken cookie.
export const signAccessToken = (payload: JwtPayload): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
};

// Longer-lived token. Logout deletes the copy stored on the user.
export const signRefreshToken = (payload: JwtPayload): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
};
