/**
 * Database connection.
 * Users, refresh tokens, and feedback all live in MongoDB.
 * The server calls this once before it accepts traffic.
 */
import mongoose from "mongoose";
import { env } from "./env";

export const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI, {
      // Atlas allow-lists are IPv4. Forcing family 4 avoids a failed IPv6 attempt on Render.
      family: 4,
      // Fail fast when the cluster is paused or unreachable instead of hanging startup.
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("MongoDB connection error:", message);
    // The next line is an operator hint. The process still exits because the API cannot work offline.
    console.error(
      "In MongoDB Atlas, open Network Access and allow 0.0.0.0/0. Also confirm the cluster is not paused."
    );
    process.exit(1);
  }
};
