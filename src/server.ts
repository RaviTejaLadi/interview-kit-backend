import app from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";

const startServer = async () => {
  await connectDB();

  const server = app.listen(env.PORT, () => {
    console.log(
      `Server running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`
    );
  });

  process.on("unhandledRejection", (err: Error) => {
    console.error("UNHANDLED REJECTION! Shutting down...", err.name, err.message);
    server.close(() => {
      process.exit(1);
    });
  });
};

startServer();
