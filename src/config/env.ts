import dotenv from "dotenv";
import path from "path";

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

// Render injects variables before startup. dotenv does not override those.
// `.env.production` / `.env.development` fill anything still missing, then `.env`.
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const PLACEHOLDER_SECRETS = new Set([
  "your_super_secret_access_key_change_in_production",
  "your_super_secret_refresh_key_change_in_production",
  "dev_access_secret_key_12345",
  "dev_refresh_secret_key_67890",
  "change_me",
  "secret",
]);

const readEnv = (name: string): string | undefined => {
  const value = process.env[name]?.trim().replace(/^["']|["']$/g, "");
  return value || undefined;
};

const required = (name: string, fallback?: string): string => {
  const value = readEnv(name);
  if (value) return value;
  if (!isProduction && fallback !== undefined) return fallback;
  throw new Error(
    `${name} is required when NODE_ENV=${nodeEnv}. Set it in the Render Environment tab.`
  );
};

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

if (isProduction && jwtAccessSecret === jwtRefreshSecret) {
  throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.");
}

export const env = {
  NODE_ENV: nodeEnv,
  isProduction,
  PORT: parseInt(readEnv("PORT") || (isProduction ? "10000" : "5000"), 10),
  MONGO_URI: mongoUri(),
  CLIENT_URL: isProduction
    ? required("CLIENT_URL")
    : readEnv("CLIENT_URL") || "http://localhost:5173",
  JWT_ACCESS_SECRET: jwtAccessSecret,
  JWT_REFRESH_SECRET: jwtRefreshSecret,
  JWT_ACCESS_EXPIRES_IN: readEnv("JWT_ACCESS_EXPIRES_IN") || "24h",
  JWT_REFRESH_EXPIRES_IN: readEnv("JWT_REFRESH_EXPIRES_IN") || "7d",
};
