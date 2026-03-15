import { generateText, Output } from "ai";
import { isConcept, conceptSchema } from "@/lib/hatlab";
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

    const { originalConcept, analysis, refinementPrompt, zoneHint } = await req.json();

    if (!isConcept(originalConcept) || typeof refinementPrompt !== "string" || !refinementPrompt.trim()) {
      return jsonError("Missing required refinement fields.", {
        retryable: false,
        status: 400,
      });
    }

    const prompt = `
Given the following original dad hat concept and its visual DNA analysis, refine the concept based on the user's request.

Original Concept:
${JSON.stringify(originalConcept)}

Visual DNA Analysis:
${JSON.stringify(analysis)}

User Refinement Request: "${refinementPrompt}"${zoneHint ? `\nArea of focus on the hat: ${zoneHint}` : ""}

Translate this request into an updated embroidery-safe dad hat concept.
Keep the output concise and interface-ready:
- name: 1-2 words
- style: 1-2 words
- rationale: max 6 words`;

    const { output } = await generateText({
      model: TEXT_MODEL,
      output: Output.object({ schema: conceptSchema }),
      prompt,
    });

    if (!output) {
      throw new Error("Model returned no structured output.");
    }

    return jsonSuccess(output);
  } catch (error) {
    console.error("Refinement error:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to refine concept.",
      {
        details: ["Concept refinement failed."],
        status: 502,
      },
    );
  }
}
