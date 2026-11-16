/**
 * Outbound mail.
 * Password reset uses this to deliver the one-time code.
 * When SMTP settings are missing, callers decide what to do. Local development
 * can return the code in the API response. Production must not.
 */
import nodemailer from "nodemailer";
import { env } from "../config/env";

export const isMailConfigured = (): boolean =>
  Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM);

export const sendPasswordResetOtp = async (to: string, otp: string): Promise<void> => {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: "Your Interview Kit password reset code",
    text: [
      `Your password reset code is ${otp}.`,
      "It expires in 10 minutes.",
      "If you did not ask to reset your password, you can ignore this email.",
    ].join("\n"),
  });
};
