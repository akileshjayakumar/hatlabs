# HatLab

A mobile-first AI hat design app that turns your photos into photorealistic dad hat concepts — powered by Google Gemini.

---

## What Is It?

HatLab lets you upload 1–4 reference photos (your style, outfit, vibe, anything), and uses Gemini's multimodal vision models to analyze them, generate 3 unique dad hat design concepts, and render a photorealistic hat image for each one. You can then refine the designs, swap colors, and even try the hat on yourself — all in the browser, no account required.

---

## How It Works

### App Flow

```
/ (upload)  →  /results (loading → gallery → studio)
```

**1. Upload (`/`)**
- Upload 1–4 photos from your camera or photo library
- Photos are read as base64 data URLs entirely in the browser — nothing is uploaded to a server at this step
- Stored in `sessionStorage` under `hatlab-images` and `hatlab-image` (first photo, used for try-on)

**2. Loading phase (`/results` — loading)**
- Calls `POST /api/generate-concepts` with your photos
- Gemini analyzes the images: extracts palette, style keywords, symbols, and design opportunities
- Returns 3 distinct dad hat concepts with name, base colour, front design, palette, style, and rationale
- All 3 hat images are generated in parallel via `Promise.allSettled` using `POST /api/generate-hat-image`
- An animated "thinking steps" UI plays while generation runs, then transitions to the gallery

**3. Gallery phase (`/results` — gallery)**
- Horizontal scroll-snap card rail showing all 3 hat concepts
- Each card shows the AI-rendered hat image, concept name, style chip, and color palette dots
- Active card is tracked by scroll position
- Tap "Design This One" to enter the studio for that concept

**4. Studio phase (`/results` — studio)**
- Full-screen pan/zoom hat photo viewer (`HatPhotoViewer`)
- Floating 3-button action bar with three panels that slide up from the bottom:

| Button | Panel | What it does |
|--------|-------|--------------|
| Colors | Color picker | Swap the hat's base color from 6 neutral presets or 4 concept-palette colors |
| Edit | Prompt editor | Type a free-form refinement, or use preset chips (Minimal, Bolder, Premium, Playful). Draw a circle on the hat to target a specific zone |
| Try On | Try-on viewer | Composites the hat onto your uploaded photo using Gemini image generation |

**Circle-to-edit:** In Edit mode, tapping the hat image switches to canvas draw mode. Draw a circle anywhere on the hat — the app computes a zone label ("the brim area", "the front panel center", etc.) from where you drew, then pre-fills the edit prompt with that zone context.

**State persistence:** Concepts (without images) are cached in `sessionStorage` under `hatlab-concepts`. If you reload, concepts restore from cache and hat images regenerate automatically.

---

## Features

- **Multi-photo analysis** — upload up to 4 photos; Gemini synthesizes them all into one coherent style read
- **3 parallel hat concepts** — three distinct designs generated and rendered simultaneously
- **Photorealistic hat rendering** — Gemini image generation outputs photorealistic dad hat visuals
- **Color swapping** — instantly recolor a hat with neutral presets or palette-matched swatches
- **Free-form refinement** — describe any change in plain text; Gemini updates the concept and re-renders
- **Zone-targeted editing** — draw a circle on the hat to tell Gemini exactly where to make changes
- **AI try-on** — composites the generated hat onto your selfie/photo
- **In-browser camera** — capture photos directly without leaving the app
- **Concept caching** — `sessionStorage` prevents redundant API calls on page reload
- **Animated loading UI** — sequential thinking-step messages keep the experience engaging during generation
- **Tactile button sounds** — Web Audio API synthesizes a press sound on button interactions
- **Mobile-first layout** — max-w-md portrait layout optimized for phones

---

## Tech Stack

### Framework & Runtime

| Tool | Version | Role |
|------|---------|------|
| **Next.js** | 16.1.6 | App router, API routes, SSR |
| **React** | 19.2.3 | UI rendering |
| **TypeScript** | ^5 | Type safety across the entire codebase |

### AI

