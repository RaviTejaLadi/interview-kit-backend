import mongoose from "mongoose";
import { env } from "./env";

export const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI, {
      // Atlas allow lists are IPv4. Node 24 on Render may try IPv6 first.
      family: 4,
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("MongoDB connection error:", message);
    console.error(
      "In MongoDB Atlas, open Network Access and allow 0.0.0.0/0. Also confirm the cluster is not paused."
    );
    process.exit(1);
  }
};
