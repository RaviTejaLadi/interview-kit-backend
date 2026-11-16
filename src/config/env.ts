/**
 * Environment settings.
 * Secrets and URLs stay out of the source code. The rest of the project
 * reads this `env` object so every file uses the same checked values.
 */
import dotenv from "dotenv";
import path from "path";

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

// Render injects variables before startup. dotenv does not override those.
// `.env.production` / `.env.development` fill anything still missing, then `.env`.
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Known sample secrets. Production must not boot with one of these.
const PLACEHOLDER_SECRETS = new Set([
  "your_super_secret_access_key_change_in_production",
  "your_super_secret_refresh_key_change_in_production",
  "dev_access_secret_key_12345",
  "dev_refresh_secret_key_67890",
  "change_me",
  "secret",
]);

// Trim quotes that sometimes get copied into env dashboards.
const readEnv = (name: string): string | undefined => {
  const value = process.env[name]?.trim().replace(/^["']|["']$/g, "");
  return value || undefined;
};

// Production fails closed when a setting is missing. Local development can use a fallback.
const required = (name: string, fallback?: string): string => {
  const value = readEnv(name);
  if (value) return value;
  if (!isProduction && fallback !== undefined) return fallback;
  throw new Error(
    `${name} is required when NODE_ENV=${nodeEnv}. Set it in the Render Environment tab.`
  );
};

// A short or copied JWT secret would let someone forge login tokens in production.
const assertJwtSecret = (name: string, value: string): string => {
  if (!isProduction) return value;
  if (value.length < 32 || PLACEHOLDER_SECRETS.has(value)) {
    throw new Error(
      `${name} must be a unique random string of at least 32 characters. Do not use a placeholder in production.`
    );
  }
  return value;
};

const mongoUri = (): string => {
  const uri = readEnv("MONGO_URI") || readEnv("MONGODB_URI");
  if (!uri) {
    // Local machines can use a database on this computer. Render cannot.
    if (!isProduction) return "mongodb://127.0.0.1:27017/interview-kit";
    throw new Error(
      "MONGO_URI is required in production. Set your MongoDB Atlas connection string in Render. Localhost is not available there."
    );
  }
  if (isProduction && /(127\.0\.0\.1|localhost)/.test(uri)) {
    throw new Error(
      "MONGO_URI points at localhost. Production must use the MongoDB Atlas connection string."
    );
  }
  return uri;
};

const jwtAccessSecret = assertJwtSecret(
  "JWT_ACCESS_SECRET",
  required("JWT_ACCESS_SECRET", "dev_access_secret_key_12345")
);
const jwtRefreshSecret = assertJwtSecret(
  "JWT_REFRESH_SECRET",
  required("JWT_REFRESH_SECRET", "dev_refresh_secret_key_67890")
);

// Separate secrets mean a stolen access-token key cannot also mint refresh tokens.
if (isProduction && jwtAccessSecret === jwtRefreshSecret) {
  throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.");
}

// The live frontend. A copied placeholder must not be the only origin the browser is allowed to use.
const PRODUCTION_CLIENT_URL = "https://my-interview-kit.vercel.app";
const PLACEHOLDER_CLIENT_URLS = new Set([
  "https://my-interview-kit.vercel.app/",
]);

const readClientOrigins = (): string[] => {
  const configured = (readEnv("CLIENT_URL") || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter((origin) => origin && !PLACEHOLDER_CLIENT_URLS.has(origin));

  const origins = new Set<string>(configured);
  if (!isProduction) {
    origins.add("http://localhost:1010");
    origins.add("http://127.0.0.1:1010");
  }
  origins.add(PRODUCTION_CLIENT_URL);
  return [...origins];
};

const clientOrigins = readClientOrigins();

// Chat quotas are numbers. A missing or unusable value keeps the built-in default.
const readInt = (name: string, fallback: number, min: number, max: number): number => {
  const raw = readEnv(name);
  const parsed = raw ? Number.parseInt(raw, 10) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

export const env = {
  NODE_ENV: nodeEnv,
  isProduction,
  // Render provides PORT. Local Bruno calls port 5000.
  PORT: parseInt(readEnv("PORT") || (isProduction ? "10000" : "5000"), 10),
  MONGO_URI: mongoUri(),
  // Shown on the health check. The first real origin, or the deployed frontend.
  CLIENT_URL: clientOrigins[0] || PRODUCTION_CLIENT_URL,
  // Every origin a browser may call this API from. CLIENT_URL may list several, separated by commas.
  CLIENT_ORIGINS: clientOrigins,
  JWT_ACCESS_SECRET: jwtAccessSecret,
  JWT_REFRESH_SECRET: jwtRefreshSecret,
  // Access tokens expire sooner. Refresh tokens let a client stay logged in.
  JWT_ACCESS_EXPIRES_IN: readEnv("JWT_ACCESS_EXPIRES_IN") || "24h",
  JWT_REFRESH_EXPIRES_IN: readEnv("JWT_REFRESH_EXPIRES_IN") || "7d",
  // Empty means the chat routes answer 503. The rest of the API still starts.
  GEMINI_API_KEY: readEnv("GEMINI_API_KEY") || "",
  // gemini-flash-latest often returns 503 under load. The lite alias stays on the same API and answers.
  GEMINI_MODEL: readEnv("GEMINI_MODEL") || "gemini-flash-lite-latest",
  // How many saved conversations one account may keep at once.
  GEMINI_MAX_CHATS_PER_USER: readInt("GEMINI_MAX_CHATS_PER_USER", 5, 1, 50),
  // How many of the user's own messages one conversation may contain.
  GEMINI_MAX_MESSAGES_PER_CHAT: readInt("GEMINI_MAX_MESSAGES_PER_CHAT", 20, 1, 100),
  // How many user messages one account may send between 00:00 and 24:00 UTC.
  GEMINI_DAILY_MESSAGE_LIMIT: readInt("GEMINI_DAILY_MESSAGE_LIMIT", 30, 1, 500),
  // Stops a single request from sending a very long prompt.
  GEMINI_MAX_MESSAGE_CHARS: readInt("GEMINI_MAX_MESSAGE_CHARS", 2000, 100, 8000),
  // Caps the model reply so one turn cannot run away in length or cost.
  GEMINI_MAX_OUTPUT_TOKENS: readInt("GEMINI_MAX_OUTPUT_TOKENS", 1024, 64, 8192),
  // Optional. Password reset emails are sent only when all of these are set.
  SMTP_HOST: readEnv("SMTP_HOST") || "",
  SMTP_PORT: parseInt(readEnv("SMTP_PORT") || "587", 10),
  SMTP_USER: readEnv("SMTP_USER") || "",
  SMTP_PASS: readEnv("SMTP_PASS") || "",
  SMTP_FROM: readEnv("SMTP_FROM") || "",
  // Public origin of this API. OAuth providers must redirect back to this host.
  API_PUBLIC_URL: (readEnv("API_PUBLIC_URL") || "").replace(/\/$/, ""),
  GOOGLE_CLIENT_ID: readEnv("GOOGLE_CLIENT_ID") || "",
  GOOGLE_CLIENT_SECRET: readEnv("GOOGLE_CLIENT_SECRET") || "",
  GITHUB_CLIENT_ID: readEnv("GITHUB_CLIENT_ID") || "",
  GITHUB_CLIENT_SECRET: readEnv("GITHUB_CLIENT_SECRET") || "",
};