| Tool | Version | Role |
|------|---------|------|
| **@google/genai** | ^1.44.0 | Official Google Gemini SDK |
| `gemini-2.0-flash-lite-preview` | — | Concept generation and refinement (fast, low cost) |
| `gemini-2.0-flash-image-preview` | — | Hat image generation (primary) |
| `gemini-pro-image-preview` | — | Hat image generation (fallback) |

### UI & Animation

| Tool | Version | Role |
|------|---------|------|
| **Tailwind CSS** | ^4 | Utility-first styling via `@theme` design tokens |
| **Framer Motion** | ^12.35.0 | Page transitions, panel slides, card animations |
| **Lucide React** | ^0.577.0 | Icon set (Camera, ArrowRight, Send, etc.) |

### 3D

| Tool | Version | Role |
|------|---------|------|
| **Three.js** | ^0.183.2 | 3D rendering engine |
| **@react-three/fiber** | ^9.5.0 | React renderer for Three.js |
| **@react-three/drei** | ^10.7.7 | OrbitControls and helpers |

> The `HatModel` Three.js component is built but currently unused in the main flow. The app uses AI-rendered hat images instead.

### Design System

Defined in `src/app/globals.css` via Tailwind v4 `@theme`:

```css
--color-brand:      #b85c2a   /* orange-brown — primary CTA */
--color-bg:         #f2ead9   /* sandy beige — app background */
--color-surface:    #ede4cf   /* slightly deeper beige — cards/panels */
--color-text:       #1c1510   /* near-black */
--color-text-muted: #7c6c56   /* warm gray */
--font-serif:       'Playfair Display', Georgia, serif
```

Utility classes: `.btn-primary` (3D stamped orange button with press animation), `.chip-vintage` (small serif preset chip), `.studio-fab` / `.studio-fab-row` (floating studio action buttons), `.gallery-scroll` / `.gallery-card` (horizontal snap rail).

---

## API Routes

All routes live under `src/app/api/` and require `GEMINI_API_KEY` in `.env.local`. All have `maxDuration = 60`.

| Route | Input | Output |
|-------|-------|--------|
| `POST /api/generate-concepts` | `{ images: string[] }` base64 data URLs | `{ analysis, concepts[] }` |
| `POST /api/generate-hat-image` | Concept fields (name, colours, design, style) | `{ imageData, mimeType, background }` |
| `POST /api/refine-concept` | `{ originalConcept, analysis, refinementPrompt, zoneHint? }` | Updated concept JSON |
| `POST /api/try-on` | `{ personImageBase64, personMimeType, concept }` | `{ imageData, mimeType }` |

---

## Project Structure

```
src/
  app/
    page.tsx              # Upload page (/)
    layout.tsx            # Root layout
    globals.css           # Design tokens + utility classes
    results/
      page.tsx            # Results page — loading, gallery, studio (~900 lines)
    preview/
      page.tsx            # Redirect shim: /results if session exists, else /
    api/
      generate-concepts/  # Gemini vision → concept JSON
      generate-hat-image/ # Gemini image gen → hat PNG
      refine-concept/     # Gemini → updated concept JSON
      try-on/             # Gemini image gen → try-on composite
  components/
    HatPhotoViewer.tsx    # Pan/zoom viewer + circle-draw edit mode
    Hat3DViewer.tsx       # Three.js procedural hat (unused in main flow)
    CacheClearer.tsx      # sessionStorage utility
  hooks/
    useSound.ts           # Web Audio API tactile press sounds
```

---

## Getting Started

**Prerequisites:** Node.js 18+, a Google Gemini API key with image generation access.

```bash
# 1. Install dependencies
npm install

# 2. Add your API key
echo "GEMINI_API_KEY=your_key_here" > .env.local

# 3. Start dev server
npm run dev
# → http://localhost:3000

# 4. Verify build before deploying
npm run build
```

---

## Commands

```bash
npm run dev    # Start development server
npm run build  # Production build + TypeScript type check
npm run lint   # ESLint
```
