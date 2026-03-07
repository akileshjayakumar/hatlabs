import { generateJsonWithRetry } from "@/lib/gemini";
import { Concept, isConcept } from "@/lib/hatlab";
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

Translate this request into an updated embroidery-safe dad hat concept. Ensure you only return valid JSON.
Keep the output concise and interface-ready:
- name: 1-2 words
- style: 1-2 words
- rationale: max 6 words

Schema:
{
  "name": "Updated Concept Name",
  "base_colour": "hex code or basic colour name",
  "front_design": "Description of the front embroidery",
  "palette": ["colour1", "colour2"],
  "style": "Short style description",
  "rationale": "Short wearable reason"
}
`;

    const parsed: Concept = await generateJsonWithRetry({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
      guard: isConcept,
      temperature: 0.7,
    });

    return jsonSuccess(parsed);
  } catch (error) {
    console.error("Gemini refinement error:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to refine concept.",
      {
        details: ["Concept refinement failed after retry."],
        status: 502,
      },
    );
  }
}
