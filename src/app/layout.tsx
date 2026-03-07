import type { Metadata } from "next";
import "./globals.css";
import CacheClearer from "@/components/CacheClearer";

export const metadata: Metadata = {
  title: "HatLab | Design Your Own Dad Hat",
  description: "Snap a photo and vibe your own dad hat from anything you see.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased min-h-[100dvh] flex flex-col pb-safe"
        style={{ background: "var(--color-bg)" }}
      >
        <main className="flex-1 w-full max-w-md mx-auto relative overflow-hidden flex flex-col">
          <CacheClearer />
          {children}
        </main>
      </body>
    </html>
  );
}
