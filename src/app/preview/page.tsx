"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PreviewPage() {
  const router = useRouter();

  useEffect(() => {
    const stored = sessionStorage.getItem("hatlab-image");
    router.replace(stored ? "/results" : "/");
  }, [router]);

  return null;
}
