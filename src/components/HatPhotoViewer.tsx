"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toDataUrl } from "@/lib/hatlab";

interface HatPhotoViewerProps {
  imageData: string | null;
  mimeType?: string;
  isLoading?: boolean;
  editMode?: boolean;
  tintColor?: string;
  onCircleDrawn?: (zone: string) => void;
}

function getZoneFromFraction(cxFrac: number, cyFrac: number): string {
  if (cyFrac < 0.3) return "the top crown area";
  if (cyFrac > 0.72) return "the brim area";
  if (cxFrac < 0.35) return "the left side panel";
  if (cxFrac > 0.65) return "the right side panel";
  return "the front panel center";
}

export default function HatPhotoViewer({
  imageData,
  mimeType = "image/png",
  isLoading = false,
  editMode = false,
  tintColor,
  onCircleDrawn,
}: HatPhotoViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDraggingState, setIsDraggingState] = useState(false);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const lastDist = useRef<number | null>(null);
  const drawStart = useRef<{ x: number; y: number } | null>(null);
  const isDrawing = useRef(false);

  // Sync canvas size to its CSS size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sync = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [editMode]);

  // Clear canvas when editMode turns off
  useEffect(() => {
    if (!editMode) {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      drawStart.current = null;
      isDrawing.current = false;
    }
  }, [editMode]);

  // --- Pan/zoom: mouse ---
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (editMode) return;
      isDragging.current = true;
      setIsDraggingState(true);
      lastPos.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    },
    [editMode],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (editMode || !isDragging.current) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
    },
    [editMode],
  );

  const onMouseUp = useCallback(() => {
    isDragging.current = false;
    setIsDraggingState(false);
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (editMode) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setTransform((t) => ({
        ...t,
        scale: Math.max(0.5, Math.min(4, t.scale * delta)),
      }));
    },
    [editMode],
  );

  // --- Pan/zoom: touch ---
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (editMode) return;
      if (e.touches.length === 1) {
        isDragging.current = true;
        setIsDraggingState(true);
        lastPos.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      } else if (e.touches.length === 2) {
        isDragging.current = false;
        setIsDraggingState(false);
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastDist.current = Math.sqrt(dx * dx + dy * dy);
      }
    },
    [editMode],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (editMode) return;
      e.preventDefault();
      if (e.touches.length === 1 && isDragging.current) {
        const dx = e.touches[0].clientX - lastPos.current.x;
        const dy = e.touches[0].clientY - lastPos.current.y;
        lastPos.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
      } else if (e.touches.length === 2 && lastDist.current !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const scaleDelta = dist / lastDist.current;
        lastDist.current = dist;
        setTransform((t) => ({
          ...t,
          scale: Math.max(0.5, Math.min(4, t.scale * scaleDelta)),
        }));
      }
    },
    [editMode],
  );

  const onTouchEnd = useCallback(() => {
    isDragging.current = false;
    setIsDraggingState(false);
    lastDist.current = null;
  }, []);

  // --- Canvas draw events ---
  const onCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      drawStart.current = { x, y };
      isDrawing.current = true;
      canvas.setPointerCapture(e.pointerId);
    },
    [],
  );

  const onCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current || !drawStart.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = (drawStart.current.x + x) / 2;
      const cy = (drawStart.current.y + y) / 2;
      const rx = Math.max(Math.abs(x - drawStart.current.x) / 2, 10);
      const ry = Math.max(Math.abs(y - drawStart.current.y) / 2, 10);

      // Outer glow
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx + 2, ry + 2, 0, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(184, 92, 42, 0.15)";
      ctx.lineWidth = 6;
      ctx.setLineDash([]);
      ctx.stroke();

      // Main circle
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(184, 92, 42, 0.85)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 5]);
      ctx.stroke();

      // Fill
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(184, 92, 42, 0.08)";
      ctx.fill();
    },
    [],
  );

  const onCanvasPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current || !drawStart.current) return;
      isDrawing.current = false;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);

      const imageRect = imageRef.current?.getBoundingClientRect();
      const centerX = (drawStart.current.x + x) / 2;
      const centerY = (drawStart.current.y + y) / 2;
      const centerClientX = rect.left + (centerX / canvas.width) * rect.width;
      const centerClientY = rect.top + (centerY / canvas.height) * rect.height;

      const zone = imageRect
        ? getZoneFromFraction(
            Math.min(
              Math.max((centerClientX - imageRect.left) / imageRect.width, 0),
              1,
            ),
            Math.min(
              Math.max((centerClientY - imageRect.top) / imageRect.height, 0),
              1,
            ),
          )
        : getZoneFromFraction(centerX / canvas.width, centerY / canvas.height);
      drawStart.current = null;
      onCircleDrawn?.(zone);
    },
    [onCircleDrawn],
  );

  const resetTransform = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  return (
    <div
      className="w-full h-full relative select-none overflow-hidden"
      style={{
        backgroundColor: "transparent",
      }}
      ref={containerRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {isLoading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20,
            background: "rgba(242,234,217,0.7)",
            backdropFilter: "blur(6px)",
            gap: "12px",
          }}
        >
          <Loader2
            size={28}
            className="animate-spin"
            style={{ color: "var(--color-brand)" }}
          />
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontWeight: 600,
              fontSize: "0.9rem",
              color: "var(--color-text-muted)",
              letterSpacing: "-0.01em",
            }}
          >
            designing hat…
          </p>
        </div>
      )}

      {imageData && !isLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transition: isDraggingState ? "none" : "transform 0.1s ease",
            willChange: "transform",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={toDataUrl(imageData, mimeType)}
            alt="Generated dad hat"
            className="max-w-[90%] max-h-[90%] object-contain drop-shadow-2xl pointer-events-none"
            draggable={false}
          />
          {tintColor && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: tintColor,
                mixBlendMode: "color",
                opacity: 0.45,
                pointerEvents: "none",
                transition: "background 300ms ease",
              }}
            />
          )}
        </div>
      )}

      {!imageData && !isLoading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontSize: "0.85rem",
              color: "var(--color-text-muted)",
              opacity: 0.5,
            }}
          >
            hat preview
          </p>
        </div>
      )}

      {/* Edit mode border indicator */}
      {editMode && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: "2px solid rgba(184, 92, 42, 0.3)",
            borderRadius: "0px",
            pointerEvents: "none",
            zIndex: 5,
            transition: "border-color 200ms ease",
          }}
        />
      )}

      {/* Canvas overlay for circle-to-edit */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          cursor: editMode ? "crosshair" : "default",
          pointerEvents: editMode ? "all" : "none",
          zIndex: 10,
        }}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onPointerLeave={onCanvasPointerUp}
      />

      {/* Reset button (only when not in edit mode) */}
      {imageData && !isLoading && !editMode && (
        <div style={{ position: "absolute", bottom: "12px", right: "12px", zIndex: 10 }}>
          <button
            onClick={resetTransform}
            aria-label="Reset zoom and position"
            style={{
              padding: "5px 13px",
              borderRadius: "980px",
              background: "var(--color-surface)",
              border: "1.5px solid var(--color-border)",
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontWeight: 600,
              fontSize: "0.72rem",
              color: "var(--color-text-muted)",
              cursor: "pointer",
              letterSpacing: "0.01em",
            }}
          >
            reset
          </button>
        </div>
      )}
    </div>
  );
}
