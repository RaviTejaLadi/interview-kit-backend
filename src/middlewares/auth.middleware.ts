import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import { verifyAccessToken } from "../utils/jwt";

export const protect = (req: Request, _res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return next(new ApiError(401, "Authentication required. Please log in."));
    }

    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return next(new ApiError(401, "Invalid or expired access token"));
  }
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
