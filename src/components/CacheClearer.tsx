"use client";
import { useEffect } from "react";

export default function CacheClearer() {
  useEffect(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type === "reload") {
      sessionStorage.removeItem("hatlab-image");
      sessionStorage.removeItem("hatlab-images");
      sessionStorage.removeItem("hatlab-concepts");
    }
  }, []);
  return null;
}
