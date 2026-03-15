"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Download, Loader2, Palette, Pencil, RefreshCw, RotateCw, Send } from "lucide-react";
import dynamic from "next/dynamic";
import {
  AnalysisData,
  AsyncStatus,
  Concept,
  ResultsData,
  parseApiResponse,
} from "@/lib/hatlab";
import type { AngleImage } from "@/components/HatAngleViewer";

const HatPhotoViewer = dynamic(() => import("@/components/HatPhotoViewer"), {
  ssr: false,
});

const HatAngleViewer = dynamic(() => import("@/components/HatAngleViewer"), {
  ssr: false,
});

const PASTEL_MAP: Record<string, string> = {
  "soft lavender pastel": "#e8d5f5",
  "mint green pastel": "#c8f5e8",
  "blush pink pastel": "#f5d5e4",
  "pale peach pastel": "#f5e0c8",
  "baby blue pastel": "#c8e4f5",
  "butter yellow pastel": "#f5f0c0",
  "sage green pastel": "#c8d8c0",
  "lilac purple pastel": "#d8c8f0",
};

const THINKING_STEPS = [
  "Scanning photo composition...",
  "Extracting distinct color palette...",
  "Identifying core style elements...",
  "Generating design opportunities...",
  "Finalizing dad hat concepts...",
  "Rendering your hat visuals...",
];

const PRESET_CHIPS = ["Minimal", "Bolder", "Premium", "Playful"];

const HAT_NEUTRALS = [
  { hex: "#1a1a1a", name: "black" },
  { hex: "#f5f5f0", name: "white" },
  { hex: "#1a2744", name: "navy" },
  { hex: "#f0e6c8", name: "cream" },
  { hex: "#4a5a3a", name: "olive" },
  { hex: "#c4a882", name: "tan" },
];

type Phase = "loading" | "gallery" | "studio";
type StudioPanel = "colors" | "edit" | "preview3d" | null;

interface ImageState {
  status: AsyncStatus;
  imageData?: string;
  mimeType?: string;
  background?: string;
  error?: string;
  generatedBaseColour?: string;
}

interface ConceptView extends Concept {
  image: ImageState;
}

interface ResultsViewData {
  analysis: AnalysisData;
  concepts: ConceptView[];
}

function createIdleImageState(): ImageState {
  return { status: "idle" };
}

function hydrateResults(data: ResultsData): ResultsViewData {
  return {
    ...data,
    concepts: data.concepts.map((concept) => ({
      ...concept,
      image: createIdleImageState(),
    })),
  };
}

function toPersistedResults(data: ResultsViewData): ResultsData {
  return {
    analysis: data.analysis,
    concepts: data.concepts.map((concept) => ({
      name: concept.name,
      base_colour: concept.base_colour,
      front_design: concept.front_design,
      palette: concept.palette,
      style: concept.style,
      rationale: concept.rationale,
    })),
  };
}

