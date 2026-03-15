"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

export interface AngleImage {
  status: "idle" | "loading" | "ready" | "error";
  imageData?: string;
  mimeType?: string;
  error?: string;
}

const ANGLE_NAMES = ["Front", "¾ Right", "Right", "Back", "Left", "¾ Left"];

interface HatAngleViewerProps {
  angles: AngleImage[];
}

export default function HatAngleViewer({ angles }: HatAngleViewerProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const goTo = (idx: number) => {
    setCurrentIdx(Math.max(0, Math.min(5, idx)));
  };

  const goPrev = () => goTo(currentIdx - 1);
  const goNext = () => goTo(currentIdx + 1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIdx]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) goNext();
      else goPrev();
    }
    setTouchStartX(null);
  };

  const current = angles[currentIdx];
  const angleName = ANGLE_NAMES[currentIdx];

  const getDotStyle = (idx: number): React.CSSProperties => {
    const isActive = idx === currentIdx;
    const angle = angles[idx];
    const isReady = angle.status === "ready";

    if (isActive) {
      return {
        width: 22,
        height: 6,
        borderRadius: 3,
        border: "none",
        padding: 0,
        cursor: "pointer",
        background: "var(--color-brand)",
        opacity: 1,
        transition: "all 0.2s ease",
      };
    }

    if (isReady) {
      return {
        width: 6,
        height: 6,
        borderRadius: 3,
        border: "none",
        padding: 0,
        cursor: "pointer",
        background: "var(--color-text-muted)",
        opacity: 0.55,
        transition: "all 0.2s ease",
      };
    }

    return {
      width: 6,
      height: 6,
      borderRadius: 3,
      border: "none",
      padding: 0,
      cursor: "pointer",
      background: "rgba(0,0,0,0.18)",
      opacity: 0.4,
      transition: "all 0.2s ease",
    };
  };

  const arrowButtonStyle = (side: "left" | "right"): React.CSSProperties => ({
    position: "absolute",
    [side]: 12,
    top: "50%",
    transform: "translateY(-50%)",
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "rgba(242,234,217,0.88)",
    backdropFilter: "blur(6px)",
    border: "1.5px solid var(--color-border)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    zIndex: 10,
    color: "var(--color-text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
  });

  return (
    <div
      style={{ position: "absolute", inset: 0 }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Angle label pill */}
      <AnimatePresence mode="wait">
        <motion.div
          key={angleName}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.15 }}
          style={{
            position: "absolute",
            top: 90,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "0.62rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 980,
              padding: "4px 12px",
              color: "var(--color-text-muted)",
            }}
          >
            {angleName}
          </span>
        </motion.div>
      </AnimatePresence>

      {/* Image display area */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: "100px 60px 150px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIdx}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.18 }}
            style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {current.status === "ready" && current.imageData ? (
              <img
                src={`data:${current.mimeType ?? "image/png"};base64,${current.imageData}`}
                alt={angleName}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  filter: "drop-shadow(0 20px 36px rgba(22,17,12,0.16))",
                }}
              />
            ) : current.status === "error" ? (
              <p
                style={{
                  fontFamily: "var(--font-serif)",
                  fontStyle: "italic",
                  color: "var(--color-text-muted)",
                  fontSize: "0.9rem",
                  textAlign: "center",
                }}
              >
                Couldn&apos;t render this angle.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Loader2
                  size={28}
                  className="animate-spin"
                  style={{
                    color: "var(--color-brand)",
                    opacity: 0.5,
                  }}
                />
                <p
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontStyle: "italic",
                    color: "var(--color-text-muted)",
                    fontSize: "0.85rem",
                  }}
                >
                  Rendering {angleName}…
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Left arrow */}
      {currentIdx > 0 && (
        <button style={arrowButtonStyle("left")} onClick={goPrev} aria-label="Previous angle">
          <ChevronLeft size={18} />
        </button>
      )}

      {/* Right arrow */}
      {currentIdx < 5 && (
        <button style={arrowButtonStyle("right")} onClick={goNext} aria-label="Next angle">
          <ChevronRight size={18} />
        </button>
      )}

      {/* Dot indicators */}
      <div
        style={{
          position: "absolute",
          bottom: 132,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 6,
          zIndex: 10,
        }}
      >
        {angles.map((_, idx) => (
          <button
            key={idx}
            onClick={() => goTo(idx)}
            aria-label={`Go to ${ANGLE_NAMES[idx]}`}
            style={getDotStyle(idx)}
          />
        ))}
      </div>

    </div>
  );
}
