/**
 * Process entry point.
 * The app is created in app.ts. This file only connects the database
 * and starts listening, so a failed database does not leave a half-open API.
 */
import app from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";

const startServer = async () => {
  // Wait for MongoDB first. Requests that need users or feedback would fail without it.
  await connectDB();

  // 0.0.0.0 accepts connections from other machines, not only this computer.
  // Bruno must use 127.0.0.1 because this address is IPv4, and "localhost" can be IPv6.
  const server = app.listen(env.PORT, "0.0.0.0", () => {
    console.log(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
  });

  // A forgotten async error should stop the process instead of serving unknown state.
  process.on("unhandledRejection", (err: Error) => {
    console.error("UNHANDLED REJECTION! Shutting down...", err.name, err.message);
    server.close(() => {
      process.exit(1);
    });
  });
};

startServer();
