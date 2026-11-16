/**
 * Shared response envelope.
 * Every API returns this shape. The HTTP status code stays on the response.
 * `status` names the outcome, such as success, failed, or pending.
 */
import { Response } from "express";

interface IHttpResponse<T> {
  data: T;
  status: string;
  message: string;
}

export { type IHttpResponse };

export const ResponseStatus = {
  SUCCESS: "success",
  FAILED: "failed",
  PENDING: "pending",
} as const;

export const sendResponse = <T>(
  res: Response,
  httpStatus: number,
  body: IHttpResponse<T>
): Response => {
  return res.status(httpStatus).json(body);
};
