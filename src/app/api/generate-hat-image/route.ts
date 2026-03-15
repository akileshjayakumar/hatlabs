import { generateText } from "ai";
import { jsonError, jsonSuccess } from "@/lib/hatlab-server";

export const maxDuration = 60;

const IMAGE_MODEL = "google/gemini-2.5-flash-image";

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
    if (!process.env.AI_GATEWAY_API_KEY) {
      return jsonError("AI_GATEWAY_API_KEY is not configured on the server.", {
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

    const result = await generateText({
      model: IMAGE_MODEL,
      prompt,
    });

    const imageFile = result.files.find((f) =>
      f.mediaType?.startsWith("image/"),
    );

    if (imageFile) {
      return jsonSuccess({
        imageData: imageFile.base64,
        mimeType: imageFile.mediaType || "image/png",
        background: randomBg,
        model: IMAGE_MODEL,
      });
    }

    return jsonError(
      "Image generation did not return an image for this concept.",
      { status: 502 },
    );
  } catch (error) {
    console.error("Hat image generation error:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to generate hat image.",
      { status: 500 },
    );
  }
}
