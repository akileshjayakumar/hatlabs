import { NextResponse } from "next/server";
import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const maxDuration = 60;
const GEMINI_IMAGE_MODELS = [
  "gemini-3.1-flash-image-preview", // Nano Banana 2 — primary
  "gemini-3-pro-image-preview", // Nano Banana Pro — fallback only
] as const;
const DEFAULT_IMAGE_MIME_TYPE = "image/png";

const PASTEL_BACKGROUNDS = [
  "soft lavender pastel",
  "mint green pastel",
  "blush pink pastel",
  "pale peach pastel",
  "baby blue pastel",
  "butter yellow pastel",
  "sage green pastel",
  "lilac purple pastel",
];

type GenerateContentResponse = Awaited<
  ReturnType<typeof ai.models.generateContent>
>;

function extractGeminiImage(response: GenerateContentResponse) {
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

function describeGeminiFailure(response: GenerateContentResponse) {
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

export async function POST(req: Request) {
  try {
    const { conceptName, baseColour, frontDesign, palette, style } =
      await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured on the server." },
        { status: 500 },
      );
    }

    if (!frontDesign || !baseColour) {
      return NextResponse.json(
        { error: "Missing required image-generation fields." },
        { status: 400 },
      );
    }

    const randomBg =
      PASTEL_BACKGROUNDS[Math.floor(Math.random() * PASTEL_BACKGROUNDS.length)];

    const prompt = `Photorealistic product photography of a single dad hat (baseball cap, dad hat style with unstructured crown, curved brim, adjustable strap at back).

Hat details:
- Hat color: ${baseColour}
- Front embroidery/design: ${frontDesign}
- Color palette used: ${palette?.join(", ") || baseColour}
- Style: ${style || "clean streetwear"}
- Concept name: ${conceptName}

Photography style:
- Clean, bright studio shot
- Hat placed on an invisible surface, slightly angled to show front and side profile (3/4 view)
- Background: solid flat ${randomBg} background, completely uniform
- Soft shadow underneath the hat
- High detail, sharp embroidery visible on front panel
- Professional product photography lighting
- No text or labels except on the hat itself
- No hands, no mannequin, just the hat`;

    const attemptErrors: string[] = [];

    for (const model of GEMINI_IMAGE_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseModalities: [Modality.IMAGE],
          },
        });

        const image = extractGeminiImage(response);

        if (image) {
          return NextResponse.json({
            imageData: image.imageData,
            mimeType: image.mimeType,
            background: randomBg,
            model,
          });
        }

        attemptErrors.push(`${model}: ${describeGeminiFailure(response)}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown Gemini error";
        attemptErrors.push(`${model}: ${message}`);
      }
    }

    return NextResponse.json(
      {
        error:
          "Image generation did not return an image for this concept. Check model access or try refining the prompt.",
        details: attemptErrors,
      },
      { status: 502 },
    );
  } catch (error) {
    console.error("Hat image generation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate hat image.",
      },
      { status: 500 },
    );
  }
}
