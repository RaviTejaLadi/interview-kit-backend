/**
 * Express application.
 * This file decides the order every request walks through:
 * security headers, browser access, body reading, routes, then errors.
 * server.ts starts it. Route files decide what each URL does.
 */
import express from "express";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import routes, { healthCheck } from "./routes";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";

const app = express();

const isAllowedCorsOrigin = (origin?: string): boolean => {
  // Non-browser calls (Bruno, curl, server-to-server) usually send no Origin header.
  if (!origin) return true;
  if (env.CLIENT_ORIGINS.includes(origin)) return true;

  try {
    const { protocol, hostname } = new URL(origin);

    // Vercel preview deployments use dynamic subdomains. Allowing them avoids
    // CORS breakage after every new frontend deployment URL.
    if (protocol === "https:" && hostname.endsWith(".vercel.app")) return true;

    if (
      !env.isProduction &&
      (hostname === "localhost" || hostname === "127.0.0.1")
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
};

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (isAllowedCorsOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("This origin is not allowed by CORS."));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
};

// Render terminates HTTPS in front of the process. This keeps redirect URLs on https.
app.set("trust proxy", 1);

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
    ...corsOptions,
  }),
);
app.options("*", cors(corsOptions));

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
