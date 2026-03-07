import { generateJsonWithRetry } from "@/lib/gemini";
import {
  getInlineImageParts,
  isResultsData,
} from "@/lib/hatlab";
import { jsonError, jsonSuccess } from "@/lib/hatlab-server";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return jsonError("GEMINI_API_KEY is not configured on the server.", {
        retryable: false,
        status: 500,
      });
    }

    const body = await req.json();
    const rawImages: string[] = Array.isArray(body.images)
      ? body.images
      : typeof body.image === "string"
        ? [body.image]
        : [];

    const images = rawImages
      .filter((entry): entry is string => typeof entry === "string")
      .slice(0, 4);

    if (!images.length) {
      return jsonError("No image provided.", {
        retryable: false,
        status: 400,
      });
    }

    const prompt = `You are a hat design expert. Analyze these reference images and extract their shared visual DNA. Then generate 3 distinct embroidery-safe dad hat concepts based on them.

Keep the concepts concise and interface-ready:
- concept names: 1-2 words
- style: 1-2 words only
- rationale: max 6 words

Return ONLY valid JSON matching this exact schema (no extra text):
{
  "analysis": {
    "visual_summary": "One sentence summary of the image vibe",
    "palette": ["hex or color name 1", "hex or color name 2", "hex or color name 3"],
    "symbols": ["main element 1", "main element 2"],
    "style_keywords": ["keyword1", "keyword2", "keyword3"],
    "hat_design_opportunities": ["idea1", "idea2"]
  },
  "concepts": [
    {
      "name": "Minimal",
      "base_colour": "a specific color like 'cream', 'black', 'navy', 'forest green' or hex code",
      "front_design": "VERY SPECIFIC embroidery description: e.g. 'small centered coffee cup icon in dark brown thread with curved text BREW below it'",
      "palette": ["color1", "color2"],
      "style": "minimal",
      "rationale": "Simple and easy to wear"
    },
    {
      "name": "Streetwear",
      "base_colour": "a specific color",
      "front_design": "VERY SPECIFIC embroidery description",
      "palette": ["color1", "color2"],
      "style": "graphic",
      "rationale": "Stronger presence on hat"
    },
    {
      "name": "Premium Merch",
      "base_colour": "a specific color",
      "front_design": "VERY SPECIFIC embroidery description",
      "palette": ["color1", "color2"],
      "style": "premium",
      "rationale": "Feels polished and elevated"
    }
  ]
}`;

    const parsed = await generateJsonWithRetry({
      model: "gemini-3.1-flash-lite-preview",
      contents: [prompt, ...getInlineImageParts(images)],
      guard: isResultsData,
      temperature: 0.7,
    });

    return jsonSuccess(parsed);
  } catch (error) {
    console.error("Gemini concept generation error:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to generate concepts.",
      {
        details: ["Concept generation failed after retry."],
        status: 502,
      },
    );
  }
}
