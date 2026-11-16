/**
 * Extra fields on Express Request.
 * Auth middleware stores the logged-in caller on req.user.
 * Feedback middleware stores the loaded submission on req.feedback.
 * Chat middleware stores the loaded conversation on req.chat.
 * Declaring them here lets controllers use those fields with TypeScript.
 */
import { IChat } from "../models/chat.model";
import { IFeedback } from "../models/feedback.model";
import { JwtPayload } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      feedback?: IFeedback;
      chat?: IChat;
    }
  }
}
