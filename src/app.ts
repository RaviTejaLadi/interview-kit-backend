import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import routes, { healthCheck } from "./routes";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";

const app = express();

// Security & Parsing Middlewares
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  }),
);
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true,limit:"100mb" }));
app.use(cookieParser());

// Health is available at the server root. API routes stay under /api/v1.
app.get("/", healthCheck);
app.get("/health", healthCheck);
app.use("/api/v1", routes);


// Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
