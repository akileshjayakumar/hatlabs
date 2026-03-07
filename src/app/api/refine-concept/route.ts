import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { originalConcept, analysis, refinementPrompt, zoneHint } = await req.json();

    if (!originalConcept || !refinementPrompt) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
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

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Gemini API Error:", error);
    return NextResponse.json(
      { error: "Failed to refine concept." },
      { status: 500 },
    );
  }
}
