import { NextFunction, Request, Response } from "express";
import { User } from "../models/user.model";
import { ApiError } from "../utils/ApiError";
import { verifyAccessToken } from "../utils/jwt";

const readToken = (req: Request): string | undefined => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    return req.headers.authorization.split(" ")[1];
  }

  return req.cookies?.accessToken;
};

export const protect = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const token = readToken(req);
    if (!token) {
      return next(new ApiError(401, "Authentication required. Please log in."));
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId).select("role");
    if (!user) {
      return next(new ApiError(401, "User no longer exists"));
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: user.role,
    };
    next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);

    const name = error instanceof Error ? error.name : "";
    if (
      name === "JsonWebTokenError" ||
      name === "TokenExpiredError" ||
      name === "NotBeforeError"
    ) {
      return next(new ApiError(401, "Invalid or expired access token"));
    }

    next(error);
  }
};

export const optionalProtect = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!readToken(req)) return next();
  return protect(req, res, next);
};

export const authorize = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new ApiError(403, "You do not have permission to perform this action")
      );
    }
    next();
  };
};
