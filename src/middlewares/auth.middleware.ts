/**
 * Login checks used by protected routes.
 * protect proves the caller has a valid account.
 * authorize limits a route to a role, which is how admin routes stay closed to normal users.
 * optionalProtect is only for creating the first admin, when a token may not exist yet.
 */
import { NextFunction, Request, Response } from "express";
import { User } from "../models/user.model";
import { ApiError } from "../utils/ApiError";
import { verifyAccessToken } from "../utils/jwt";

// Bruno sends Authorization: Bearer. The browser can also send the accessToken cookie.
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
      return next(new ApiError(401, "Please log in to continue."));
    }

    const decoded = verifyAccessToken(token);
    // Read the role from the database so a demotion takes effect before the token expires.
    const user = await User.findById(decoded.userId).select("role");
    if (!user) {
      return next(new ApiError(401, "This account no longer exists. Please log in again."));
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: user.role,
    };
    next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);

    // Bad or expired tokens are a client problem. Other failures stay 500.
    const name = error instanceof Error ? error.name : "";
    if (
      name === "JsonWebTokenError" ||
      name === "TokenExpiredError" ||
      name === "NotBeforeError"
    ) {
      return next(new ApiError(401, "The access token is invalid or has expired. Please log in again."));
    }

    next(error);
  }
};

// Continue when no token was sent. A present token is still checked.
export const optionalProtect = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!readToken(req)) return next();
  return protect(req, res, next);
};

// Use after protect. Example: authorize("admin") blocks a normal user.
export const authorize = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new ApiError(403, "You do not have permission to perform this action.")
      );
    }
    next();
  };
};
