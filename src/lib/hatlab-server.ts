import { NextResponse } from "next/server";
import { RouteFailure, RouteSuccess } from "@/lib/hatlab";

export function jsonSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<RouteSuccess<T>>({ ok: true, data }, init);
}

export function jsonError(
  message: string,
  options?: {
    details?: string[];
    retryable?: boolean;
    status?: number;
  },
) {
  return NextResponse.json<RouteFailure>(
    {
      ok: false,
      error: {
        message,
        retryable: options?.retryable ?? true,
        details: options?.details,
      },
    },
    { status: options?.status ?? 500 },
  );
}
