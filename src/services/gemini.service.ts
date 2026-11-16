/**
 * Google Gemini generateContent call.
 * The API key stays in the request header and is never written into chat documents
 * or error messages returned to the client.
 */
import { env } from "../config/env";
import { ChatRole } from "../models/chat.model";
import { ApiError } from "../utils/ApiError";

export interface GeminiTurn {
  role: ChatRole;
  text: string;
}

interface GeminiResponseBody {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

const SYSTEM_INSTRUCTION =
  "You are the Interview Kit assistant. Help the user prepare for interviews with clear, concise answers they can say out loud. Explain concepts in plain language. Stay practical and do not invent the user's work history.";

// Model replies are stored with a hard cap so a long completion cannot break the schema.
const MAX_STORED_REPLY_CHARS = 20000;

// Used when the configured model is overloaded or retired. These answered while gemini-flash-latest returned 503.
const FALLBACK_MODELS = ["gemini-flash-lite-latest", "gemini-3.5-flash-lite"];

const modelsToTry = (): string[] => {
  const models = [env.GEMINI_MODEL, ...FALLBACK_MODELS];
  return models.filter((model, index) => Boolean(model) && models.indexOf(model) === index);
};

const canTryAnotherModel = (status: number): boolean =>
  status === 404 || status === 429 || status === 500 || status === 503;

export const generateGeminiReply = async (history: GeminiTurn[]): Promise<string> => {
  if (!env.GEMINI_API_KEY) {
    throw new ApiError(
      503,
      "Chat is unavailable because the Gemini API key is not configured."
    );
  }

  const body = JSON.stringify({
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: history.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    generationConfig: {
      maxOutputTokens: env.GEMINI_MAX_OUTPUT_TOKENS,
      temperature: 0.7,
    },
  });

  let payload: GeminiResponseBody | null = null;
  let lastStatus = 0;

  for (const model of modelsToTry()) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    let response: globalThis.Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": env.GEMINI_API_KEY,
        },
        body,
        signal: AbortSignal.timeout(20000),
      });
    } catch (error) {
      // A timeout or a dropped connection should move on to the next model.
      lastStatus = 503;
      console.error("Gemini request failed", model, error instanceof Error ? error.name : "Error");
      continue;
    }

    payload = (await response.json().catch(() => null)) as GeminiResponseBody | null;
    if (response.ok) {
      lastStatus = 200;
      break;
    }

    lastStatus = response.status;
    console.error("Gemini request failed", model, response.status);
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(502, "The chat service rejected the API key.");
    }
    if (!canTryAnotherModel(response.status)) break;
    payload = null;
  }

  if (lastStatus !== 200 || !payload) {
    if (lastStatus === 429) {
      throw new ApiError(429, "The chat service is busy right now. Please wait and try again.");
    }
    if (lastStatus === 503) {
      throw new ApiError(503, "The chat service is temporarily unavailable. Please try again in a moment.");
    }
    throw new ApiError(502, "The chat service could not complete this reply. Please try again.");
  }

  const blocked =
    payload?.promptFeedback?.blockReason ||
    payload?.candidates?.[0]?.finishReason === "SAFETY";
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    if (blocked) {
      throw new ApiError(400, "This message could not be answered. Please rephrase it.");
    }
    throw new ApiError(502, "The chat service returned an empty reply. Please try again.");
  }

  return text.length > MAX_STORED_REPLY_CHARS ? text.slice(0, MAX_STORED_REPLY_CHARS) : text;
};
