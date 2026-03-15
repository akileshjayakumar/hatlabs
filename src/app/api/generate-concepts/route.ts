import { generateText, Output } from "ai";
import { resultsDataSchema } from "@/lib/hatlab";
import { jsonError, jsonSuccess } from "@/lib/hatlab-server";

export const maxDuration = 60;

const TEXT_MODEL = "google/gemini-2.5-flash";

export async function POST(req: Request) {
  try {
    if (!process.env.AI_GATEWAY_API_KEY) {
      return jsonError("AI_GATEWAY_API_KEY is not configured on the server.", {
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
- rationale: max 6 words`;

    const { output } = await generateText({
      model: TEXT_MODEL,
      output: Output.object({ schema: resultsDataSchema }),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...images.map((img) => ({ type: "image" as const, image: img })),
          ],
        },
      ],
    });

    if (!output) {
      throw new Error("Model returned no structured output.");
    }

    return jsonSuccess(output);
  } catch (error) {
    console.error("Concept generation error:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to generate concepts.",
      {
        details: ["Concept generation failed."],
        status: 502,
      },
    );
  }
}
