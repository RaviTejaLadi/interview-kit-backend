import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  next(new ApiError(404, `Route ${req.originalUrl} not found`));
};

export const errorHandler = (
  err: Error | ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