export default function ResultsPage() {
  const router = useRouter();
  const [data, setData] = useState<ResultsViewData | null>(null);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [activeIdx, setActiveIdx] = useState(0);
  const [isGeneratingConcepts, setIsGeneratingConcepts] = useState(false);
  const [conceptError, setConceptError] = useState<string | null>(null);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [isRefining, setIsRefining] = useState(false);
  const [refineText, setRefineText] = useState("");
  const [activePanel, setActivePanel] = useState<StudioPanel>(null);
  const [editCircle, setEditCircle] = useState<{ zone: string } | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [angleImages, setAngleImages] = useState<Record<number, AngleImage[]>>({});

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }, []);

  const galleryRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<ResultsViewData | null>(null);
  const requestVersionsRef = useRef<Record<number, number>>({});
  const angleImagesRef = useRef<Record<number, AngleImage[]>>({});
  const isGeneratingAnglesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    angleImagesRef.current = angleImages;
  }, [angleImages]);

  const saveSlimResults = useCallback((nextData: ResultsViewData) => {
    try {
      sessionStorage.setItem(
        "hatlab-concepts",
        JSON.stringify(toPersistedResults(nextData)),
      );
    } catch {
      // Ignore quota failures. The live state still works.
    }
  }, []);

  const updateConceptImage = useCallback(
    (idx: number, image: ImageState) => {
      setData((prev) => {
        if (!prev || !prev.concepts[idx]) return prev;
        const next = { ...prev, concepts: [...prev.concepts] };
        next.concepts[idx] = { ...next.concepts[idx], image };
        return next;
      });
    },
    [],
  );

  const generateHatImageForConcept = useCallback(
    async (idx: number, options?: { force?: boolean }) => {
      const current = dataRef.current;
      const concept = current?.concepts[idx];
      if (!concept) return;

      if (!options?.force && (concept.image.status === "loading" || concept.image.status === "ready")) {
        return;
      }

      const requestVersion = (requestVersionsRef.current[idx] ?? 0) + 1;
      requestVersionsRef.current[idx] = requestVersion;
      updateConceptImage(idx, { status: "loading" });

      try {
        const response = await fetch("/api/generate-hat-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conceptName: concept.name,
            baseColour: concept.base_colour,
            frontDesign: concept.front_design,
            palette: concept.palette,
            style: concept.style,
          }),
        });

        const imageResult = await parseApiResponse<{
          imageData: string;
          mimeType: string;
          background: string;
        }>(response);

        if (requestVersionsRef.current[idx] !== requestVersion) {
          return;
        }

        updateConceptImage(idx, {
          status: "ready",
          imageData: imageResult.imageData,
          mimeType: imageResult.mimeType,
          background: imageResult.background,
          generatedBaseColour: concept.base_colour,
        });
      } catch (error) {
        if (requestVersionsRef.current[idx] !== requestVersion) {
          return;
        }

        updateConceptImage(idx, {
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "Image generation failed.",
        });
      }
    },
    [updateConceptImage],
  );

  const ANGLE_PROMPTS = [
    null, // angle 0 = front, reuse existing concept image
    "Hat placed on an invisible surface viewed at a 45-degree angle from the front-right, showing the right side of the brim and front panel design",
    "Hat placed on an invisible surface shown from the pure right side in a clean profile view at 90 degrees",
    "Hat placed on an invisible surface shown from directly behind, revealing the back of the crown and the adjustable strap",
    "Hat placed on an invisible surface shown from the pure left side in a clean profile view at 90 degrees",
    "Hat placed on an invisible surface viewed at a 45-degree angle from the front-left, showing the left side of the brim and front panel design",
  ];

  const generateAnglesForConcept = useCallback(
    async (conceptIdx: number) => {
      if (isGeneratingAnglesRef.current.has(conceptIdx)) return;

      const concept = dataRef.current?.concepts[conceptIdx];
      if (!concept?.image.imageData) return;

      // Already fully generated
      const existing = angleImagesRef.current[conceptIdx];
      if (
        existing?.length === 6 &&
        existing.every((a) => a.status === "ready" || a.status === "error")
      )
        return;

      isGeneratingAnglesRef.current.add(conceptIdx);

      const initial: AngleImage[] = [
        { status: "ready", imageData: concept.image.imageData, mimeType: concept.image.mimeType },
        { status: "loading" },
        { status: "loading" },
        { status: "loading" },
        { status: "loading" },
        { status: "loading" },
      ];
      setAngleImages((prev) => ({ ...prev, [conceptIdx]: initial }));

      const anglePromises = ANGLE_PROMPTS.slice(1).map(async (anglePrompt, i) => {
        const angleIdx = i + 1;
        try {
          const response = await fetch("/api/generate-hat-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conceptName: concept.name,
              baseColour: concept.base_colour,
              frontDesign: concept.front_design,
              palette: concept.palette,
              style: concept.style,
              anglePrompt,
            }),
          });
          const result = await parseApiResponse<{
            imageData: string;
            mimeType: string;
            background: string;
          }>(response);
          setAngleImages((prev) => {
            const arr = prev[conceptIdx] ? [...prev[conceptIdx]] : [...initial];
            arr[angleIdx] = { status: "ready", imageData: result.imageData, mimeType: result.mimeType };
            return { ...prev, [conceptIdx]: arr };
          });
        } catch (error) {
          setAngleImages((prev) => {
            const arr = prev[conceptIdx] ? [...prev[conceptIdx]] : [...initial];
            arr[angleIdx] = {
              status: "error",
              error: error instanceof Error ? error.message : "Generation failed.",
            };
            return { ...prev, [conceptIdx]: arr };
          });
        }
      });

      await Promise.allSettled(anglePromises);
      isGeneratingAnglesRef.current.delete(conceptIdx);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const clearAnglesForConcept = useCallback((idx: number) => {
    isGeneratingAnglesRef.current.delete(idx);
    setAngleImages((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  }, []);

  const generateConceptsFromImage = useCallback(
    async (image: string) => {
      setThinkingStep(0);
      setConceptError(null);
      setIsGeneratingConcepts(true);

      try {
        const storedImages = sessionStorage.getItem("hatlab-images");
        const images: string[] = storedImages ? JSON.parse(storedImages) : [image];
        const response = await fetch("/api/generate-concepts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images }),
        });
        const parsed = await parseApiResponse<ResultsData>(response);
        const hydrated = hydrateResults(parsed);
        setActiveIdx(0);
        setData(hydrated);
        saveSlimResults(hydrated);
        setPhase("gallery");
      } catch (error) {
        setConceptError(
          error instanceof Error ? error.message : "Failed to analyze image.",
        );
      } finally {
        setIsGeneratingConcepts(false);
      }
    },
    [saveSlimResults],
  );

  useEffect(() => {
    const init = async () => {
      const storedImage = sessionStorage.getItem("hatlab-image");
      const rawData = sessionStorage.getItem("hatlab-concepts");

      if (storedImage) {
        setSourceImage(storedImage);
      }

      if (rawData) {
        try {
          const parsed: ResultsData = JSON.parse(rawData);
          const hydrated = hydrateResults(parsed);
          setData(hydrated);
          setPhase("gallery");
          return;
        } catch {
          sessionStorage.removeItem("hatlab-concepts");
        }
      }

      if (storedImage) {
        await generateConceptsFromImage(storedImage);
        return;
      }

      router.replace("/");
    };

    void init();
  }, [generateConceptsFromImage, router]);

  useEffect(() => {
    if (!data || phase === "loading") return;

    void generateHatImageForConcept(activeIdx);
    data.concepts.forEach((concept, idx) => {
      if (idx !== activeIdx && concept.image.status === "idle") {
        void generateHatImageForConcept(idx);
      }
    });
  }, [activeIdx, data, generateHatImageForConcept, phase]);

  useEffect(() => {
    if (isGeneratingConcepts) {
      const timings = [1800, 3500, 5500, 8000];
      const timeouts = timings.map((time) =>
        setTimeout(() => {
          setThinkingStep((prev) =>
            Math.min(prev + 1, THINKING_STEPS.length - 1),
          );
        }, time),
      );

      return () => timeouts.forEach(clearTimeout);
    }
  }, [isGeneratingConcepts]);

  useEffect(() => {
    if (!data || isGeneratingConcepts) return;
    if (data.concepts.some((concept) => concept.image.status === "loading")) {
      setThinkingStep(THINKING_STEPS.length - 1);
    }
  }, [data, isGeneratingConcepts]);

  useEffect(() => {
    if (phase !== "gallery") return;
    const container = galleryRef.current;
    if (!container) return;

    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const center = containerRect.left + containerRect.width / 2;
      const cards = container.querySelectorAll("[data-concept-card]");
      let closestIdx = 0;
      let closestDist = Infinity;

      cards.forEach((card, idx) => {
        const rect = card.getBoundingClientRect();
        const cardCenter = rect.left + rect.width / 2;
        const dist = Math.abs(cardCenter - center);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = idx;
        }
      });

      setActiveIdx(closestIdx);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [phase]);

  useEffect(() => {
    if (phase !== "gallery" || !galleryRef.current) return;
    const cards = galleryRef.current.querySelectorAll(
      "[data-concept-card]",
    ) as NodeListOf<HTMLElement>;
    const card = cards[activeIdx];

    if (card) {
      card.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeIdx, phase]);

  const handleRetryConcepts = useCallback(() => {
    if (!sourceImage || isGeneratingConcepts) return;
    void generateConceptsFromImage(sourceImage);
  }, [generateConceptsFromImage, isGeneratingConcepts, sourceImage]);

  const handleRetryImage = useCallback(
    (idx: number) => {
      void generateHatImageForConcept(idx, { force: true });
    },
    [generateHatImageForConcept],
  );

  const handleDownload = useCallback((idx: number) => {
    const concept = dataRef.current?.concepts[idx];
    if (!concept || concept.image.status !== "ready" || !concept.image.imageData)
      return;

    const link = document.createElement("a");
    link.href = `data:${concept.image.mimeType || "image/png"};base64,${concept.image.imageData}`;
    link.download = `${concept.name.toLowerCase().replace(/\s+/g, "-")}-hat.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleRefine = useCallback(
    async (promptText: string, zoneHint?: string) => {
      if (!promptText.trim() || !dataRef.current || isRefining) return;

      setIsRefining(true);
      const current = dataRef.current;
      const concept = current?.concepts[activeIdx];
      if (!current || !concept) {
        setIsRefining(false);
        return;
      }

      try {
        const response = await fetch("/api/refine-concept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalConcept: {
              name: concept.name,
              base_colour: concept.base_colour,
              front_design: concept.front_design,
              palette: concept.palette,
              style: concept.style,
              rationale: concept.rationale,
            },
            analysis: current.analysis,
            refinementPrompt: promptText,
            ...(zoneHint ? { zoneHint } : {}),
          }),
        });

        const refined = await parseApiResponse<Concept>(response);
        const next = {
          ...current,
          concepts: [...current.concepts],
        };

        next.concepts[activeIdx] = {
          ...refined,
          image: createIdleImageState(),
        };

        setData(next);
        saveSlimResults(next);
        setRefineText("");
        setEditPrompt("");
        setEditCircle(null);
        clearAnglesForConcept(activeIdx);
        void generateHatImageForConcept(activeIdx, { force: true });
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Failed to refine concept.");
      } finally {
        setIsRefining(false);
      }
    },
    [activeIdx, clearAnglesForConcept, generateHatImageForConcept, isRefining, saveSlimResults, showToast],
  );

  const handleColorSelect = useCallback(
    (colorHex: string) => {
      const current = dataRef.current;
      if (!current) return;

      const next = {
        ...current,
        concepts: [...current.concepts],
      };

      next.concepts[activeIdx] = {
        ...next.concepts[activeIdx],
        base_colour: colorHex,
      };

      setData(next);
      saveSlimResults(next);
    },
    [activeIdx, saveSlimResults],
  );

  const handleCircleEditSubmit = useCallback(
    async (prompt: string) => {
      if (!editCircle || !prompt.trim()) return;
      setActivePanel(null);
      await handleRefine(prompt, editCircle.zone);
    },
    [editCircle, handleRefine],
  );

  const activeConcept = data?.concepts[activeIdx];
  const isActiveGenerating = activeConcept?.image.status === "loading";
  const busy = isGeneratingConcepts || isRefining || isActiveGenerating;

  const statusText = isGeneratingConcepts
    ? "Generating concepts…"
    : isRefining
      ? "Refining…"
      : activePanel === "preview3d"
        ? `${activeConcept?.name || "Hat"} · 360° View`
        : activeConcept?.name || "HatLab";

  if (phase === "loading" && conceptError) {
    return (
      <div
        className="relative flex h-full flex-col overflow-hidden"
        style={{ background: "var(--color-bg)", fontFamily: "var(--font-sans)" }}
      >
        <div className="absolute top-0 left-0 z-20 px-5 pt-14">
          <button
            onClick={() => router.push("/")}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(184,151,100,0.14)",
              border: "1.5px solid var(--color-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={17} />
          </button>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-start pt-[120px] px-5 pb-12 flex-1">
          {sourceImage ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ marginBottom: "28px" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sourceImage}
                alt="Uploaded inspiration"
                style={{
                  height: "128px",
                  width: "auto",
                  maxWidth: "180px",
                  objectFit: "cover",
                  borderRadius: "16px",
                  border: "1.5px solid var(--color-border)",
                }}
              />
            </motion.div>
          ) : null}

          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            style={{ width: "100%" }}
          >
            <p
              style={{
                fontSize: "0.68rem",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#c0392b",
                marginBottom: "10px",
              }}
            >
              Something went wrong
            </p>
            <h2
              style={{
                fontSize: "1.75rem",
                fontWeight: 800,
                fontStyle: "italic",
                lineHeight: 1.1,
                color: "var(--color-text)",
                marginBottom: "8px",
                fontFamily: "var(--font-serif)",
              }}
            >
              Couldn&apos;t build those concepts.
            </h2>
            <p
              style={{
                fontSize: "0.9rem",
                lineHeight: 1.55,
                color: "var(--color-text-muted)",
                marginBottom: "24px",
              }}
            >
              {conceptError}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                onClick={handleRetryConcepts}
                disabled={isGeneratingConcepts}
                className="btn-primary flex h-[52px] w-full items-center justify-center gap-2"
              >
                <RefreshCw
                  size={15}
                  className={isGeneratingConcepts ? "animate-spin" : ""}
                />
                Try Again
              </button>
              <button
                onClick={() => router.push("/")}
                style={{
                  height: "52px",
                  width: "100%",
                  borderRadius: "10px",
                  border: "1.5px solid var(--color-border)",
                  background: "var(--color-surface)",
                  color: "var(--color-text-muted)",
                  fontFamily: "var(--font-serif)",
                  fontWeight: 600,
                  fontStyle: "italic",
                  fontSize: "0.95rem",
                  cursor: "pointer",
                }}
              >
                Choose Another Photo
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div
        className="relative flex flex-col overflow-hidden"
        style={{
          background: "var(--color-bg)",
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 36px",
          }}
        >
          <motion.h1
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontWeight: 800,
              fontSize: "2.4rem",
              color: "var(--color-text)",
              letterSpacing: "-0.02em",
              marginBottom: "48px",
            }}
          >
            hatlab.
          </motion.h1>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "18px",
              width: "100%",
              maxWidth: "320px",
            }}
          >
            <AnimatePresence>
              {THINKING_STEPS.slice(0, thinkingStep + 1).map((step, idx) => {
                const isActive = idx === thinkingStep;
                return (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: -10, filter: "blur(4px)" }}
                    animate={{
                      opacity: isActive ? 1 : 0.3,
                      x: 0,
                      filter: "blur(0px)",
                    }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    style={{ display: "flex", alignItems: "center", gap: "14px" }}
                  >
                    <div
                      style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "16px",
                        height: "16px",
                        flexShrink: 0,
                      }}
                    >
                      {isActive ? (
                        <>
                          <Loader2
                            size={16}
                            className="animate-spin"
                            style={{ color: "var(--color-brand)" }}
                          />
                          <motion.div
                            animate={{
                              scale: [1, 1.5, 1],
                              opacity: [0.3, 0, 0.3],
                            }}
                            transition={{
                              duration: 1.6,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                            style={{
                              position: "absolute",
                              inset: 0,
                              borderRadius: "50%",
                              background: "var(--color-brand)",
                            }}
                          />
                        </>
                      ) : (
                        <div
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: "var(--color-brand)",
                          }}
                        />
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: "0.95rem",
                        color: isActive ? "var(--color-text)" : "var(--color-text-muted)",
                        fontWeight: isActive ? 600 : 400,
                        letterSpacing: "-0.01em",
                        lineHeight: 1.4,
                      }}
                    >
                      {step}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "gallery" && data) {
    const galleryActiveConcept = data.concepts[activeIdx];

    return (
      <motion.div
        key="gallery"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "var(--color-bg)",
          overflow: "hidden",
        }}
      >
        <div className="absolute top-0 left-0 z-20 px-5 pt-14">
          <button
            onClick={() => router.push("/")}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(184,151,100,0.14)",
              border: "1.5px solid var(--color-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={17} />
          </button>
        </div>
        <div style={{ padding: "52px 24px 16px", textAlign: "center" }}>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 800,
              fontStyle: "italic",
              fontSize: "1.9rem",
              color: "var(--color-text)",
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
            }}
          >
            Pick your vibe.
          </h1>
        </div>

        <div
          ref={galleryRef}
          className="gallery-scroll"
          style={{
            flex: 1,
            padding: "16px calc(50vw - 110px)",
          }}
        >
          {data.concepts.map((concept, idx) => {
            const bgColor =
              PASTEL_MAP[concept.image.background || ""] || "#f0e6d3";
            const isLoading =
              concept.image.status === "loading" ||
              concept.image.status === "idle";
            const hasError = concept.image.status === "error";

            return (
              <motion.div
                key={`${concept.name}-${idx}`}
                data-concept-card={idx}
                className="gallery-card"
                animate={{
                  scale: idx === activeIdx ? 1.04 : 0.9,
                  opacity: idx === activeIdx ? 1 : 0.65,
                }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                onClick={() => setActiveIdx(idx)}
                style={{
                  width: "220px",
                  height: "280px",
                  background: bgColor,
                  position: "relative",
                }}
              >
                {concept.image.status === "ready" && (
                  <button
                    aria-label={`Download ${concept.name} hat image`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(idx);
                    }}
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "12px",
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.25)",
                      backdropFilter: "blur(4px)",
                      border: "1px solid rgba(255,255,255,0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "rgba(0,0,0,0.6)",
                      cursor: "pointer",
                      zIndex: 10,
                    }}
                  >
                    <Download size={15} aria-hidden />
                  </button>
                )}
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: bgColor,
                    padding: "12px",
                    textAlign: "center",
                  }}
                >
                  {concept.image.status === "ready" &&
                  concept.image.imageData ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:${concept.image.mimeType || "image/png"};base64,${concept.image.imageData}`}
                      alt={concept.name}
                      style={{
                        width: "90%",
                        height: "90%",
                        objectFit: "contain",
                        display: "block",
                      }}
                    />
                  ) : hasError ? (
                    <div style={{ maxWidth: "180px" }}>
                      <p
                        style={{
                          fontSize: "0.86rem",
                          fontFamily: "var(--font-serif)",
                          fontStyle: "italic",
                          color: "var(--color-text)",
                        }}
                      >
                        Couldn&apos;t render this hat.
                      </p>
                      <p
                        style={{
                          marginTop: "8px",
                          fontSize: "0.72rem",
                          lineHeight: 1.5,
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {concept.image.error}
                      </p>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRetryImage(idx);
                        }}
                        className="chip-vintage"
                        style={{
                          marginTop: "14px",
                          padding: "8px 12px",
                        }}
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Loader2
                        size={36}
                        className="animate-spin"
                        style={{
                          color: "var(--color-brand)",
                          opacity: 0.45,
                          margin: "0 auto",
                        }}
                      />
                      <p
                        style={{
                          marginTop: "12px",
                          fontSize: "0.74rem",
                          color: "var(--color-text-muted)",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                        }}
                      >
                        {isLoading ? "Generating" : "Queued"}
                      </p>
                    </div>
                  )}
                </div>

              </motion.div>
            );
          })}
        </div>

        <div style={{ padding: "20px 24px 48px" }}>
          <button
            className="btn-primary"
            style={{
              width: "100%",
              height: "58px",
              fontSize: "1.1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
            onClick={() => {
              setActivePanel(null);
              setEditCircle(null);
              setPhase("studio");
            }}
          >
            {galleryActiveConcept?.image.status === "ready"
              ? "Design This One →"
              : "Open Studio →"}
          </button>
          <p
            style={{
              textAlign: "center",
              fontSize: "0.7rem",
              color: "var(--color-text-muted)",
              marginTop: "10px",
              letterSpacing: "0.04em",
            }}
          >
            swipe to compare · tap to select
          </p>
        </div>
      </motion.div>
    );
  }

  if (!data || !activeConcept) {
    return null;
  }

  const conceptSwatches = [
    { hex: activeConcept.base_colour, label: "base" },
    ...activeConcept.palette.map((color) => ({ hex: color, label: "" })),
  ];

  const allSwatches = [
    ...conceptSwatches,
    ...HAT_NEUTRALS.map((neutral) => ({ hex: neutral.hex, label: neutral.name })),
  ].filter(
    (swatch, idx, arr) =>
      arr.findIndex((candidate) => candidate.hex.toLowerCase() === swatch.hex.toLowerCase()) === idx,
  );

  return (
    <motion.div
      key="studio"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: "relative",
        minHeight: "100dvh",
        overflow: "hidden",
        background: "var(--color-bg)",
      }}
    >
      <div style={{ position: "absolute", inset: 0 }}>
        {activePanel === "preview3d" ? (
          <HatAngleViewer angles={angleImages[activeIdx] ?? []} />
        ) : (
          <HatPhotoViewer
            imageData={activeConcept.image.imageData || null}
            mimeType={activeConcept.image.mimeType}
            isLoading={activeConcept.image.status === "loading" || activeConcept.image.status === "idle"}
            editMode={activePanel === "edit" && !editCircle}
            tintColor={
              activeConcept.image.generatedBaseColour &&
              activeConcept.base_colour.toLowerCase() !== activeConcept.image.generatedBaseColour.toLowerCase()
                ? activeConcept.base_colour
                : undefined
            }
            onCircleDrawn={(zone) => setEditCircle({ zone })}
          />
        )}
      </div>

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          padding: "52px 20px 20px",
          background:
            "linear-gradient(to bottom, rgba(242,234,217,0.92) 0%, transparent 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          aria-label="Back to gallery"
          onClick={() => {
            setActivePanel(null);
            setEditCircle(null);
            setPhase("gallery");
          }}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: "rgba(184,151,100,0.14)",
            border: "1.5px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-text)",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={17} />
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "var(--color-surface)",
            border: "1.5px solid var(--color-border)",
            borderRadius: "980px",
            padding: "5px 14px 5px 10px",
            maxWidth: "60%",
          }}
        >
          {busy ? (
            <Loader2
              size={11}
              className="animate-spin"
              style={{ color: "var(--color-brand)", flexShrink: 0 }}
            />
          ) : (
            <span
              className="ready-dot"
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#30d158",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
          )}
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 500,
              fontStyle: "italic",
              fontFamily: "var(--font-serif)",
              color: "var(--color-text-muted)",
              letterSpacing: "-0.01em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {statusText}
          </span>
        </div>

        <div style={{ width: "36px" }} />
      </div>

      {activeConcept.image.status === "error" && activePanel !== "preview3d" ? (
        <div
          style={{
            position: "absolute",
            left: "20px",
            right: "20px",
            bottom: activePanel ? "176px" : "136px",
            zIndex: 40,
            padding: "16px 18px",
            borderRadius: "18px",
            border: "1.5px solid var(--color-border)",
            background: "rgba(242,234,217,0.94)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: "0.84rem",
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              color: "var(--color-text)",
            }}
          >
            Couldn&apos;t generate this hat yet.
          </p>
          <p
            style={{
              marginTop: "8px",
              fontSize: "0.74rem",
              lineHeight: 1.5,
              color: "var(--color-text-muted)",
            }}
          >
            {activeConcept.image.error}
          </p>
          <button
            onClick={() => handleRetryImage(activeIdx)}
            className="chip-vintage"
            style={{
              marginTop: "14px",
              padding: "8px 14px",
            }}
          >
            Retry Hat Image
          </button>
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingBottom: "44px",
          gap: "12px",
        }}
      >
        <AnimatePresence>
          {activePanel === "colors" ? (
            <motion.div
              key="colors-panel"
              initial={{ y: 32, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
              style={{
                background: "var(--color-bg)",
                border: "1.5px solid var(--color-border)",
                borderRadius: "16px",
                padding: "14px 16px",
                width: "calc(100% - 40px)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
              }}
            >
              <p
                style={{
                  fontSize: "0.62rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--color-text-muted)",
                  marginBottom: "12px",
                }}
              >
                Base colour
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  overflowX: "auto",
                  paddingBottom: "2px",
                }}
              >
                {allSwatches.map((swatch, idx) => (
                  <button
                    key={`${swatch.hex}-${idx}`}
                    className={`swatch-dot${activeConcept.base_colour.toLowerCase() === swatch.hex.toLowerCase() ? " selected" : ""}`}
                    style={{ backgroundColor: swatch.hex }}
                    onClick={() => handleColorSelect(swatch.hex)}
                    disabled={busy}
                    title={swatch.label || swatch.hex}
                  />
                ))}
              </div>
            </motion.div>
          ) : null}

          {activePanel === "edit" && !editCircle ? (
            <motion.div
              key="edit-hint"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              style={{
                background: "rgba(28,21,16,0.75)",
                backdropFilter: "blur(8px)",
                borderRadius: "14px",
                padding: "12px 20px",
              }}
            >
              <p
                style={{
                  color: "rgba(255,245,236,0.85)",
                  fontSize: "0.88rem",
                  fontFamily: "var(--font-serif)",
                  fontStyle: "italic",
                  textAlign: "center",
                }}
              >
                Draw on the hat to select an area
              </p>
            </motion.div>
          ) : null}

          {activePanel === "edit" && editCircle ? (
            <motion.div
              key="edit-prompt"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              style={{
                background: "var(--color-bg)",
                border: "1.5px solid var(--color-border)",
                borderRadius: "16px",
                padding: "14px 16px",
                width: "calc(100% - 40px)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
              }}
            >
              <p
                style={{
                  fontSize: "0.62rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--color-brand)",
                  marginBottom: "10px",
                }}
              >
                {editCircle.zone}
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "7px",
                  overflowX: "auto",
                  marginBottom: "10px",
                }}
              >
                {PRESET_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    className="chip-vintage"
                    style={{ flexShrink: 0, padding: "7px 13px" }}
                    onClick={() => void handleCircleEditSubmit(chip)}
                    disabled={busy}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={editPrompt}
                  onChange={(event) => setEditPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleCircleEditSubmit(editPrompt);
                    }
                  }}
                  placeholder="Describe the change..."
                  autoFocus
                  style={{
                    width: "100%",
                    height: "44px",
                    background: "var(--color-surface)",
                    border: "1.5px solid var(--color-border)",
                    borderRadius: "10px",
                    padding: "0 48px 0 14px",
                    fontFamily: "var(--font-serif)",
                    fontSize: "0.88rem",
                    letterSpacing: "-0.01em",
                    color: "var(--color-text)",
                    outline: "none",
                  }}
                />
                <button
                  onClick={() => void handleCircleEditSubmit(editPrompt)}
                  disabled={!editPrompt.trim() || busy}
                  style={{
                    position: "absolute",
                    right: "8px",
                    top: "8px",
                    width: "30px",
                    height: "30px",
                    borderRadius: "8px",
                    background:
                      editPrompt.trim() && !busy
                        ? "var(--color-brand)"
                        : "var(--color-surface)",
                    border:
                      editPrompt.trim() && !busy
                        ? "2px solid var(--color-brand-dark)"
                        : "1.5px solid var(--color-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color:
                      editPrompt.trim() && !busy
                        ? "#fff5ec"
                        : "var(--color-text-muted)",
                    cursor:
                      !editPrompt.trim() || busy ? "not-allowed" : "pointer",
                  }}
                >
                  <Send size={12} />
                </button>
              </div>

              <button
                onClick={() => setEditCircle(null)}
                style={{
                  marginTop: "8px",
                  fontSize: "0.72rem",
                  color: "var(--color-text-muted)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  display: "block",
                  width: "100%",
                  textAlign: "center",
                }}
              >
                draw again
              </button>
            </motion.div>
          ) : null}

          {activePanel === null ? (
            <motion.div
              key="refine-row"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 8, opacity: 0 }}
              style={{
                display: "flex",
                gap: "7px",
                padding: "0 20px",
                overflowX: "auto",
                width: "100%",
              }}
            >
              {PRESET_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => void handleRefine(chip)}
                  disabled={busy}
                  className="chip-vintage"
                  style={{
                    flexShrink: 0,
                    padding: "8px 14px",
                    opacity: busy ? 0.35 : 1,
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  {chip}
                </button>
              ))}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <input
                  type="text"
                  value={refineText}
                  onChange={(event) => setRefineText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleRefine(refineText);
                    }
                  }}
                  disabled={busy}
                  placeholder="Make it..."
                  style={{
                    height: "36px",
                    background: "var(--color-surface)",
                    border: "1.5px solid var(--color-border)",
                    borderRadius: "6px",
                    padding: "0 40px 0 12px",
                    fontFamily: "var(--font-serif)",
                    fontSize: "0.82rem",
                    fontStyle: "italic",
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    color: "var(--color-text)",
                    outline: "none",
                    width: "130px",
                    opacity: busy ? 0.5 : 1,
                  }}
                />
                <button
                  onClick={() => void handleRefine(refineText)}
                  disabled={busy || !refineText.trim()}
                  style={{
                    position: "absolute",
                    right: "6px",
                    top: "5px",
                    width: "26px",
                    height: "26px",
                    borderRadius: "6px",
                    background:
                      refineText.trim() && !busy
                        ? "var(--color-brand)"
                        : "transparent",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color:
                      refineText.trim() && !busy
                        ? "#fff5ec"
                        : "var(--color-text-muted)",
                    cursor:
                      busy || !refineText.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  <Send size={11} />
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="studio-fab-row">
          <button
            className={`studio-fab${activePanel === "colors" ? " active" : ""}`}
            onClick={() => {
              setActivePanel(activePanel === "colors" ? null : "colors");
              setEditCircle(null);
              setEditPrompt("");
            }}
            disabled={busy}
            aria-label="Change hat color"
          >
            <span className="studio-fab-icon"><Palette size={20} /></span>
            <span className="studio-fab-label">Colors</span>
          </button>

          <button
            className={`studio-fab${activePanel === "edit" ? " active" : ""}`}
            onClick={() => {
              setActivePanel(activePanel === "edit" ? null : "edit");
              setEditCircle(null);
              setEditPrompt("");
            }}
            disabled={busy}
            aria-label="Edit hat design"
          >
            <span className="studio-fab-icon"><Pencil size={20} /></span>
            <span className="studio-fab-label">Edit</span>
          </button>

          <button
            className={`studio-fab${activePanel === "preview3d" ? " active" : ""}`}
            onClick={() => {
              const opening = activePanel !== "preview3d";
              setActivePanel(opening ? "preview3d" : null);
              setEditCircle(null);
              setEditPrompt("");
              if (opening && activeConcept.image.imageData) {
                void generateAnglesForConcept(activeIdx);
              }
            }}
            disabled={!activeConcept.image.imageData}
            aria-label="View hat in 360 degrees"
            style={{
              opacity: activeConcept.image.imageData ? 1 : 0.45,
            }}
          >
            <span className="studio-fab-icon"><RotateCw size={20} /></span>
            <span className="studio-fab-label">360°</span>
          </button>
        </div>
      </div>

      {/* Error toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="toast-error"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
