import { z } from "zod";

export const conceptSchema = z.object({
  name: z.string(),
  base_colour: z.string(),
  front_design: z.string(),
  palette: z.array(z.string()),
  style: z.string(),
  rationale: z.string(),
});

export const analysisDataSchema = z.object({
  visual_summary: z.string(),
  palette: z.array(z.string()),
  symbols: z.array(z.string()),
  style_keywords: z.array(z.string()),
  hat_design_opportunities: z.array(z.string()),
});

export const resultsDataSchema = z.object({
  analysis: analysisDataSchema,
  concepts: z.array(conceptSchema),
});

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

