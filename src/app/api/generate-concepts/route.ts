import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Accept either a single `image` string or an `images` array
    const rawImages: string[] = body.images
      ? body.images
      : body.image
        ? [body.image]
        : [];

    if (!rawImages.length) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const imageparts = rawImages.map((img: string) => ({
      inlineData: {
        data: img.substring(img.indexOf(",") + 1),
        mimeType: img.substring(img.indexOf(":") + 1, img.indexOf(";")),
      },
    }));

    const prompt = `You are a hat design expert. Analyze this image and extract its visual DNA. Then generate 3 distinct embroidery-safe dad hat concepts based on it.

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

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: [prompt, ...imageparts],
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
      { error: "Failed to generate concepts." },
      { status: 500 },
    );
  }
}
