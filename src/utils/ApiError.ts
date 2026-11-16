/**
 * Shared error helpers.
 * Controllers throw ApiError instead of sending many different error shapes.
 * The error middleware turns that into one JSON response.
 * asyncHandler forwards rejected promises to that same middleware,
 * because Express does not catch async errors by itself.
 */
import { Request, Response, NextFunction } from "express";

export class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    // Operational errors are expected cases such as 401 or 404, not bugs.
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
