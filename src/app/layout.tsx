import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import "./globals.css";
import CacheClearer from "@/components/CacheClearer";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});

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
    <html lang="en" className={playfair.variable}>
      <body
        className="antialiased min-h-[100dvh] flex flex-col pb-safe"
        style={{ background: "var(--color-bg)" }}
      >
        <CacheClearer />
        <main className="flex-1 w-full max-w-md mx-auto relative overflow-hidden flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
