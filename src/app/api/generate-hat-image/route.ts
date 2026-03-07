import { Modality } from "@google/genai";
import { ai, describeGeminiFailure, extractGeminiImage } from "@/lib/gemini";
import { jsonError, jsonSuccess } from "@/lib/hatlab-server";

export const maxDuration = 60;

const GEMINI_IMAGE_MODELS = [
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image-preview",
] as const;

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

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return jsonError("GEMINI_API_KEY is not configured on the server.", {
        retryable: false,
        status: 500,
      });
    }

    const { conceptName, baseColour, frontDesign, palette, style, anglePrompt } =
      await req.json();

    if (typeof frontDesign !== "string" || typeof baseColour !== "string") {
      return jsonError("Missing required image-generation fields.", {
        retryable: false,
        status: 400,
      });
    }

    const randomBg =
      PASTEL_BACKGROUNDS[Math.floor(Math.random() * PASTEL_BACKGROUNDS.length)];

    const cameraLine =
      typeof anglePrompt === "string" && anglePrompt.length > 0
        ? anglePrompt
        : "Hat placed on an invisible surface, slightly angled to show front and side profile (3/4 view)";

    const prompt = `Photorealistic product photography of a single dad hat (baseball cap, dad hat style with unstructured crown, curved brim, adjustable strap at back).

Hat details:
- Hat color: ${baseColour}
- Front embroidery/design: ${frontDesign}
- Color palette used: ${Array.isArray(palette) ? palette.join(", ") : baseColour}
- Style: ${typeof style === "string" ? style : "clean streetwear"}
- Concept name: ${typeof conceptName === "string" ? conceptName : "HatLab concept"}

Photography style:
- Clean, bright studio shot
- ${cameraLine}
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
          return jsonSuccess({
            imageData: image.imageData,
            mimeType: image.mimeType,
            background: randomBg,
            model,
          });
        }

        attemptErrors.push(`${model}: ${describeGeminiFailure(response)}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown Gemini image error";
        attemptErrors.push(`${model}: ${message}`);
      }
    }

    return jsonError(
      "Image generation did not return an image for this concept.",
      {
        details: attemptErrors,
        status: 502,
      },
    );
  } catch (error) {
    console.error("Hat image generation error:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to generate hat image.",
      { status: 500 },
    );
  }
}
