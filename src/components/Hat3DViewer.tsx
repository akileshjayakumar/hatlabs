"use client";

import { Loader2, RefreshCw } from "lucide-react";

interface Hat3DViewerProps {
  imageData?: string | null;
  mimeType?: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function buildImageSource(imageData: string, mimeType: string) {
  return imageData.startsWith("data:")
    ? imageData
    : `data:${mimeType};base64,${imageData}`;
}

export default function Hat3DViewer({
  imageData,
  mimeType = "image/png",
  isLoading = false,
  error = null,
  onRetry,
}: Hat3DViewerProps) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "108px 24px 128px",
      }}
    >
      {imageData ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={buildImageSource(imageData, mimeType)}
          alt="Generated 3D render of the selected hat"
          style={{
            width: "100%",
            maxWidth: "520px",
            maxHeight: "100%",
            objectFit: "contain",
            display: "block",
            filter: "drop-shadow(0 24px 40px rgba(22, 17, 12, 0.14))",
          }}
        />
      ) : null}

      {isLoading ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 28px",
          }}
        >
          <div
            style={{
              background: "rgba(242,234,217,0.92)",
              border: "1.5px solid var(--color-border)",
              borderRadius: "20px",
              padding: "18px 20px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
            }}
          >
            <Loader2
              size={18}
              className="animate-spin"
              style={{ color: "var(--color-brand)" }}
            />
            <div>
              <p
                style={{
                  fontSize: "0.82rem",
                  fontFamily: "var(--font-serif)",
                  fontStyle: "italic",
                  color: "var(--color-text)",
                }}
              >
                Rendering 3D view…
              </p>
              <p
                style={{
                  fontSize: "0.72rem",
                  color: "var(--color-text-muted)",
                  marginTop: "2px",
                }}
              >
                Matching the user&apos;s exact hat design
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {!imageData && !isLoading && error ? (
        <div
          style={{
            maxWidth: "320px",
            padding: "18px 20px",
            borderRadius: "20px",
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
            Couldn&apos;t render the 3D view.
          </p>
          <p
            style={{
              marginTop: "8px",
              fontSize: "0.74rem",
              lineHeight: 1.5,
              color: "var(--color-text-muted)",
            }}
          >
            {error}
          </p>
          {onRetry ? (
            <button
              onClick={onRetry}
              className="chip-vintage"
              style={{
                marginTop: "14px",
                padding: "8px 14px",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <RefreshCw size={13} />
              Retry render
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
