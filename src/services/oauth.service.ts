/**
 * Google and GitHub authorization-code exchange.
 * The client secret stays on the server. The browser only carries the code
 * from the provider back to this API.
 */
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { OAuthProviderName } from "../utils/oauth-state";

export interface OAuthProfile {
  provider: OAuthProviderName;
  providerId: string;
  email: string;
  firstName: string;
  lastName: string;
  userName: string;
  avatar?: string;
}

const atLeast = (value: string | undefined, fallback: string, min: number): string => {
  const cleaned = (value || "").replace(/\s+/g, " ").trim();
  const base = cleaned || fallback;
  if (base.length >= min) return base.slice(0, 60);
  return `${base}${fallback}user`.replace(/\s+/g, "").slice(0, 60).padEnd(min, "x");
};

const profileNames = (fullName: string | undefined, login: string, email: string) => {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  const local = email.split("@")[0] || "user";
  const firstName = atLeast(parts[0], local, 3);
  const lastName = atLeast(parts.slice(1).join(" "), "User", 3);
  const userName = atLeast(login || local, local, 2);
  return { firstName, lastName, userName };
};

const readJson = async (response: globalThis.Response): Promise<Record<string, unknown> | null> =>
  (await response.json().catch(() => null)) as Record<string, unknown> | null;

export const googleAuthUrl = (redirectUri: string, state: string): string => {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
};

export const githubAuthUrl = (redirectUri: string, state: string): string => {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);
  return url.toString();
};

const exchangeCode = async (
  url: string,
  body: URLSearchParams,
  failure: string
): Promise<Record<string, unknown>> => {
  let response: globalThis.Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError(502, failure);
  }

  const payload = await readJson(response);
  const accessToken = typeof payload?.access_token === "string" ? payload.access_token : "";
  if (!response.ok || !accessToken) {
    throw new ApiError(502, failure);
  }
  return payload || {};
};

export const fetchGoogleProfile = async (
  code: string,
  redirectUri: string
): Promise<OAuthProfile> => {
  const token = await exchangeCode(
    "https://oauth2.googleapis.com/token",
    new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    "Google sign-in could not be completed. Please try again."
  );

  let response: globalThis.Response;
  try {
    response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError(502, "Google sign-in could not be completed. Please try again.");
  }

  const profile = await readJson(response);
  const email = typeof profile?.email === "string" ? profile.email.trim().toLowerCase() : "";
  const verified = profile?.email_verified === true || profile?.email_verified === "true";
  const subject = typeof profile?.sub === "string" ? profile.sub : "";
  if (!response.ok || !email || !verified || !subject) {
    throw new ApiError(400, "Google did not provide a verified email address.");
  }

  const given = typeof profile?.given_name === "string" ? profile.given_name : "";
  const family = typeof profile?.family_name === "string" ? profile.family_name : "";
  const full = [given, family].filter(Boolean).join(" ") || (typeof profile?.name === "string" ? profile.name : "");
  const names = profileNames(full, email.split("@")[0], email);
  const avatar = typeof profile?.picture === "string" ? profile.picture : undefined;

  return {
    provider: "google",
    providerId: subject,
    email,
    ...names,
    avatar,
  };
};

interface GitHubEmail {
  email?: string;
  primary?: boolean;
  verified?: boolean;
}

export const fetchGithubProfile = async (
  code: string,
  redirectUri: string
): Promise<OAuthProfile> => {
  const token = await exchangeCode(
    "https://github.com/login/oauth/access_token",
    new URLSearchParams({
      code,
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      redirect_uri: redirectUri,
    }),
    "GitHub sign-in could not be completed. Please try again."
  );

  const headers = {
    Authorization: `Bearer ${token.access_token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "interview-kit-backend",
  };

  let userResponse: globalThis.Response;
  let emailResponse: globalThis.Response;
  try {
    [userResponse, emailResponse] = await Promise.all([
      fetch("https://api.github.com/user", { headers, signal: AbortSignal.timeout(15000) }),
      fetch("https://api.github.com/user/emails", { headers, signal: AbortSignal.timeout(15000) }),
    ]);
  } catch {
    throw new ApiError(502, "GitHub sign-in could not be completed. Please try again.");
  }

  const user = await readJson(userResponse);
  const emails = (await emailResponse.json().catch(() => null)) as GitHubEmail[] | null;
  const verified = Array.isArray(emails) ? emails.filter((item) => item.verified && item.email) : [];
  const chosen = verified.find((item) => item.primary) || verified[0];
  const email = chosen?.email?.trim().toLowerCase() || "";
  const providerId = user?.id != null ? String(user.id) : "";
  if (!userResponse.ok || !email || !providerId) {
    throw new ApiError(400, "GitHub did not provide a verified email address.");
  }

  const login = typeof user?.login === "string" ? user.login : "";
  const name = typeof user?.name === "string" ? user.name : login;
  const names = profileNames(name, login, email);
  const avatar = typeof user?.avatar_url === "string" ? user.avatar_url : undefined;

  return {
    provider: "github",
    providerId,
    email,
    ...names,
    avatar,
  };
};
