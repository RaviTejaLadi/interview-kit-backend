/**
 * Last step for failed requests.
 * notFoundHandler covers URLs this API does not define.
 * errorHandler turns thrown ApiError values into the JSON shape clients already expect.
 */
import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";
import { ResponseStatus, sendResponse } from "../types/http-response";

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  next(new ApiError(404, `The route ${req.originalUrl} could not be found.`));
};

export const errorHandler = (
  err: Error | ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  const message =
    err.message ||
    "Something went wrong while processing your request. Please try again later.";

  // The stack helps local debugging. Production responses leave it out.
  // It stays inside data so the envelope is still data, status, and message.
  sendResponse(res, statusCode, {
    data: env.NODE_ENV === "development" && err.stack ? { stack: err.stack } : null,
    status: ResponseStatus.FAILED,
    message,
  });
};
