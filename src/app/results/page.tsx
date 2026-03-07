"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Send,
} from "lucide-react";
import dynamic from "next/dynamic";

const HatPhotoViewer = dynamic(() => import("@/components/HatPhotoViewer"), {
  ssr: false,
});

const Hat3DViewer = dynamic(() => import("@/components/Hat3DViewer"), {
  ssr: false,
});

// Re-use pastel map for gallery card backgrounds
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

interface Concept {
  name: string;
  base_colour: string;
  front_design: string;
  palette: string[];
  style: string;
  rationale: string;
  hatImage?: string;
  hatMimeType?: string;
  hatBackground?: string;
  render3DImage?: string;
  render3DMimeType?: string;
}

interface AnalysisData {
  visual_summary: string;
  palette: string[];
  symbols: string[];
  style_keywords: string[];
  hat_design_opportunities: string[];
}

interface ResultsData {
  analysis: AnalysisData;
  concepts: Concept[];
}

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
type StudioPanel = "colors" | "edit" | "tryon" | null;

export default function ResultsPage() {
  const router = useRouter();

  // Core state
  const [data, setData] = useState<ResultsData | null>(null);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [activeIdx, setActiveIdx] = useState(0);

  // Loading
  const [isGeneratingConcepts, setIsGeneratingConcepts] = useState(false);
  const [conceptError, setConceptError] = useState<string | null>(null);
  const [thinkingStep, setThinkingStep] = useState(0);

  // Image generation (per-concept)
  const [generatingImageFor, setGeneratingImageFor] = useState<Set<number>>(
    new Set(),
  );
  const [generating3DFor, setGenerating3DFor] = useState<Set<number>>(
    new Set(),
  );
  const [render3DErrors, setRender3DErrors] = useState<Record<number, string>>(
    {},
  );

  // Refinement
  const [isRefining, setIsRefining] = useState(false);
  const [refineText, setRefineText] = useState("");

  // Studio panels
  const [activePanel, setActivePanel] = useState<StudioPanel>(null);

  // Edit mode
  const [editCircle, setEditCircle] = useState<{ zone: string } | null>(null);
  const [editPrompt, setEditPrompt] = useState("");

  // Gallery scroll ref
  const galleryRef = useRef<HTMLDivElement>(null);
  const activeConcept = data?.concepts[activeIdx];

  const saveSlimResults = useCallback((nextData: ResultsData) => {
    try {
      const slim = {
        ...nextData,
        concepts: nextData.concepts.map((concept) => {
          const slimConcept = { ...concept };
          delete slimConcept.hatImage;
          delete slimConcept.hatMimeType;
          delete slimConcept.render3DImage;
          delete slimConcept.render3DMimeType;
          return slimConcept;
        }),
      };
      sessionStorage.setItem("hatlab-concepts", JSON.stringify(slim));
    } catch {
      // Ignore quota errors — data is still available in memory
    }
  }, []);

  // ── Hat image generation ──────────────────────────────────────
  const generateHatImageForConcept = useCallback(
    async (dataToUse: ResultsData, idx: number) => {
      const concept = dataToUse.concepts[idx];
      if (concept?.hatImage) return;

      setGeneratingImageFor((prev) => new Set(prev).add(idx));
      try {
        const res = await fetch("/api/generate-hat-image", {
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
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Image generation failed");
        }
        const imageResult = await res.json();
        setData((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, concepts: [...prev.concepts] };
          updated.concepts[idx] = {
            ...updated.concepts[idx],
            hatImage: imageResult.imageData,
            hatMimeType: imageResult.mimeType,
            hatBackground: imageResult.background,
            render3DImage: undefined,
            render3DMimeType: undefined,
          };
          saveSlimResults(updated);
          return updated;
        });
      } catch (err) {
        console.error(`Hat image generation failed for concept ${idx}:`, err);
      } finally {
        setGeneratingImageFor((prev) => {
          const next = new Set(prev);
          next.delete(idx);
          return next;
        });
      }
    },
    [saveSlimResults],
  );

  const generate3DRenderForConcept = useCallback(
    async (dataToUse: ResultsData, idx: number) => {
      const concept = dataToUse.concepts[idx];
      if (!concept?.hatImage || concept.render3DImage) return;

      setGenerating3DFor((prev) => new Set(prev).add(idx));
      setRender3DErrors((prev) => {
        const next = { ...prev };
        delete next[idx];
        return next;
      });

      try {
        const res = await fetch("/api/generate-hat-3d-render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hatImage: concept.hatImage,
            hatMimeType: concept.hatMimeType || "image/png",
            conceptName: concept.name,
            baseColour: concept.base_colour,
            frontDesign: concept.front_design,
            palette: concept.palette,
            style: concept.style,
          }),
        });

        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.error || "3D render generation failed");
        }

        setData((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, concepts: [...prev.concepts] };
          updated.concepts[idx] = {
            ...updated.concepts[idx],
            render3DImage: body.imageData,
            render3DMimeType: body.mimeType,
          };
          return updated;
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to generate 3D render.";
        setRender3DErrors((prev) => ({ ...prev, [idx]: message }));
      } finally {
        setGenerating3DFor((prev) => {
          const next = new Set(prev);
          next.delete(idx);
          return next;
        });
      }
    },
    [],
  );

  // ── Concept generation ─────────────────────────────────────────
  const generateConceptsFromImage = useCallback(
    async (image: string) => {
      setThinkingStep(0);
      setIsGeneratingConcepts(true);
      setConceptError(null);
      try {
        const storedImages = sessionStorage.getItem("hatlab-images");
        const images: string[] = storedImages ? JSON.parse(storedImages) : [image];
        const res = await fetch("/api/generate-concepts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to analyze image.");
        }
        const parsed: ResultsData = await res.json();
        setActiveIdx(0);
        setData(parsed);
        sessionStorage.setItem("hatlab-concepts", JSON.stringify(parsed));
        setIsGeneratingConcepts(false);

        // Generate all 3 hat images in parallel
        await Promise.allSettled(
          parsed.concepts.map((_, idx) =>
            generateHatImageForConcept(parsed, idx),
          ),
        );
        setPhase("gallery");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to analyze image.";
        setConceptError(message);
        setIsGeneratingConcepts(false);
      }
    },
    [generateHatImageForConcept],
  );

  // ── Init ───────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const storedImage = sessionStorage.getItem("hatlab-image");
      const rawData = sessionStorage.getItem("hatlab-concepts");

      if (storedImage) setSourceImage(storedImage);

      if (rawData) {
        try {
          const parsed: ResultsData = JSON.parse(rawData);
          setData(parsed);
          await Promise.allSettled(
            parsed.concepts.map((_, idx) =>
              generateHatImageForConcept(parsed, idx),
            ),
          );
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
    init();
  }, [generateConceptsFromImage, generateHatImageForConcept, router]);

  // ── Thinking step advancement ──────────────────────────────────
  useEffect(() => {
    if (isGeneratingConcepts) {
      const timings = [1800, 3500, 5500, 8000];
      const timeouts = timings.map((time) =>
        setTimeout(() => {
          setThinkingStep((prev) =>
            Math.min(prev + 1, THINKING_STEPS.length - 2),
          );
        }, time),
      );
      return () => timeouts.forEach(clearTimeout);
    }
  }, [isGeneratingConcepts]);

  // Advance to "Rendering visuals" step when concepts are ready but images loading
  useEffect(() => {
    if (!isGeneratingConcepts && generatingImageFor.size > 0) {
      setThinkingStep(THINKING_STEPS.length - 1);
    }
  }, [isGeneratingConcepts, generatingImageFor.size]);

  // ── Gallery: track centered card on scroll ─────────────────────
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

  // ── Scroll gallery to active card when returning from studio ───
  useEffect(() => {
    if (phase !== "gallery" || !galleryRef.current) return;
    const container = galleryRef.current;
    const cards = container.querySelectorAll(
      "[data-concept-card]",
    ) as NodeListOf<HTMLElement>;
    const card = cards[activeIdx];
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (
      phase !== "studio" ||
      activePanel !== "tryon" ||
      !data ||
      !activeConcept?.hatImage ||
      activeConcept.render3DImage ||
      generating3DFor.has(activeIdx)
    ) {
      return;
    }

    void generate3DRenderForConcept(data, activeIdx);
  }, [
    activeConcept?.hatImage,
    activeConcept?.render3DImage,
    activeIdx,
    activePanel,
    data,
    generate3DRenderForConcept,
    generating3DFor,
    phase,
  ]);

  // ── Handlers ───────────────────────────────────────────────────
  const handleRetryConcepts = () => {
    if (!sourceImage || isGeneratingConcepts) return;
    generateConceptsFromImage(sourceImage);
  };

  const handleRefine = async (promptText: string, zoneHint?: string) => {
    if (!promptText.trim() || isRefining || !data) return;
    setIsRefining(true);
    try {
      const concept = data.concepts[activeIdx];
      const conceptWithoutImage = {
        name: concept.name,
        base_colour: concept.base_colour,
        front_design: concept.front_design,
        palette: concept.palette,
        style: concept.style,
        rationale: concept.rationale,
      };

      const res = await fetch("/api/refine-concept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalConcept: conceptWithoutImage,
          analysis: data.analysis,
          refinementPrompt: promptText,
          ...(zoneHint ? { zoneHint } : {}),
        }),
      });
      if (!res.ok) throw new Error("Refinement failed");
      const newConcept: Concept = await res.json();
      newConcept.hatImage = undefined;
      newConcept.hatMimeType = undefined;
      newConcept.hatBackground = undefined;
      newConcept.render3DImage = undefined;
      newConcept.render3DMimeType = undefined;
      const updatedConcepts = [...data.concepts];
      updatedConcepts[activeIdx] = newConcept;
      const newData = { ...data, concepts: updatedConcepts };
      setData(newData);
      saveSlimResults(newData);
      setRender3DErrors((prev) => {
        const next = { ...prev };
        delete next[activeIdx];
        return next;
      });
      setRefineText("");
      await generateHatImageForConcept(newData, activeIdx);
    } catch {
      alert("Failed to refine. Try again.");
    } finally {
      setIsRefining(false);
    }
  };

  const handleColorSelect = (colorHex: string) => {
    if (!data || generatingImageFor.has(activeIdx)) return;

    const updatedConcepts = [...data.concepts];
    updatedConcepts[activeIdx] = {
      ...updatedConcepts[activeIdx],
      base_colour: colorHex,
      hatImage: undefined,
      hatMimeType: undefined,
      hatBackground: undefined,
      render3DImage: undefined,
      render3DMimeType: undefined,
    };
    const newData = { ...data, concepts: updatedConcepts };
    setData(newData);
    saveSlimResults(newData);
    setRender3DErrors((prev) => {
      const next = { ...prev };
      delete next[activeIdx];
      return next;
    });
    void generateHatImageForConcept(newData, activeIdx);
  };

  const handleCircleDrawn = (zone: string) => {
    setEditCircle({ zone });
  };

  const handleCircleEditSubmit = async (prompt: string) => {
    if (!editCircle || !prompt.trim()) return;
    setEditCircle(null);
    setEditPrompt("");
    setActivePanel(null);
    await handleRefine(prompt, editCircle.zone);
  };

  const togglePanel = (panel: StudioPanel) => {
    if (activePanel === panel) {
      setActivePanel(null);
      setEditCircle(null);
      setEditPrompt("");
    } else {
      setActivePanel(panel);
      setEditCircle(null);
      setEditPrompt("");
    }
  };

  const enterStudio = () => {
    setActivePanel(null);
    setEditCircle(null);
    setPhase("studio");
  };

  const exitStudio = () => {
    setActivePanel(null);
    setEditCircle(null);
    setPhase("gallery");
  };

  // ── Derived ────────────────────────────────────────────────────
  const isActiveGenerating = generatingImageFor.has(activeIdx);
  const isRendering3D = generating3DFor.has(activeIdx);
  const busy = isGeneratingConcepts || isRefining || isActiveGenerating || isRendering3D;

  // ══════════════════════════════════════════════════════════════
  // LOADING PHASE — error variant
  // ══════════════════════════════════════════════════════════════
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
              background: "rgba(184,151,100,0.12)",
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
          {sourceImage && (
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
          )}
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
              Couldn&apos;t read that photo.
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
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
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

  // ══════════════════════════════════════════════════════════════
  // LOADING PHASE
  // ══════════════════════════════════════════════════════════════
  if (phase === "loading") {
    return (
      <div
        className="relative flex flex-col overflow-hidden"
        style={{ background: "var(--color-bg)", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 36px",
          }}
        >
          {/* Wordmark */}
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

          {/* Thinking steps */}
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
                            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
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

  // ══════════════════════════════════════════════════════════════
  // GALLERY PHASE
  // ══════════════════════════════════════════════════════════════
  if (phase === "gallery" && data) {
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
        {/* Header */}
        <div style={{ padding: "52px 24px 16px", textAlign: "center" }}>
          <p
            style={{
              fontSize: "0.62rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
              marginBottom: "6px",
            }}
          >
            3 concepts for you
          </p>
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

        {/* Card rail */}
        <div
          ref={galleryRef}
          className="gallery-scroll"
          style={{
            flex: 1,
            padding: `16px calc(50vw - 130px)`,
          }}
        >
          {data.concepts.map((concept, idx) => {
            const bgColor =
              PASTEL_MAP[concept.hatBackground || ""] || "#f0e6d3";
            return (
              <motion.div
                key={idx}
                data-concept-card={idx}
                className="gallery-card"
                animate={{
                  scale: idx === activeIdx ? 1.04 : 0.9,
                  opacity: idx === activeIdx ? 1 : 0.65,
                }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                onClick={() => setActiveIdx(idx)}
                style={{
                  width: "260px",
                  height: "360px",
                  background: bgColor,
                }}
              >
                {/* Hat image */}
                <div
                  style={{
                    height: "75%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: bgColor,
                  }}
                >
                  {concept.hatImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:${concept.hatMimeType || "image/png"};base64,${concept.hatImage}`}
                      alt={concept.name}
                      style={{
                        width: "90%",
                        height: "90%",
                        objectFit: "contain",
                        display: "block",
                      }}
                    />
                  ) : (
                    <Loader2
                      size={36}
                      className="animate-spin"
                      style={{ color: "var(--color-brand)", opacity: 0.45 }}
                    />
                  )}
                </div>

                {/* Bottom info overlay */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: "28px 16px 16px",
                    background:
                      "linear-gradient(to bottom, transparent, rgba(0,0,0,0.58))",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontStyle: "italic",
                      fontWeight: 800,
                      fontSize: "1.15rem",
                      color: "#fff",
                      letterSpacing: "-0.01em",
                      lineHeight: 1.2,
                    }}
                  >
                    {concept.name}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginTop: "5px",
                    }}
                  >
                    <span
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        backgroundColor: concept.base_colour,
                        border: "1.5px solid rgba(255,255,255,0.5)",
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "0.7rem",
                        color: "rgba(255,255,255,0.7)",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      {concept.style}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* CTA */}
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
            onClick={enterStudio}
          >
            Design This One →
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

  // ══════════════════════════════════════════════════════════════
  // STUDIO PHASE
  // ══════════════════════════════════════════════════════════════
  if (!data || !activeConcept) return null;

  // Build swatch list: concept colors + neutrals (deduped)
  const conceptSwatches = [
    { hex: activeConcept.base_colour, label: "base" },
    ...activeConcept.palette.map((c) => ({ hex: c, label: "" })),
  ];
  const allSwatches = [
    ...conceptSwatches,
    ...HAT_NEUTRALS.map((n) => ({ hex: n.hex, label: n.name })),
  ].filter(
    (s, i, arr) =>
      arr.findIndex((x) => x.hex.toLowerCase() === s.hex.toLowerCase()) === i,
  );

  const statusText = isRefining
    ? "Refining…"
    : isActiveGenerating
      ? "Generating hat…"
      : isRendering3D
        ? "Rendering 3D…"
      : activePanel === "tryon"
        ? `${activeConcept.name} · 3D Render`
      : activeConcept.name;

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
      {/* Full-screen hat viewer */}
      <div style={{ position: "absolute", inset: 0 }}>
        {activePanel === "tryon" ? (
          <Hat3DViewer
            imageData={activeConcept.render3DImage || null}
            mimeType={activeConcept.render3DMimeType}
            isLoading={isRendering3D || (!activeConcept.render3DImage && !!activeConcept.hatImage)}
            error={render3DErrors[activeIdx] || null}
            onRetry={() => void generate3DRenderForConcept(data, activeIdx)}
          />
        ) : (
          <HatPhotoViewer
            imageData={activeConcept.hatImage || null}
            mimeType={activeConcept.hatMimeType}
            isLoading={isActiveGenerating && !activeConcept.hatImage}
            editMode={activePanel === "edit" && !editCircle}
            onCircleDrawn={handleCircleDrawn}
          />
        )}
      </div>

      {/* Top bar */}
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
        {/* Back to gallery */}
        <button
          onClick={exitStudio}
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

        {/* Status */}
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

        {/* Spacer */}
        <div style={{ width: "36px" }} />
      </div>

      {/* Bottom chrome: panels + FAB row */}
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
        {/* Panel content (slides up) */}
        <AnimatePresence>
          {/* Colors panel */}
          {activePanel === "colors" && (
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
                {allSwatches.map((swatch, i) => (
                  <button
                    key={i}
                    className={`swatch-dot${activeConcept.base_colour.toLowerCase() === swatch.hex.toLowerCase() ? " selected" : ""}`}
                    style={{ backgroundColor: swatch.hex }}
                    onClick={() => handleColorSelect(swatch.hex)}
                    disabled={generatingImageFor.has(activeIdx)}
                    title={swatch.label || swatch.hex}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Edit panel — draw hint */}
          {activePanel === "edit" && !editCircle && (
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
          )}

          {/* Edit panel — zone captured, show prompt */}
          {activePanel === "edit" && editCircle && (
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

              {/* Quick chips */}
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
                    onClick={() => handleCircleEditSubmit(chip)}
                    disabled={busy}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Text input */}
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleCircleEditSubmit(editPrompt)
                  }
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
                  onClick={() => handleCircleEditSubmit(editPrompt)}
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

              {/* Cancel */}
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
          )}

          {/* Refine row (always visible in studio, below FABs is fine) */}
          {activePanel === null && (
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
                  onClick={() => handleRefine(chip)}
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
              {/* Custom text input */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <input
                  type="text"
                  value={refineText}
                  onChange={(e) => setRefineText(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleRefine(refineText)
                  }
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
                  onClick={() => handleRefine(refineText)}
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
          )}
        </AnimatePresence>

        {/* FAB row */}
        <div className="studio-fab-row">
          <button
            className={`studio-fab${activePanel === "colors" ? " active" : ""}`}
            onClick={() => togglePanel("colors")}
            disabled={busy}
          >
            <span className="studio-fab-icon">🎨</span>
            <span className="studio-fab-label">Colors</span>
          </button>

          <button
            className={`studio-fab${activePanel === "edit" ? " active" : ""}`}
            onClick={() => togglePanel("edit")}
            disabled={busy}
          >
            <span className="studio-fab-icon">✏️</span>
            <span className="studio-fab-label">Edit</span>
          </button>

          <button
            className={`studio-fab${activePanel === "tryon" ? " active" : ""}`}
            onClick={() => togglePanel("tryon")}
            disabled={busy}
          >
            <span className="studio-fab-icon">🧢</span>
            <span className="studio-fab-label">3D</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
