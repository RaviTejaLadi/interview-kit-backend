/**
 * Outbound mail for the password-reset code.
 * Render free web services block SMTP ports 25, 465, and 587, so production
 * sends through Brevo's HTTPS API. Local SMTP remains available when no API key is set.
 */
import nodemailer from "nodemailer";
import { env } from "../config/env";

const SUBJECT = "Your Interview Kit password reset code";

const resetText = (otp: string): string =>
  [
    `Your password reset code is ${otp}.`,
    "It expires in 10 minutes.",
    "If you did not ask to reset your password, you can ignore this email.",
  ].join("\n");

const smtpReady = (): boolean =>
  Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM);

export const isMailConfigured = (): boolean =>
  Boolean(env.SMTP_FROM && (env.BREVO_API_KEY || smtpReady()));

const sendViaBrevoApi = async (to: string, otp: string): Promise<void> => {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: "Interview Kit", email: env.SMTP_FROM },
      to: [{ email: to }],
      subject: SUBJECT,
      textContent: resetText(otp),
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (response.ok) return;

  let detail = `Brevo rejected the email (${response.status})`;
  try {
    const body = (await response.json()) as { message?: string };
    if (body.message) detail = body.message;
  } catch {
    // Brevo sometimes returns an empty body. The status is enough.
  }
  throw new Error(detail);
};

const sendViaSmtp = async (to: string, otp: string): Promise<void> => {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    requireTLS: env.SMTP_PORT === 587,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: SUBJECT,
    text: resetText(otp),
  });
};

export const sendPasswordResetOtp = async (to: string, otp: string): Promise<void> => {
  if (env.BREVO_API_KEY) {
    await sendViaBrevoApi(to, otp);
    return;
  }
  await sendViaSmtp(to, otp);
};
