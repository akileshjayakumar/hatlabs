import { GoogleGenAI } from "@google/genai";

export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const DEFAULT_IMAGE_MIME_TYPE = "image/png";

type GenerateContentResponse = Awaited<ReturnType<typeof ai.models.generateContent>>;

export async function generateJsonWithRetry<T>(options: {
  model: string;
  contents: unknown;
  guard: (value: unknown) => value is T;
  temperature?: number;
}) {
  const attempts = [
    options.contents,
    Array.isArray(options.contents)
      ? [
          ...options.contents,
          "Return ONLY valid JSON that matches the requested schema exactly.",
        ]
      : `${String(options.contents)}\n\nReturn ONLY valid JSON that matches the requested schema exactly.`,
  ];

  let lastError: Error | null = null;

  for (const prompt of attempts) {
    try {
      const response = await ai.models.generateContent({
        model: options.model,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        contents: prompt as any,
        config: {
          responseMimeType: "application/json",
          temperature: options.temperature ?? 0.5,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Gemini returned an empty response.");
      }

      const parsed = JSON.parse(text);
      if (!options.guard(parsed)) {
        throw new Error("Gemini returned a response with an unexpected shape.");
      }

      return parsed;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown Gemini JSON error");
    }
  }

  throw lastError ?? new Error("Failed to generate JSON.");
}

export function extractGeminiImage(response: GenerateContentResponse) {
  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.data) {
        return {
          imageData: part.inlineData.data,
          mimeType: part.inlineData.mimeType || DEFAULT_IMAGE_MIME_TYPE,
        };
      }
    }
  }

  if (response.data) {
    return {
      imageData: response.data,
      mimeType: DEFAULT_IMAGE_MIME_TYPE,
    };
  }

  return null;
}

export function describeGeminiFailure(response: GenerateContentResponse) {
  const reasons: string[] = [];
  const promptBlockReason = response.promptFeedback?.blockReason;

  if (promptBlockReason) {
    reasons.push(`blocked: ${promptBlockReason}`);
  }

  for (const [idx, candidate] of (response.candidates ?? []).entries()) {
    if (candidate.finishReason) {
      reasons.push(`candidate ${idx + 1} finish: ${candidate.finishReason}`);
    }
  }

  const text = response.text?.replace(/\s+/g, " ").trim();
  if (text) {
    reasons.push(`text: ${text.slice(0, 160)}`);
  }

  return reasons.length > 0 ? reasons.join("; ") : "no image returned";
}
