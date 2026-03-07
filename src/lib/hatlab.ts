export interface Concept {
  name: string;
  base_colour: string;
  front_design: string;
  palette: string[];
  style: string;
  rationale: string;
}

export interface AnalysisData {
  visual_summary: string;
  palette: string[];
  symbols: string[];
  style_keywords: string[];
  hat_design_opportunities: string[];
}

export interface ResultsData {
  analysis: AnalysisData;
  concepts: Concept[];
}

export type AsyncStatus = "idle" | "loading" | "ready" | "error";

export interface RouteErrorPayload {
  message: string;
  retryable: boolean;
  details?: string[];
}

export interface RouteSuccess<T> {
  ok: true;
  data: T;
}

export interface RouteFailure {
  ok: false;
  error: RouteErrorPayload;
}

export type RouteResponse<T> = RouteSuccess<T> | RouteFailure;

export async function parseApiResponse<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as RouteResponse<T> | null;

  if (!payload) {
    throw new Error("The server returned an unreadable response.");
  }

  if (!payload.ok) {
    throw new Error(payload.error.message);
  }

  return payload.data;
}

export function toDataUrl(imageData: string, mimeType = "image/png") {
  if (imageData.startsWith("data:")) {
    return imageData;
  }

  return `data:${mimeType};base64,${imageData}`;
}

export function getInlineImageParts(images: string[]) {
  return images.map((img) => {
    const commaIndex = img.indexOf(",");
    const mimeStart = img.indexOf(":");
    const mimeEnd = img.indexOf(";");

    return {
      inlineData: {
        data: commaIndex >= 0 ? img.slice(commaIndex + 1) : img,
        mimeType:
          mimeStart >= 0 && mimeEnd > mimeStart
            ? img.slice(mimeStart + 1, mimeEnd)
            : "image/jpeg",
      },
    };
  });
}

export function isConcept(candidate: unknown): candidate is Concept {
  if (!candidate || typeof candidate !== "object") return false;
  const value = candidate as Partial<Concept>;

  return (
    typeof value.name === "string" &&
    typeof value.base_colour === "string" &&
    typeof value.front_design === "string" &&
    Array.isArray(value.palette) &&
    value.palette.every((entry) => typeof entry === "string") &&
    typeof value.style === "string" &&
    typeof value.rationale === "string"
  );
}

export function isResultsData(candidate: unknown): candidate is ResultsData {
  if (!candidate || typeof candidate !== "object") return false;
  const value = candidate as Partial<ResultsData>;
  const analysis = value.analysis as Partial<AnalysisData> | undefined;

  return (
    !!analysis &&
    typeof analysis.visual_summary === "string" &&
    Array.isArray(analysis.palette) &&
    Array.isArray(analysis.symbols) &&
    Array.isArray(analysis.style_keywords) &&
    Array.isArray(analysis.hat_design_opportunities) &&
    Array.isArray(value.concepts) &&
    value.concepts.every(isConcept)
  );
}

export function parseGeminiJson<T>(
  text: string | undefined,
  guard: (value: unknown) => value is T,
) {
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  const parsed = JSON.parse(text);
  if (!guard(parsed)) {
    throw new Error("Gemini returned a response with an unexpected shape.");
  }

  return parsed;
}
