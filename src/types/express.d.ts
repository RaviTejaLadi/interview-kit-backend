import { IFeedback } from "../models/feedback.model";
import { JwtPayload } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      feedback?: IFeedback;
    }
  }
}
