import { NextResponse } from "next/server";
import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const maxDuration = 60;
const MODEL = "gemini-3.1-flash-image-preview";
const DEFAULT_IMAGE_MIME_TYPE = "image/png";

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
    const {
      hatImage,
      hatMimeType,
      conceptName,
      baseColour,
      frontDesign,
      palette,
      style,
    } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured on the server." },
        { status: 500 },
      );
    }

    if (!hatImage || !hatMimeType) {
      return NextResponse.json(
        { error: "Missing hat image for 3D render generation." },
        { status: 400 },
      );
    }

    const prompt = `Use the supplied hat image as the exact reference product.

Create a single photorealistic 3D product render of the very same dad hat.
Concept name: ${conceptName || "custom dad hat"}

Hard requirements:
- Preserve the exact custom embroidery/artwork from the reference image
- Preserve the exact hat silhouette, brim curve, crown structure, seam placement, top button, and fabric color
- Preserve the design identity: ${frontDesign}
- Preserve the concept styling: ${style || "clean streetwear"}
- Preserve the palette: ${palette?.join(", ") || baseColour}
- Keep it as a dad hat product render, not a reinterpretation
- Show a realistic 3/4 front product angle
- Use a clean warm beige studio background that matches a sandy app background
- Add only a subtle contact shadow
- No props, hands, mannequin, text overlays, logos outside the hat, or extra objects

Goal:
Return one high-fidelity 3D-looking product render of the user's exact designed hat.`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        prompt,
        {
          inlineData: {
            data: hatImage,
            mimeType: hatMimeType,
          },
        },
      ],
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    const image = extractGeminiImage(response);
    if (!image) {
      return NextResponse.json(
        {
          error:
            "3D render generation did not return an image. Try again with a different design or prompt.",
          details: `${MODEL}: ${describeGeminiFailure(response)}`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      imageData: image.imageData,
      mimeType: image.mimeType,
      model: MODEL,
    });
  } catch (error) {
    console.error("Hat 3D render generation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate 3D render.",
      },
      { status: 500 },
    );
  }
}
