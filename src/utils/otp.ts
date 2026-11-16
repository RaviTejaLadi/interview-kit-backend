/**
 * Password-reset secrets.
 * The raw code and reset token are shown once. The database keeps an HMAC
 * so a copied database cannot be used to finish someone else's reset.
 */
import crypto from "crypto";
import { env } from "../config/env";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export const generateOtp = (): string => crypto.randomInt(100000, 1000000).toString();

export const generateResetToken = (): string => crypto.randomBytes(32).toString("hex");

export const hashSecret = (value: string): string =>
  crypto.createHmac("sha256", env.JWT_ACCESS_SECRET).update(value).digest("hex");

export const secretsMatch = (value: string, hash: string | null | undefined): boolean => {
  if (!hash) return false;
  const actual = Buffer.from(hashSecret(value));
  const expected = Buffer.from(hash);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
};
