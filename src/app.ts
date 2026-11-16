/**
 * Express application.
 * This file decides the order every request walks through:
 * security headers, browser access, body reading, routes, then errors.
 * server.ts starts it. Route files decide what each URL does.
 */
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import routes, { healthCheck } from "./routes";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";

const app = express();

// Adds safe HTTP headers so browsers reject a few common attacks.
// The default resource policy is same-origin, which would block the Vercel app from reading this API.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// The frontend runs on a different origin. CORS lets those origins call this API,
// and credentials lets the browser send the login cookies.
app.use(
  cors({
    origin: env.CLIENT_ORIGINS,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// Turn JSON and form bodies into req.body. The limit leaves room for large payloads.
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// Login stores tokens in cookies. This makes those cookies available on req.cookies.
app.use(cookieParser());

// Health checks sit outside /api/v1 so a host can probe the process without the API prefix.
app.get("/", healthCheck);
app.get("/health", healthCheck);

// Every feature route is mounted here: auth, admin, feedback, and chat.
app.use("/api/v1", routes);

// These must be last. Unknown URLs and thrown errors become JSON responses.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
