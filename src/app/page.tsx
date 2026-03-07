"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Camera, Images, Loader2, X, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const MAX_IMAGES = 4;

export default function Home() {
  const router = useRouter();
  const [images, setImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const openCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setShowCamera(true);
      // Wait for the video element to mount, then attach stream
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);
    } catch {
      alert("Could not access camera. Please allow camera permissions.");
    }
  }, []);

  const closeCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setShowCamera(false);
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg");
    setImages((prev) => [...prev, dataUrl].slice(0, MAX_IMAGES));
    closeCamera();
  }, [closeCamera]);

  const readFiles = (files: FileList) => {
    const remaining = MAX_IMAGES - images.length;
    const toRead = Array.from(files).slice(0, remaining);
    const promises = toRead.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }),
    );
    Promise.all(promises).then((results) => {
      setImages((prev) => [...prev, ...results].slice(0, MAX_IMAGES));
    });
  };

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) readFiles(e.target.files);
    e.target.value = "";
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleGenerate = () => {
    if (!images.length || isProcessing) return;
    setIsProcessing(true);
    sessionStorage.removeItem("hatlab-concepts");
    sessionStorage.setItem("hatlab-images", JSON.stringify(images));
    sessionStorage.setItem("hatlab-image", images[0]);
    router.push("/results");
  };

  const canAddMore = images.length < MAX_IMAGES;

  return (
    <div
      className="flex flex-col h-full"
      style={{ fontFamily: "var(--font-serif)", minHeight: "100dvh" }}
    >
      {/* ── Header strip ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between px-7 pt-16 pb-5"
      >
        <span
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
            fontStyle: "italic",
          }}
        >
          Est. 2026
        </span>
      </motion.div>

      {/* ── Wordmark ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="px-7"
      >
        <div
          style={{
            height: "2px",
            backgroundColor: "var(--color-text)",
            marginBottom: "16px",
          }}
        />
        <h1
          style={{
            fontSize: "clamp(4rem, 18vw, 5.5rem)",
            lineHeight: 0.9,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--color-text)",
            fontStyle: "italic",
          }}
        >
          {images.length === 0 ? (
            <>
              Hat
              <br />
              Lab.
            </>
          ) : images.length === MAX_IMAGES ? (
            <>
              Looking
              <br />
              good.
            </>
          ) : (
            <>
              {images.length} shot{images.length > 1 ? "s" : ""}.<br />
              Add more.
            </>
          )}
        </h1>
        <div
          style={{
            height: "1px",
            backgroundColor: "var(--color-border)",
            marginTop: "18px",
          }}
        />
        {images.length > 0 ? (
          <p
            style={{
              marginTop: "14px",
              fontSize: "0.95rem",
              lineHeight: 1.6,
              color: "var(--color-text-muted)",
              fontStyle: "italic",
            }}
          >
            {images.length === MAX_IMAGES ? (
              <>All 4 photos in. Ready to create.</>
            ) : (
              <>Add more or hit generate.</>
            )}
          </p>
        ) : null}
      </motion.div>

      {/* ── Logo / Thumbnails ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1 flex items-center justify-center px-10"
      >
        <AnimatePresence mode="wait">
          {images.length === 0 ? (
            <motion.img
              key="logo"
              src="/hatlab-logo.png"
              alt="HatLab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{
                width: "min(320px, 80vw)",
                height: "auto",
                mixBlendMode: "multiply",
                userSelect: "none",
                pointerEvents: "none",
              }}
              draggable={false}
            />
          ) : (
            <motion.div
              key="thumbnails"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                justifyContent: "center",
              }}
            >
              {images.map((src, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    position: "relative",
                    width: "min(110px, 26vw)",
                    height: "min(110px, 26vw)",
                    flexShrink: 0,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Photo ${i + 1}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: "12px",
                      display: "block",
                      boxShadow: "3px 3px 0px var(--color-border)",
                    }}
                  />
                  <button
                    onClick={() => removeImage(i)}
                    style={{
                      position: "absolute",
                      top: "-7px",
                      right: "-7px",
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      background: "var(--color-text)",
                      color: "var(--color-bg)",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={11} />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── CTA Buttons ── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="px-7 pb-16 flex flex-col gap-4"
      >
        {/* Generate — appears when photos selected */}
        <AnimatePresence>
          {images.length > 0 && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              onClick={handleGenerate}
              disabled={isProcessing}
              className="btn-primary w-full flex items-center justify-center gap-2"
              style={{ height: "56px" }}
            >
              {isProcessing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ArrowRight size={16} />
              )}
              {isProcessing ? "preparing…" : "generate hat concepts"}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Camera + Library */}
        {canAddMore && (
          <div style={{ display: "flex", gap: "12px" }}>
            {/* Library — 3D ghost */}
            <button
              onClick={() => galleryInputRef.current?.click()}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = "translateY(3px)";
                e.currentTarget.style.boxShadow = "0 1px 0 var(--color-text)";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.boxShadow = "0 4px 0 var(--color-text)";
              }}
              onTouchStart={(e) => {
                e.currentTarget.style.transform = "translateY(3px)";
                e.currentTarget.style.boxShadow = "0 1px 0 var(--color-text)";
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.boxShadow = "0 4px 0 var(--color-text)";
              }}
              disabled={isProcessing}
              style={{
                flex: 1,
                height: "56px",
                borderRadius: "10px",
                padding: "0 20px",
                border: "2px solid var(--color-text)",
                background: "transparent",
                color: "var(--color-text)",
                fontFamily: "var(--font-serif)",
                fontWeight: 700,
                fontSize: "1.05rem",
                fontStyle: "italic",
                textTransform: "lowercase" as const,
                letterSpacing: "0.01em",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "7px",
                opacity: isProcessing ? 0.4 : 1,
                boxShadow: "0 4px 0 var(--color-text)",
                transition: "transform 60ms ease, box-shadow 60ms ease",
                userSelect: "none" as const,
              }}
            >
              <Images size={15} />
              library
            </button>

            {/* Camera — primary 3D */}
            <button
              onClick={() => openCamera()}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = "translateY(3px)";
                e.currentTarget.style.boxShadow = "0 1px 0 var(--color-text)";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.boxShadow = "0 4px 0 var(--color-text)";
              }}
              onTouchStart={(e) => {
                e.currentTarget.style.transform = "translateY(3px)";
                e.currentTarget.style.boxShadow = "0 1px 0 var(--color-text)";
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.boxShadow = "0 4px 0 var(--color-text)";
              }}
              disabled={isProcessing}
              className="btn-primary"
              style={{
                flex: 1,
                height: "56px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                borderRadius: "10px",
                border: "2px solid var(--color-text)",
                boxShadow: "0 4px 0 var(--color-text)",
              }}
            >
              <Camera size={15} />
              camera
            </button>
          </div>
        )}
      </motion.div>

      <input
        type="file"
        accept="image/png,image/jpg,image/jpeg"
        multiple
        ref={galleryInputRef}
        onChange={handleGallerySelect}
        className="hidden"
      />

      {/* Camera modal */}
      {showCamera && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "20px",
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ width: "100%", maxWidth: "480px", borderRadius: "12px" }}
          />
          <div style={{ display: "flex", gap: "16px" }}>
            <button
              onClick={capturePhoto}
              style={{
                padding: "14px 32px",
                background: "var(--color-primary, #c87941)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontSize: "16px",
                cursor: "pointer",
                fontFamily: "var(--font-serif)",
              }}
            >
              Capture
            </button>
            <button
              onClick={closeCamera}
              style={{
                padding: "14px 32px",
                background: "transparent",
                color: "white",
                border: "2px solid white",
                borderRadius: "10px",
                fontSize: "16px",
                cursor: "pointer",
                fontFamily: "var(--font-serif)",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
