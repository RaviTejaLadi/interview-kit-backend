import dotenv from "dotenv";

dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "5000", 10),
  MONGO_URI:
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/interview-kit",
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "dev_access_secret_key_12345",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "dev_refresh_secret_key_67890",
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
};
