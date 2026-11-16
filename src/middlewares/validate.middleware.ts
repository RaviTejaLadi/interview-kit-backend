/**
 * Request checking.
 * Zod schemas describe the body, query, and URL params a route accepts.
 * Invalid input stops here with 400, so controllers can trust the shape they read.
 */
import { Request, Response, NextFunction } from "express";
import { ZodError, ZodTypeAny } from "zod";
import { ApiError } from "../utils/ApiError";

export const validate =
  (schema: ZodTypeAny) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // One object lets a schema check body, query, and params together.
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.errors.map((e) => e.message).join(", ");
        return next(new ApiError(400, message));
      }
      next(error);
    }
  };
