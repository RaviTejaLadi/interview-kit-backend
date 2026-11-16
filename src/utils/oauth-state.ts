/**
 * Short-lived proof that this API started the Google or GitHub redirect.
 * The provider sends it back, which stops another site from forging a callback.
 */
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { ApiError } from "./ApiError";

export type OAuthProviderName = "google" | "github";

export const signOAuthState = (provider: OAuthProviderName): string =>
  jwt.sign({ purpose: "oauth", provider }, env.JWT_ACCESS_SECRET, { expiresIn: "10m" });

export const verifyOAuthState = (state: string, provider: OAuthProviderName): void => {
  try {
    const decoded = jwt.verify(state, env.JWT_ACCESS_SECRET) as {
      purpose?: string;
      provider?: string;
    };
    if (decoded.purpose !== "oauth" || decoded.provider !== provider) {
      throw new Error("mismatch");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const name = error instanceof Error ? error.name : "";
    if (name === "TokenExpiredError") {
      throw new ApiError(401, "This sign-in attempt has expired. Please try again.");
    }
    throw new ApiError(401, "This sign-in attempt is not valid. Please try again.");
  }
};
