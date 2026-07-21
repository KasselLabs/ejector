# Ejector Remotion Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Ejector as a Next.js 16 App Router + TypeScript app with a fully in-browser Remotion render pipeline (Player preview, `@remotion/web-renderer` MP4, gifenc GIF), a modern shadcn/Tailwind layout, and payments via payment-frontend iframe + payment-backend paid-check.

**Architecture:** Single Next.js app (no monorepo). One Remotion composition (`EjectorComposition`) is the sole source of truth for the animation; preview uses `@remotion/player`, exports use `@remotion/web-renderer` in the browser (GIF frames are captured during render via `onFrame` and encoded with `gifenc`). Payment state is a client UUID (`code`) in localStorage; payment-backend's new `GET /payment/:app/:code/paid` endpoint restores the 24 h window. Satellite changes in `../payment-backend` and `../payment-frontend` register the `ejector` app.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Tailwind v4, shadcn/ui, remotion + @remotion/player + @remotion/web-renderer (^4.0.495), gifenc, gifuct-js, react-easy-crop, tinycolor2, Vitest + Testing Library + MSW, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-21-remotion-rebuild-design.md` — read it before starting any task.

## Global Constraints

- TypeScript strict everywhere; no `any` unless interfacing with untyped libs (comment why).
- No browser-native modals — shadcn `Dialog` only.
- All new source under `src/`; path alias `@/*` → `./src/*`.
- Tests live beside source (`foo.ts` ↔ `foo.test.ts`, `Foo.tsx` ↔ `Foo.test.tsx`); lib tests needing DOM use `.dom.test.ts` suffix (jsdom project).
- Network in tests is mocked with MSW (unit/component) or `page.route()` (E2E) — never module-mock `fetch`.
- Animation timing constants are sacred (they replicate the legacy canvas animation): 30 fps, 5.5 s (165 frames), background frames `1.png`–`154.png`, character speed 0.28 widths/s, rotation −1.3 rad/s, character height = height/4.46, ejected text 1.7 s→3.7 s typewriter, impostor text starts 3.8 s with scale keyframes `[0,.33,.66,1,1.2]→[0.7,1.2,0.8,1.1,1]`, font size 6.7 % of height, watermark `EJECTOR.KASSELLABS.IO`.
- Pricing: GIF free; MP4 $3 (=300¢, 1280×720, watermarked) / $5 (=500¢, 1920×1080, clean); 24 h unlimited window.
- The legacy implementation is reachable at git tag `legacy-canvas` (`git show legacy-canvas:src/util/drawAnimation.js` etc.) — created in Task 1.
- Commit after every green test cycle. Commit messages end with:
  `Claude-Session: https://claude.ai/code/session_01VSDVCfzR9DU8Q4feBpMoKZ`
- Working directory for Tasks 1–13, 16, 17: `/home/nihey/devel/ejector`. Task 14: `/home/nihey/devel/payment-backend`. Task 15: `/home/nihey/devel/payment-frontend`.

## Shared interfaces (defined in Task 2, consumed everywhere)

```ts
// src/types.ts
export interface CharacterFrame {
  imageUrl: string;
  startSeconds: number;
  endSeconds: number;
}
export interface CharacterFrames {
  durationSeconds: number;
  frames: CharacterFrame[];
}
export interface EjectorProps extends Record<string, unknown> {
  ejectedText: string;
  impostorText: string;
  characterFrames: CharacterFrames;
  showWatermark: boolean;
}
export type PaidTier = "hd" | "full-hd";
export interface PaidStatus {
  paid: boolean;
  dollarValue?: number;
  paidAt?: string;
}
export interface PaymentSuccessPayload {
  amount: number;
  finalAmount: number;
  currency: string;
  email: string;
  receiptURL?: string;
  method: "stripe" | "paypal" | "coupon";
}
```

---

### Task 1: Scaffold the new app (tag legacy, replace toolchain)

**Files:**
- Create: `package.json` (rewrite), `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx` (stub), `src/app/globals.css`, `src/test/msw/server.ts`, `src/test/msw/handlers.ts`, `components.json`, `.env.example`
- Delete: `pages/`, `src/components/`, `src/util/`, `src/hooks/`, `src/contexts/`, `src/constants/`, `src/events.js`, `src/track.js`, `src/theme.js`, `styles/`, `i18next-scanner.config.js`, `next-i18next.config.js`, `next.config.js`, `linode-storage/`, `public/ffmpeg-worker-mp4.js`, `public/gif.worker.js`, `.eslintrc` (if present)
- Keep: `public/among-us-background-images/`, `public/among-us-red-character-color-reduced.png`, `public/*.mp3`, `public/*.m4a`, `public/favicon*`, `public/og-image.png`, `public/twitter-card.png`, `public/kassel-labs-logo.svg`, `public/static/locales/` (consumed by Task 4, deleted there)

**Interfaces:**
- Produces: a booting Next.js 16 App Router skeleton with working `npm run dev`, `npm run lint`, `npm run typecheck`, `npm test` (0 tests OK), shadcn `Button`/`Dialog`/`Input`/`Label`/`Progress` under `src/components/ui/`, MSW test server at `src/test/msw/server.ts` exporting `server`.

- [ ] **Step 1: Tag the legacy tree**

```bash
cd /home/nihey/devel/ejector && git tag legacy-canvas && git push --no-verify origin legacy-canvas 2>/dev/null || true
```
(Local tag is enough if push fails.)

- [ ] **Step 2: Delete legacy source (keep assets)**

```bash
git rm -r pages src styles i18next-scanner.config.js next-i18next.config.js next.config.js linode-storage public/ffmpeg-worker-mp4.js public/gif.worker.js
```

- [ ] **Step 3: Write the new `package.json`**

```json
{
  "name": "ejector",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui"
  }
}
```

Then install (exact packages):

```bash
npm install next@16 react@19 react-dom@19 remotion@^4.0.495 @remotion/player@^4.0.495 @remotion/web-renderer@^4.0.495 gifenc gifuct-js react-easy-crop tinycolor2 clsx tailwind-merge class-variance-authority lucide-react
npm install -D typescript @types/node @types/react @types/react-dom @types/tinycolor2 tailwindcss @tailwindcss/postcss eslint@^9 eslint-config-next@16 vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event vite-tsconfig-paths msw @playwright/test vitest-canvas-mock
```

- [ ] **Step 4: Copy toolchain configs from star-wars-intro-creator-new, adapted**

Copy verbatim from `/home/nihey/devel/star-wars-intro-creator-new/`: `tsconfig.json`, `postcss.config.mjs`, `vitest.config.ts`, `playwright.config.ts`. Copy `vitest.setup.ts` as-is (it imports `./src/test/msw/server`). Copy `eslint.config.mjs` from that repo and drop any Sentry-specific entries. Write `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 5: App shell**

`src/app/globals.css`:

```css
@import "tailwindcss";
@import "tw-animate-css";

:root {
  --background: #0b0e1a;
  --foreground: #e8eaf2;
}

body {
  background: var(--background);
  color: var(--foreground);
}
```

(`npm install -D tw-animate-css` — shadcn v4 style needs it.)

`src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ejector - Eject Someone",
  description:
    "Create your own Among Us ejection GIF or video. Customize the character, texts and download it.",
  openGraph: { images: ["/og-image.png"] },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx` (stub, replaced in Task 11):

```tsx
export default function Home() {
  return <main>Ejector</main>;
}
```

- [ ] **Step 6: shadcn init + components**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button dialog input label progress
```

If `init` asks, choose: New York style, neutral base color, CSS variables. Verify components landed in `src/components/ui/`.

- [ ] **Step 7: MSW server**

`src/test/msw/handlers.ts`:

```ts
import type { RequestHandler } from "msw";

export const handlers: RequestHandler[] = [];
```

`src/test/msw/server.ts`:

```ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

- [ ] **Step 8: `.env.example`**

```
NEXT_PUBLIC_PAYMENT_PAGE_URL=https://payment.kassellabs.io
NEXT_PUBLIC_PAYMENT_API_URL=
NEXT_PUBLIC_ADMIN_GRAPHQL_URL=https://admin.kassellabs.io/graphql
NEXT_PUBLIC_GA_ID=
```

- [ ] **Step 9: Verify the skeleton**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: all pass (vitest exits 0 with "no test files found" is acceptable — if vitest errors on zero tests, add `passWithNoTests: true` to the shared test config).

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: scaffold Next.js 16 + TypeScript + Tailwind app, remove legacy stack"
```

---

### Task 2: Shared types + character-frames library

**Files:**
- Create: `src/types.ts` (content exactly as in "Shared interfaces" above)
- Create: `src/lib/characterImages.ts`, Test: `src/lib/characterImages.test.ts`
- Create: `src/lib/corsUrl.ts`, Test: `src/lib/corsUrl.test.ts`

**Interfaces:**
- Produces:
  - `staticCharacterFrames(imageUrl: string): CharacterFrames` — single frame spanning the whole animation.
  - `characterFrameAt(frames: CharacterFrames, tSeconds: number): CharacterFrame` — looped lookup (`t % duration`), falls back to first frame.
  - `getCorsUrl(url: string): string` — prefixes `https://cors.kassellabs.io/` for http(s) URLs, passthrough otherwise (data:, blob:, relative).
  - `ANIMATION_SECONDS = 5.5`, `ANIMATION_FPS = 30`, `ANIMATION_DURATION_IN_FRAMES = 165` exported from `src/lib/animationConstants.ts` (create it here too).

- [ ] **Step 1: Write failing tests**

`src/lib/characterImages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  staticCharacterFrames,
  characterFrameAt,
} from "./characterImages";
import type { CharacterFrames } from "@/types";

describe("staticCharacterFrames", () => {
  it("wraps a single URL into one frame covering the whole animation", () => {
    const result = staticCharacterFrames("/red.png");
    expect(result.frames).toHaveLength(1);
    expect(result.frames[0].imageUrl).toBe("/red.png");
    expect(result.frames[0].startSeconds).toBe(0);
    expect(result.frames[0].endSeconds).toBeGreaterThanOrEqual(5.5);
    expect(result.durationSeconds).toBeGreaterThanOrEqual(5.5);
  });
});

describe("characterFrameAt", () => {
  const gif: CharacterFrames = {
    durationSeconds: 0.3,
    frames: [
      { imageUrl: "a.png", startSeconds: 0, endSeconds: 0.1 },
      { imageUrl: "b.png", startSeconds: 0.1, endSeconds: 0.2 },
      { imageUrl: "c.png", startSeconds: 0.2, endSeconds: 0.3 },
    ],
  };

  it("returns the frame containing t", () => {
    expect(characterFrameAt(gif, 0.15).imageUrl).toBe("b.png");
  });

  it("loops past the gif duration", () => {
    expect(characterFrameAt(gif, 0.35).imageUrl).toBe("a.png");
  });

  it("falls back to the first frame on boundary misses", () => {
    expect(characterFrameAt(gif, 0.3).imageUrl).toBe("a.png");
  });

  it("static frames always resolve", () => {
    const s = staticCharacterFrames("/red.png");
    expect(characterFrameAt(s, 5.4).imageUrl).toBe("/red.png");
  });
});
```

`src/lib/corsUrl.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getCorsUrl } from "./corsUrl";

describe("getCorsUrl", () => {
  it("proxies http(s) URLs", () => {
    expect(getCorsUrl("https://example.com/a.png")).toBe(
      "https://cors.kassellabs.io/https://example.com/a.png",
    );
  });
  it("passes through data URLs and relative paths", () => {
    expect(getCorsUrl("data:image/png;base64,xx")).toBe(
      "data:image/png;base64,xx",
    );
    expect(getCorsUrl("/red.png")).toBe("/red.png");
  });
});
```

- [ ] **Step 2: Run tests, verify failure**

Run: `npx vitest run src/lib/characterImages.test.ts src/lib/corsUrl.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/lib/animationConstants.ts`:

```ts
export const ANIMATION_FPS = 30;
export const ANIMATION_SECONDS = 5.5;
export const ANIMATION_DURATION_IN_FRAMES = ANIMATION_SECONDS * ANIMATION_FPS; // 165
export const COMPOSITION_WIDTH = 1920;
export const COMPOSITION_HEIGHT = 1080;
```

`src/lib/characterImages.ts`:

```ts
import type { CharacterFrame, CharacterFrames } from "@/types";
import { ANIMATION_SECONDS } from "./animationConstants";

export function staticCharacterFrames(imageUrl: string): CharacterFrames {
  return {
    durationSeconds: ANIMATION_SECONDS,
    frames: [
      { imageUrl, startSeconds: 0, endSeconds: ANIMATION_SECONDS },
    ],
  };
}

export function characterFrameAt(
  frames: CharacterFrames,
  tSeconds: number,
): CharacterFrame {
  const looped =
    frames.durationSeconds > 0 ? tSeconds % frames.durationSeconds : 0;
  const found = frames.frames.find(
    (f) => looped >= f.startSeconds && looped < f.endSeconds,
  );
  return found ?? frames.frames[0];
}
```

`src/lib/corsUrl.ts`:

```ts
export function getCorsUrl(url: string): string {
  return /^https?:\/\//.test(url)
    ? `https://cors.kassellabs.io/${url}`
    : url;
}
```

- [ ] **Step 4: Run tests, verify pass** — same command, expected PASS.

- [ ] **Step 5: Commit** — `git add src/types.ts src/lib && git commit -m "feat: shared types, character frame lookup, cors url helper"`

---

### Task 3: Remotion composition

**Files:**
- Create: `src/remotion/EjectorComposition.tsx`
- Test: `src/remotion/EjectorComposition.test.tsx`

**Interfaces:**
- Consumes: `EjectorProps`, `characterFrameAt`, animation constants (Task 2).
- Produces: `EjectorComposition: React.FC<EjectorProps>` — everything sized relative to `useVideoConfig()` so it renders correctly at 1920×1080, 1280×720 and 480×270. Also exports `DEFAULT_CHARACTER_URL = "/among-us-red-character-color-reduced.png"` and re-exports the constants. Layers carry `data-testid`s: `bg-frame`, `ejected-text`, `impostor-text`, `character`, `watermark`.

- [ ] **Step 1: Write failing tests**

`src/remotion/EjectorComposition.test.tsx` — test the pure-timing helpers exported from the module plus a frame render via Remotion's test-friendly `<Thumbnail>`-free approach: render the component directly inside a mocked Remotion context is heavyweight, so structure the module as **pure helper functions + thin JSX** and test the helpers:

```tsx
import { describe, expect, it } from "vitest";
import {
  backgroundFrameSrc,
  ejectedTextAt,
  impostorScaleAt,
  characterTransformAt,
} from "./EjectorComposition";

describe("backgroundFrameSrc", () => {
  it("maps frame 0 to 1.png and clamps at 154.png", () => {
    expect(backgroundFrameSrc(0)).toBe("/among-us-background-images/1.png");
    expect(backgroundFrameSrc(153)).toBe("/among-us-background-images/154.png");
    expect(backgroundFrameSrc(164)).toBe("/among-us-background-images/154.png");
  });
});

describe("ejectedTextAt", () => {
  it("is empty before 1.7s, full after 3.7s, partial between", () => {
    expect(ejectedTextAt("Red was ejected", 1.6)).toBe("");
    expect(ejectedTextAt("Red was ejected", 3.8)).toBe("Red was ejected");
    const partial = ejectedTextAt("Red was ejected", 2.7); // 50%
    expect(partial.length).toBeGreaterThan(0);
    expect(partial.length).toBeLessThan("Red was ejected".length);
    expect("Red was ejected".startsWith(partial)).toBe(true);
  });
});

describe("impostorScaleAt", () => {
  it("is null before 3.8s (not rendered)", () => {
    expect(impostorScaleAt(3.7)).toBeNull();
  });
  it("interpolates the pop keyframes and settles at 1", () => {
    expect(impostorScaleAt(3.8 + 0.33)).toBeCloseTo(1.2, 5);
    expect(impostorScaleAt(3.8 + 1.2)).toBeCloseTo(1, 5);
    expect(impostorScaleAt(5.4)).toBe(1);
  });
});

describe("characterTransformAt", () => {
  it("moves right at 0.28 widths/s and rotates at -1.3 rad/s", () => {
    const { xPct, rotationRad } = characterTransformAt(2);
    expect(xPct).toBeCloseTo(0.28 * 2 * 100, 5);
    expect(rotationRad).toBeCloseTo(-2.6, 5);
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run src/remotion/EjectorComposition.test.tsx` — module not found.

- [ ] **Step 3: Implement**

`src/remotion/EjectorComposition.tsx`:

```tsx
import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { EjectorProps } from "@/types";
import { characterFrameAt } from "@/lib/characterImages";
import {
  ANIMATION_FPS,
  ANIMATION_DURATION_IN_FRAMES,
  COMPOSITION_WIDTH,
  COMPOSITION_HEIGHT,
} from "@/lib/animationConstants";

export {
  ANIMATION_FPS as COMPOSITION_FPS,
  ANIMATION_DURATION_IN_FRAMES as COMPOSITION_DURATION_IN_FRAMES,
  COMPOSITION_WIDTH,
  COMPOSITION_HEIGHT,
};

export const DEFAULT_CHARACTER_URL =
  "/among-us-red-character-color-reduced.png";

const BACKGROUND_FRAME_COUNT = 154; // 1.png .. 154.png

export function backgroundFrameSrc(frame: number): string {
  const index = Math.min(BACKGROUND_FRAME_COUNT - 1, Math.round(frame));
  return `/among-us-background-images/${index + 1}.png`;
}

const EJECTED_TEXT_START = 1.7;
const EJECTED_TEXT_DURATION = 2;

export function ejectedTextAt(text: string, tSeconds: number): string {
  if (tSeconds < EJECTED_TEXT_START) return "";
  if (tSeconds >= EJECTED_TEXT_START + EJECTED_TEXT_DURATION) return text;
  const pct = (tSeconds - EJECTED_TEXT_START) / EJECTED_TEXT_DURATION;
  return text.slice(0, Math.round(text.length * pct));
}

const IMPOSTOR_START = 3.8;
const IMPOSTOR_STAGES = [0, 0.33, 0.66, 1, 1.2];
const IMPOSTOR_SCALES = [0.7, 1.2, 0.8, 1.1, 1];

export function impostorScaleAt(tSeconds: number): number | null {
  const diff = tSeconds - IMPOSTOR_START;
  if (diff <= 0) return null;
  if (diff >= IMPOSTOR_STAGES[IMPOSTOR_STAGES.length - 1]) return 1;
  return interpolate(diff, IMPOSTOR_STAGES, IMPOSTOR_SCALES);
}

const CHARACTER_SPEED_X = 0.28; // composition-widths per second
const CHARACTER_ROTATION_SPEED = 1.3; // rad per second

export function characterTransformAt(tSeconds: number): {
  xPct: number;
  rotationRad: number;
} {
  return {
    xPct: CHARACTER_SPEED_X * tSeconds * 100,
    rotationRad: -CHARACTER_ROTATION_SPEED * tSeconds,
  };
}

export const EjectorComposition: React.FC<EjectorProps> = ({
  ejectedText,
  impostorText,
  characterFrames,
  showWatermark,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = frame / ANIMATION_FPS;

  const characterFrame = characterFrameAt(characterFrames, t);
  const { xPct, rotationRad } = characterTransformAt(t);
  const impostorScale = impostorScaleAt(t);
  const baseFontSize = 0.067 * height;

  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      <Img
        data-testid="bg-frame"
        src={staticFile(backgroundFrameSrc(frame).slice(1))}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "fill",
        }}
      />
      {/* Cover the tiny imperfection baked into the source frames */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "65%",
          width: "5%",
          height: "9%",
          background: "black",
        }}
      />
      <div
        data-testid="ejected-text"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontFamily: "Arial, sans-serif",
          fontSize: baseFontSize,
          whiteSpace: "pre-wrap",
          textAlign: "center",
        }}
      >
        {ejectedTextAt(ejectedText, t)}
      </div>
      {impostorScale !== null && (
        <div
          data-testid="impostor-text"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `translateY(${0.0804 * height}px)`,
            color: "white",
            fontFamily: "Arial, sans-serif",
            fontSize: baseFontSize * impostorScale,
            textAlign: "center",
          }}
        >
          {impostorText}
        </div>
      )}
      <Img
        data-testid="character"
        src={
          characterFrame.imageUrl.startsWith("/")
            ? staticFile(characterFrame.imageUrl.slice(1))
            : characterFrame.imageUrl
        }
        style={{
          position: "absolute",
          left: `${xPct}%`,
          top: "50%",
          height: height / 4.46,
          transform: `translate(-50%, -50%) rotate(${rotationRad}rad)`,
        }}
      />
      {showWatermark && (
        <div
          data-testid="watermark"
          style={{
            position: "absolute",
            right: 0.008 * width,
            bottom: 0.018 * height,
            color: "rgba(255, 255, 255, 0.6)",
            fontFamily: "Arial, sans-serif",
            fontSize: 0.08 * height,
            lineHeight: 1,
          }}
        >
          EJECTOR.KASSELLABS.IO
        </div>
      )}
      <Audio src={staticFile("ejected.mp3")} />
    </AbsoluteFill>
  );
};
```

Note: `staticFile()` requires paths without a leading slash; `characterFrame.imageUrl` may be a data:/blob:/https: URL (used verbatim) or the default `/among-us-red-character-color-reduced.png` (routed through `staticFile`).

- [ ] **Step 4: Run tests, verify PASS.**
- [ ] **Step 5: Run** `npm run typecheck` — PASS.
- [ ] **Step 6: Commit** — `git commit -am "feat: EjectorComposition Remotion port of the canvas animation"`

---

### Task 4: i18n (en + pt-BR)

**Files:**
- Create: `src/locales/en.json`, `src/locales/pt-BR.json`, `src/lib/i18n.tsx`
- Test: `src/lib/i18n.test.tsx`
- Delete: `public/static/` (after porting strings)

**Interfaces:**
- Produces: `I18nProvider({children})`, `useT(): (key: string) => string`, `useLocale(): { locale: "en" | "pt-BR"; setLocale(l): void }`. Keys are the English strings (same convention as legacy files). Locale detection: localStorage `ejector-locale` → `navigator.language` startsWith "pt" → `pt-BR`, else `en`.

- [ ] **Step 1: Port dictionaries.** Copy `public/static/locales/en/common.json` → `src/locales/en.json` and `public/static/locales/pt-BR/common.json` → `src/locales/pt-BR.json` (ignore `pt`). Remove keys for dropped features (ProductHunt, PayPal-specific strings like `'Validating Payment'`, `'Order ID'`, `'Paste your Order ID here'`, `'Invalid Order Id'`) and add new keys used by Tasks 11–13 with pt-BR translations:
  - `"Download Video"`, `"Generating"`, `"Preparing your video..."`, `"Payment received! Generating your video..."`, `"Choose your video quality"`, `"HD Video"`, `"Full HD Video"`, `"MP4 File"`, `"Includes Watermark"`, `"No Watermark"`, `"Available for"`, `"After the payment, you'll be able download unlimited videos for a 24 hour period"`, `"Your browser can't render videos"`, `"Video export needs a Chromium-based browser (Chrome, Edge, Brave) or recent Safari. The preview still works everywhere."`, `"Subscribe"`, `"Your email"`, `"Unsubscribe"`, `"You have been unsubscribed"`, `"Something went wrong. Please try again."`
- [ ] **Step 2: Write failing test** `src/lib/i18n.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider, useT, useLocale } from "./i18n";

function Probe() {
  const t = useT();
  const { setLocale } = useLocale();
  return (
    <div>
      <span data-testid="value">{t("Ejection Text")}</span>
      <button onClick={() => setLocale("pt-BR")}>pt</button>
    </div>
  );
}

describe("i18n", () => {
  it("returns the key itself in English and the translation in pt-BR", async () => {
    const { getByText } = render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId("value").textContent).toBe("Ejection Text");
    getByText("pt").click();
    await Promise.resolve();
    expect(screen.getByTestId("value").textContent).not.toBe("Ejection Text");
  });

  it("falls back to the key for unknown strings", () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId("value")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Verify FAIL, then implement** `src/lib/i18n.tsx`:

```tsx
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import ptBR from "@/locales/pt-BR.json";

export type Locale = "en" | "pt-BR";

const dictionaries: Record<Locale, Record<string, string>> = {
  en: {},
  "pt-BR": ptBR as Record<string, string>,
};

const STORAGE_KEY = "ejector-locale";

function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "pt-BR") return stored;
  return window.navigator.language?.toLowerCase().startsWith("pt")
    ? "pt-BR"
    : "en";
}

const I18nContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
}>({ locale: "en", setLocale: () => {} });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
  }, []);

  return (
    <I18nContext.Provider value={{ locale, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useLocale() {
  return useContext(I18nContext);
}

export function useT(): (key: string) => string {
  const { locale } = useContext(I18nContext);
  return useCallback(
    (key: string) => dictionaries[locale][key] ?? key,
    [locale],
  );
}
```

Note: `en.json` stays on disk as documentation of every key, but the runtime English path returns the key itself. Keep `resolveJsonModule` on (it is, in tsconfig).

- [ ] **Step 4: PASS + typecheck.**
- [ ] **Step 5:** `git rm -r public/static` and commit — `feat: en/pt-BR i18n with dictionary context`.

---

### Task 5: Config + tracking

**Files:**
- Create: `src/lib/config.ts`, `src/lib/tracking.ts`
- Test: `src/lib/config.test.ts`, `src/lib/tracking.dom.test.ts`

**Interfaces:**
- Produces:
  - config: `paymentPageUrl` (default `https://payment.kassellabs.io`), `paymentApiUrl` (default `""`), `adminGraphqlUrl` (default `https://admin.kassellabs.io/graphql`), `gaId` — all trailing-slash-stripped strings from `process.env.NEXT_PUBLIC_*`.
  - tracking: `track(...args: unknown[])` (safe gtag proxy, console.log fallback), `trackEvent(name: string, params?: Record<string, unknown>)`.

- [ ] **Step 1: Failing tests.** `src/lib/config.test.ts` asserts defaults and trailing-slash stripping (set `process.env` via `vi.stubEnv` before dynamic `import()` of the module with `vi.resetModules()`). `src/lib/tracking.dom.test.ts` asserts `trackEvent("paid")` calls `window.gtag("event", "paid", {})` when defined and does not throw when undefined.

```ts
// src/lib/config.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("config", () => {
  it("uses production defaults", async () => {
    const config = await import("./config");
    expect(config.paymentPageUrl).toBe("https://payment.kassellabs.io");
    expect(config.adminGraphqlUrl).toBe("https://admin.kassellabs.io/graphql");
  });

  it("strips trailing slashes from env overrides", async () => {
    vi.stubEnv("NEXT_PUBLIC_PAYMENT_API_URL", "https://pay.test/");
    const config = await import("./config");
    expect(config.paymentApiUrl).toBe("https://pay.test");
  });
});
```

```ts
// src/lib/tracking.dom.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { trackEvent } from "./tracking";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

afterEach(() => {
  delete window.gtag;
});

describe("trackEvent", () => {
  it("forwards to window.gtag when available", () => {
    window.gtag = vi.fn();
    trackEvent("paid", { value: 5 });
    expect(window.gtag).toHaveBeenCalledWith("event", "paid", { value: 5 });
  });

  it("does not throw without gtag", () => {
    expect(() => trackEvent("paid")).not.toThrow();
  });
});
```

- [ ] **Step 2: FAIL, then implement.**

```ts
// src/lib/config.ts
function stripSlash(v: string | undefined, fallback: string): string {
  return (v ?? fallback).replace(/\/+$/, "");
}

export const paymentPageUrl = stripSlash(
  process.env.NEXT_PUBLIC_PAYMENT_PAGE_URL,
  "https://payment.kassellabs.io",
);
export const paymentApiUrl = stripSlash(
  process.env.NEXT_PUBLIC_PAYMENT_API_URL,
  "",
);
export const adminGraphqlUrl = stripSlash(
  process.env.NEXT_PUBLIC_ADMIN_GRAPHQL_URL,
  "https://admin.kassellabs.io/graphql",
);
export const gaId = process.env.NEXT_PUBLIC_GA_ID ?? "";
```

```ts
// src/lib/tracking.ts
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(...args: unknown[]): void {
  if (typeof window === "undefined" || !window.gtag) {
    console.log(...args);
    return;
  }
  window.gtag(...args);
}

export function trackEvent(
  name: string,
  params: Record<string, unknown> = {},
): void {
  track("event", name, params);
}
```

- [ ] **Step 3: PASS + commit** — `feat: env config and gtag tracking helpers`.

---

### Task 6: Payment client libs (code, events, paid status)

**Files:**
- Create: `src/lib/payment/clientCode.ts`, `src/lib/payment/paymentEvents.ts`, `src/lib/payment/paidStatus.ts`
- Test: `src/lib/payment/clientCode.dom.test.ts`, `src/lib/payment/paymentEvents.dom.test.ts`, `src/lib/payment/paidStatus.test.ts`

**Interfaces:**
- Consumes: `paymentPageUrl`, `paymentApiUrl` (Task 5), `PaidStatus`, `PaidTier`, `PaymentSuccessPayload` (Task 2).
- Produces:
  - `getClientCode(): string` — localStorage key `ejector-payment-code`, `crypto.randomUUID()` on first call.
  - `registerPaymentEventsHandler(cb: (p: PaymentSuccessPayload) => void)` / `unregisterPaymentEventsHandler()` — window `message` listener, **origin must equal `new URL(paymentPageUrl).origin`**, message shape `{type:"payment", action:"success", payload}` (port of star-wars-intro-creator-new `src/lib/paymentEvents.ts`).
  - `fetchPaidStatus(code: string): Promise<PaidStatus>` — `GET ${paymentApiUrl}/payment/ejector/${code}/paid`; network/HTTP errors resolve `{paid:false}` (never throw).
  - `tierForDollarValue(v: number | undefined): PaidTier` — `v ≥ 5 → "full-hd"` else `"hd"`.
  - `tierForCents(c: number): PaidTier` — `c ≥ 500 → "full-hd"` else `"hd"`.

- [ ] **Step 1: Failing tests.**

`clientCode.dom.test.ts`: generates a UUID once and returns the same value on subsequent calls (clear localStorage in beforeEach).

`paymentEvents.dom.test.ts`: dispatches `MessageEvent` with correct origin+shape → callback fires with payload; wrong origin or wrong shape → callback not called; after `unregister` → not called. Build events with `new MessageEvent("message", { data, origin })` and `window.dispatchEvent`.

`paidStatus.test.ts` (node + MSW): add per-test handlers via `server.use(http.get("*/payment/ejector/CODE/paid", () => HttpResponse.json({ paid: true, dollarValue: 5 })))`; assert paid result, `{paid:false}` on 500, `{paid:false}` on network error (`HttpResponse.error()`). Also unit-test `tierForDollarValue(3)="hd"`, `(5)="full-hd"`, `(undefined)="hd"` and `tierForCents(300)="hd"`, `(500)="full-hd"`.

```ts
// src/lib/payment/paidStatus.test.ts
import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { fetchPaidStatus, tierForCents, tierForDollarValue } from "./paidStatus";

describe("fetchPaidStatus", () => {
  it("returns the backend payload", async () => {
    server.use(
      http.get("*/payment/ejector/CODE/paid", () =>
        HttpResponse.json({ paid: true, dollarValue: 5 }),
      ),
    );
    await expect(fetchPaidStatus("CODE")).resolves.toEqual({
      paid: true,
      dollarValue: 5,
    });
  });

  it("resolves {paid:false} on HTTP error", async () => {
    server.use(
      http.get("*/payment/ejector/CODE/paid", () =>
        HttpResponse.json({ error: "x" }, { status: 500 }),
      ),
    );
    await expect(fetchPaidStatus("CODE")).resolves.toEqual({ paid: false });
  });

  it("resolves {paid:false} on network failure", async () => {
    server.use(
      http.get("*/payment/ejector/CODE/paid", () => HttpResponse.error()),
    );
    await expect(fetchPaidStatus("CODE")).resolves.toEqual({ paid: false });
  });
});

describe("tiers", () => {
  it("maps dollar values", () => {
    expect(tierForDollarValue(3)).toBe("hd");
    expect(tierForDollarValue(5)).toBe("full-hd");
    expect(tierForDollarValue(undefined)).toBe("hd");
  });
  it("maps cents", () => {
    expect(tierForCents(300)).toBe("hd");
    expect(tierForCents(500)).toBe("full-hd");
  });
});
```

- [ ] **Step 2: FAIL, then implement.**

```ts
// src/lib/payment/clientCode.ts
const STORAGE_KEY = "ejector-payment-code";

export function getClientCode(): string {
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const code = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, code);
  return code;
}
```

```ts
// src/lib/payment/paymentEvents.ts
import { paymentPageUrl } from "@/lib/config";
import type { PaymentSuccessPayload } from "@/types";

type SuccessCallback = (payment: PaymentSuccessPayload) => void;

const callbacks: { success: SuccessCallback | null } = { success: null };

function getAllowedOrigin(): string {
  try {
    return new URL(paymentPageUrl).origin;
  } catch {
    return "https://payment.kassellabs.io";
  }
}

function isPaymentMessage(
  value: unknown,
): value is { type: string; action: string; payload: PaymentSuccessPayload } {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.type === "payment" && typeof v.action === "string";
}

function handler(event: MessageEvent): void {
  if (event.origin !== getAllowedOrigin()) return;
  if (!isPaymentMessage(event.data)) return;
  if (event.data.action === "success") {
    callbacks.success?.(event.data.payload);
  }
}

export function registerPaymentEventsHandler(cb: SuccessCallback): void {
  callbacks.success = cb;
  window.addEventListener("message", handler);
}

export function unregisterPaymentEventsHandler(): void {
  callbacks.success = null;
  window.removeEventListener("message", handler);
}
```

```ts
// src/lib/payment/paidStatus.ts
import { paymentApiUrl } from "@/lib/config";
import type { PaidStatus, PaidTier } from "@/types";

export async function fetchPaidStatus(code: string): Promise<PaidStatus> {
  try {
    const res = await fetch(
      `${paymentApiUrl}/payment/ejector/${encodeURIComponent(code)}/paid`,
    );
    if (!res.ok) return { paid: false };
    return (await res.json()) as PaidStatus;
  } catch {
    return { paid: false };
  }
}

export function tierForDollarValue(v: number | undefined): PaidTier {
  return v !== undefined && v >= 5 ? "full-hd" : "hd";
}

export function tierForCents(c: number): PaidTier {
  return c >= 500 ? "full-hd" : "hd";
}
```

- [ ] **Step 3: PASS + commit** — `feat: payment client code, postMessage events, paid-status client`.

---

### Task 7: PaymentProvider context

**Files:**
- Create: `src/contexts/PaymentProvider.tsx`
- Test: `src/contexts/PaymentProvider.test.tsx`

**Interfaces:**
- Consumes: Task 6 libs, `trackEvent` (Task 5).
- Produces: `PaymentProvider({children})` and `usePayment(): { paid: boolean; tier: PaidTier | null; code: string | null; refresh(): Promise<void>; markPaid(finalAmountCents: number): void }`.
  - On mount: resolves `code` via `getClientCode()` and calls `fetchPaidStatus`; if paid, sets `paid=true`, `tier=tierForDollarValue(dollarValue)`.
  - `markPaid(cents)`: sets `paid=true`, `tier=tierForCents(cents)`, fires `trackEvent("paid")`.

- [ ] **Step 1: Failing component test** — render a probe under `PaymentProvider` with MSW returning `{paid:true, dollarValue:5}`; expect probe to eventually show `paid:true tier:full-hd` (use `findByText`). Second test: MSW `{paid:false}` + call `markPaid(300)` via a button → `paid:true tier:hd`.

```tsx
// src/contexts/PaymentProvider.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { PaymentProvider, usePayment } from "./PaymentProvider";

function Probe() {
  const { paid, tier, markPaid } = usePayment();
  return (
    <div>
      <span data-testid="state">{`paid:${paid} tier:${tier}`}</span>
      <button onClick={() => markPaid(300)}>pay</button>
    </div>
  );
}

describe("PaymentProvider", () => {
  it("restores a paid session from the backend", async () => {
    server.use(
      http.get("*/payment/ejector/:code/paid", () =>
        HttpResponse.json({ paid: true, dollarValue: 5 }),
      ),
    );
    render(
      <PaymentProvider>
        <Probe />
      </PaymentProvider>,
    );
    expect(
      await screen.findByText("paid:true tier:full-hd"),
    ).toBeInTheDocument();
  });

  it("markPaid unlocks immediately with the cents-derived tier", async () => {
    server.use(
      http.get("*/payment/ejector/:code/paid", () =>
        HttpResponse.json({ paid: false }),
      ),
    );
    render(
      <PaymentProvider>
        <Probe />
      </PaymentProvider>,
    );
    await screen.findByText("paid:false tier:null");
    await userEvent.click(screen.getByText("pay"));
    expect(screen.getByText("paid:true tier:hd")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: FAIL, then implement:**

```tsx
// src/contexts/PaymentProvider.tsx
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { PaidTier } from "@/types";
import { getClientCode } from "@/lib/payment/clientCode";
import {
  fetchPaidStatus,
  tierForCents,
  tierForDollarValue,
} from "@/lib/payment/paidStatus";
import { trackEvent } from "@/lib/tracking";

interface PaymentState {
  paid: boolean;
  tier: PaidTier | null;
  code: string | null;
  refresh: () => Promise<void>;
  markPaid: (finalAmountCents: number) => void;
}

const PaymentContext = createContext<PaymentState>({
  paid: false,
  tier: null,
  code: null,
  refresh: async () => {},
  markPaid: () => {},
});

export function PaymentProvider({ children }: { children: React.ReactNode }) {
  const [paid, setPaid] = useState(false);
  const [tier, setTier] = useState<PaidTier | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const clientCode = getClientCode();
    setCode(clientCode);
    const status = await fetchPaidStatus(clientCode);
    if (status.paid) {
      setPaid(true);
      setTier(tierForDollarValue(status.dollarValue));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markPaid = useCallback((finalAmountCents: number) => {
    setPaid(true);
    setTier(tierForCents(finalAmountCents));
    trackEvent("paid");
  }, []);

  return (
    <PaymentContext.Provider value={{ paid, tier, code, refresh, markPaid }}>
      {children}
    </PaymentContext.Provider>
  );
}

export function usePayment(): PaymentState {
  return useContext(PaymentContext);
}
```

- [ ] **Step 3: PASS + commit** — `feat: PaymentProvider context with paid-window restore`.

---

### Task 8: Render pipeline (MP4 + GIF + capability + download)

**Files:**
- Create: `src/lib/render/capability.ts`, `src/lib/render/renderVideo.ts`, `src/lib/render/renderGif.ts`, `src/lib/render/download.ts`
- Test: `src/lib/render/capability.test.ts`, `src/lib/render/renderVideo.test.ts`, `src/lib/render/renderGif.test.ts`, `src/lib/render/download.dom.test.ts`

**Interfaces:**
- Consumes: `EjectorComposition` + constants (Task 3), `EjectorProps`, `PaidTier` (Task 2).
- Produces:
  - `checkRenderSupport(): Promise<{ supported: boolean; reason: string | null }>` — wraps `canRenderMediaOnWeb({ width: 1920, height: 1080, container: "mp4" })`; `supported=false` collects error-severity issue messages into `reason`.
  - `renderEjectionVideo(opts: { props: EjectorProps; tier: PaidTier; onProgress?: (fraction: number) => void }): Promise<Blob>` — `hd` → 1280×720 with `showWatermark: true` forced; `full-hd` → 1920×1080, watermark off. Uses `renderMediaOnWeb` with `container:"mp4"`, `videoCodec:"h264"`. Progress fraction = `encodedFrames / 165`.
  - `renderEjectionGif(opts: { props: EjectorProps; onProgress?: (fraction: number) => void }): Promise<Blob>` — renders 480×270, `muted: true`, watermark forced on; captures every 3rd frame via `onFrame` into RGBA buffers; encodes with `gifenc` (per-frame `quantize`/`applyPalette`, `delay: 100`). Returns `image/gif` Blob.
  - `downloadBlob(blob: Blob, filename: string): void` and `ejectionFilename(text: string, ext: "gif" | "mp4"): string` (whitespace → `-`).
- **Testing note:** mock `@remotion/web-renderer` with `vi.mock` in these unit tests (module boundary, not network — this is the one place module mocking is correct). Assert our wrapper passes the right composition dimensions/props and maps progress; do NOT try to execute real WebCodecs in jsdom. Real encoding is verified manually in Chrome (Task 11 checkpoint).

- [ ] **Step 1: Failing tests.**

```ts
// src/lib/render/renderVideo.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const renderMediaOnWeb = vi.fn();
vi.mock("@remotion/web-renderer", () => ({
  renderMediaOnWeb: (...args: unknown[]) => renderMediaOnWeb(...args),
}));

import { renderEjectionVideo } from "./renderVideo";
import { staticCharacterFrames } from "@/lib/characterImages";
import type { EjectorProps } from "@/types";

const props: EjectorProps = {
  ejectedText: "Red was not The Impostor",
  impostorText: "1 Impostor remains",
  characterFrames: staticCharacterFrames("/red.png"),
  showWatermark: false,
};

beforeEach(() => {
  renderMediaOnWeb.mockReset();
  renderMediaOnWeb.mockResolvedValue({
    getBlob: async () => new Blob(["x"], { type: "video/mp4" }),
  });
});

describe("renderEjectionVideo", () => {
  it("renders hd at 1280x720 with watermark forced on", async () => {
    await renderEjectionVideo({ props, tier: "hd" });
    const call = renderMediaOnWeb.mock.calls[0][0];
    expect(call.composition.width).toBe(1280);
    expect(call.composition.height).toBe(720);
    expect(call.composition.fps).toBe(30);
    expect(call.composition.durationInFrames).toBe(165);
    expect(call.inputProps.showWatermark).toBe(true);
    expect(call.container).toBe("mp4");
    expect(call.videoCodec).toBe("h264");
  });

  it("renders full-hd at 1920x1080 without watermark and reports progress", async () => {
    const onProgress = vi.fn();
    renderMediaOnWeb.mockImplementation(
      async (opts: {
        onProgress?: (p: { renderedFrames: number; encodedFrames: number }) => void;
      }) => {
        opts.onProgress?.({ renderedFrames: 165, encodedFrames: 33 });
        return { getBlob: async () => new Blob(["x"], { type: "video/mp4" }) };
      },
    );
    const blob = await renderEjectionVideo({ props, tier: "full-hd", onProgress });
    const call = renderMediaOnWeb.mock.calls[0][0];
    expect(call.composition.width).toBe(1920);
    expect(call.composition.height).toBe(1080);
    expect(call.inputProps.showWatermark).toBe(false);
    expect(onProgress).toHaveBeenCalledWith(0.2);
    expect(blob.type).toBe("video/mp4");
  });
});
```

```ts
// src/lib/render/renderGif.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const renderMediaOnWeb = vi.fn();
vi.mock("@remotion/web-renderer", () => ({
  renderMediaOnWeb: (...args: unknown[]) => renderMediaOnWeb(...args),
}));
vi.mock("./captureFrame", () => ({
  videoFrameToRgba: vi.fn(async () => ({
    data: new Uint8ClampedArray(480 * 270 * 4),
    width: 480,
    height: 270,
  })),
}));

import { renderEjectionGif } from "./renderGif";
import { staticCharacterFrames } from "@/lib/characterImages";
import type { EjectorProps } from "@/types";

const props: EjectorProps = {
  ejectedText: "e",
  impostorText: "i",
  characterFrames: staticCharacterFrames("/red.png"),
  showWatermark: false,
};

beforeEach(() => {
  renderMediaOnWeb.mockReset();
});

describe("renderEjectionGif", () => {
  it("renders muted at 480x270 with watermark on, captures every 3rd frame, returns a gif blob", async () => {
    renderMediaOnWeb.mockImplementation(
      async (opts: { onFrame?: (f: unknown) => unknown }) => {
        for (let i = 0; i < 165; i++) {
          await opts.onFrame?.({ close: () => {}, timestamp: i });
        }
        return { getBlob: async () => new Blob([""], { type: "video/mp4" }) };
      },
    );
    const blob = await renderEjectionGif({ props });
    const call = renderMediaOnWeb.mock.calls[0][0];
    expect(call.composition.width).toBe(480);
    expect(call.composition.height).toBe(270);
    expect(call.muted).toBe(true);
    expect(call.inputProps.showWatermark).toBe(true);
    expect(blob.type).toBe("image/gif");
    expect(blob.size).toBeGreaterThan(0);
    const { videoFrameToRgba } = await import("./captureFrame");
    expect(vi.mocked(videoFrameToRgba)).toHaveBeenCalledTimes(55); // ceil(165/3)
  });
});
```

`capability.test.ts`: mock `canRenderMediaOnWeb` → `{canRender:true, issues:[]}` gives `{supported:true, reason:null}`; `{canRender:false, issues:[{severity:'error', message:'no webcodecs', type:'webcodecs-unavailable'}]}` gives `{supported:false, reason:'no webcodecs'}`.

`download.dom.test.ts`: `ejectionFilename("Red was ejected", "gif")` → `"Red-was-ejected.gif"`; `downloadBlob` creates and clicks an anchor (spy on `document.createElement` or assert via `URL.createObjectURL` stub from vitest-canvas-mock environment; simplest: stub `URL.createObjectURL`/`revokeObjectURL` with `vi.stubGlobal`).

- [ ] **Step 2: FAIL, then implement.**

```ts
// src/lib/render/capability.ts
import { canRenderMediaOnWeb } from "@remotion/web-renderer";

export async function checkRenderSupport(): Promise<{
  supported: boolean;
  reason: string | null;
}> {
  try {
    const result = await canRenderMediaOnWeb({
      width: 1920,
      height: 1080,
      container: "mp4",
    });
    if (result.canRender) return { supported: true, reason: null };
    const reason =
      result.issues
        .filter((i) => i.severity === "error")
        .map((i) => i.message)
        .join("; ") || "Rendering is not supported in this browser";
    return { supported: false, reason };
  } catch (error) {
    return {
      supported: false,
      reason: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
```

```ts
// src/lib/render/renderVideo.ts
import { renderMediaOnWeb } from "@remotion/web-renderer";
import { EjectorComposition } from "@/remotion/EjectorComposition";
import {
  ANIMATION_DURATION_IN_FRAMES,
  ANIMATION_FPS,
} from "@/lib/animationConstants";
import type { EjectorProps, PaidTier } from "@/types";

const TIER_DIMENSIONS: Record<PaidTier, { width: number; height: number }> = {
  hd: { width: 1280, height: 720 },
  "full-hd": { width: 1920, height: 1080 },
};

export async function renderEjectionVideo({
  props,
  tier,
  onProgress,
}: {
  props: EjectorProps;
  tier: PaidTier;
  onProgress?: (fraction: number) => void;
}): Promise<Blob> {
  const { width, height } = TIER_DIMENSIONS[tier];
  const result = await renderMediaOnWeb({
    composition: {
      component: EjectorComposition,
      id: "ejector",
      width,
      height,
      fps: ANIMATION_FPS,
      durationInFrames: ANIMATION_DURATION_IN_FRAMES,
      defaultProps: props,
    },
    inputProps: { ...props, showWatermark: tier === "hd" },
    container: "mp4",
    videoCodec: "h264",
    onProgress: ({ encodedFrames }) => {
      onProgress?.(encodedFrames / ANIMATION_DURATION_IN_FRAMES);
    },
  });
  return result.getBlob();
}
```

```ts
// src/lib/render/captureFrame.ts
// Isolated so unit tests can mock the WebCodecs/canvas interaction.
export interface RgbaFrame {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export async function videoFrameToRgba(frame: VideoFrame): Promise<RgbaFrame> {
  const width = frame.displayWidth;
  const height = frame.displayHeight;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.drawImage(frame, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  return { data: imageData.data, width, height };
}
```

```ts
// src/lib/render/renderGif.ts
import { renderMediaOnWeb } from "@remotion/web-renderer";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { EjectorComposition } from "@/remotion/EjectorComposition";
import {
  ANIMATION_DURATION_IN_FRAMES,
  ANIMATION_FPS,
} from "@/lib/animationConstants";
import type { EjectorProps } from "@/types";
import { videoFrameToRgba, type RgbaFrame } from "./captureFrame";

const GIF_WIDTH = 480;
const GIF_HEIGHT = 270;
const GIF_FRAME_STEP = 3; // 30fps -> 10fps
const GIF_FRAME_DELAY_MS = 100;

export async function renderEjectionGif({
  props,
  onProgress,
}: {
  props: EjectorProps;
  onProgress?: (fraction: number) => void;
}): Promise<Blob> {
  const captured: RgbaFrame[] = [];
  let frameIndex = 0;

  await renderMediaOnWeb({
    composition: {
      component: EjectorComposition,
      id: "ejector-gif",
      width: GIF_WIDTH,
      height: GIF_HEIGHT,
      fps: ANIMATION_FPS,
      durationInFrames: ANIMATION_DURATION_IN_FRAMES,
      defaultProps: props,
    },
    inputProps: { ...props, showWatermark: true },
    container: "mp4",
    videoCodec: "h264",
    muted: true,
    onFrame: async (frame: VideoFrame) => {
      if (frameIndex % GIF_FRAME_STEP === 0) {
        captured.push(await videoFrameToRgba(frame));
      }
      frameIndex += 1;
      onProgress?.((frameIndex / ANIMATION_DURATION_IN_FRAMES) * 0.7);
      return frame;
    },
  });

  const gif = GIFEncoder();
  captured.forEach((frame, i) => {
    const palette = quantize(frame.data, 256);
    const index = applyPalette(frame.data, palette);
    gif.writeFrame(index, frame.width, frame.height, {
      palette,
      delay: GIF_FRAME_DELAY_MS,
    });
    onProgress?.(0.7 + ((i + 1) / captured.length) * 0.3);
  });
  gif.finish();

  return new Blob([gif.bytes()], { type: "image/gif" });
}
```

`gifenc` has no bundled types — add `src/types/gifenc.d.ts`:

```ts
declare module "gifenc" {
  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts: { palette: number[][]; delay?: number },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };
  export function quantize(
    rgba: Uint8ClampedArray | Uint8Array,
    maxColors: number,
  ): number[][];
  export function applyPalette(
    rgba: Uint8ClampedArray | Uint8Array,
    palette: number[][],
  ): Uint8Array;
}
```

```ts
// src/lib/render/download.ts
export function ejectionFilename(text: string, ext: "gif" | "mp4"): string {
  return `${text.replace(/\s+/g, "-")}.${ext}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: PASS + typecheck + commit** — `feat: in-browser render pipeline (web-renderer mp4, gifenc gif, capability check)`.

---

### Task 9: Character generator (color swap)

**Files:**
- Create: `src/components/CharacterGenerator.tsx`, `src/lib/characterColor.ts`
- Test: `src/lib/characterColor.dom.test.ts`, `src/components/CharacterGenerator.test.tsx`

**Interfaces:**
- Consumes: `staticCharacterFrames` (Task 2), `useT` (Task 4).
- Produces:
  - `CHARACTER_COLORS: { value: string; darken?: number }[]` — exactly the legacy 12 colors: `#d1211d`, `#1e27e2`, `#328100`(darken 10), `#e052c2`, `#e47e00`, `#f6f157`(darken 40), `#3f474e`(darken 10), `#d7e1f1`, `#6b2fbc`(darken 20), `#71491e`(darken 10), `#74fdd8`(darken 40), `#75f100`.
  - `generateColoredCharacter(color: { value: string; darken?: number }): Promise<string>` (in `characterColor.ts`) — draws `/among-us-red-character-color-reduced.png` on an offscreen canvas, reads reference colors at byte offsets 47304 (body red) and 47620 (shade red), replaces every pixel matching those two colors with the target color and its darkened variant (`darken ?? 24` via tinycolor2), returns PNG data URL. Direct port of legacy `getColorChangedImage` (see `git show legacy-canvas:src/components/CharacterGenerator.js`).
  - `CharacterGenerator({ onChange }: { onChange: (frames: CharacterFrames) => void })` — swatch grid; selecting a color calls `generateColoredCharacter` then `onChange(staticCharacterFrames(dataUrl))`. Red (`#d1211d`) selected by default but does NOT fire onChange on mount (the page default is already the red sprite).
- **Testing note:** canvas pixel ops run under `vitest-canvas-mock`, which returns zeroed image data — so unit-test `generateColoredCharacter` only for "resolves to a data URL without throwing" and test the component for swatch rendering (12 swatches) and that clicking a swatch calls `onChange` with a single-frame `CharacterFrames`. Mock `generateColoredCharacter` in the component test via `vi.mock("@/lib/characterColor")`. Real pixel behavior verified manually (Task 11 checkpoint).

- [ ] **Step 1: Failing tests** (as described above — component: renders 12 swatches with `aria-label` = color hex, click fires `onChange` with `frames.length === 1`).
- [ ] **Step 2: Implement `characterColor.ts`** — port loop from legacy: load image via `new Image()` + onload promise, canvas 2d, `getImageData`, build hex for each pixel with tinycolor, compare with reference hexes captured at offsets 47304/47620, substitute `parsedColor`/`parsedColor.darken(darken ?? 24)` rgb; `putImageData`; `toDataURL("image/png")`.
- [ ] **Step 3: Implement component** — heading `t("Select Your Character Color")`, preview `<img>` of current data URL (or default sprite), grid of 42 px rounded swatches, selected ring via Tailwind (`ring-2 ring-white`).
- [ ] **Step 4: PASS + commit** — `feat: character color generator (TS port)`.

---

### Task 10: Image input components (upload, crop, URL, GIF decode)

**Files:**
- Create: `src/lib/gifFrames.ts`, `src/lib/cropImage.ts`, `src/components/CropDialog.tsx`, `src/components/UploadArea.tsx`, `src/components/ImageUrlField.tsx`
- Test: `src/lib/gifFrames.test.ts` (logic parts), `src/lib/cropImage.dom.test.ts`, `src/components/UploadArea.test.tsx`, `src/components/ImageUrlField.test.tsx`

**Interfaces:**
- Consumes: `getCorsUrl`, `CharacterFrames`, `staticCharacterFrames`, `useT`, shadcn Dialog/Button/Input.
- Produces:
  - `decodeGifToCharacterFrames(url: string): Promise<CharacterFrames>` (in `gifFrames.ts`) — fetches via `getCorsUrl`, parses with `gifuct-js` (`parseGIF` + `decompressFrames(gif, true)`), composites patches onto a full-size canvas honoring frame disposal, converts each to a PNG data URL; frame timing from `delay` (already ms in gifuct output; treat `delay < 20` as 100 ms like legacy's `|| 10` centisecond fallback). Also export `isGifSource(url: string): boolean` (`/(^data:image\/gif)|(\.gif($|\?))/`).
  - `cropImage(srcDataUrl: string, cropArea: { x: number; y: number; width: number; height: number }, rotation: number): Promise<string>` (in `cropImage.ts`) — canvas crop, port of legacy `getCroppedImages` static-image path.
  - `cropCharacterSource(src: string, cropArea, rotation): Promise<CharacterFrames>` — if `isGifSource`, decode GIF then crop every frame (same timings); else `staticCharacterFrames(await cropImage(...))`.
  - `CropDialog({ image, open, onClose, onChange }: { image: string | null; open: boolean; onClose(): void; onChange(frames: CharacterFrames): void })` — react-easy-crop with zoom+rotation sliders, Confirm calls `cropCharacterSource`.
  - `UploadArea({ previewUrl, onChange }: { previewUrl: string; onChange(frames: CharacterFrames): void })` — file input (accept `image/*`), FileReader → data URL → CropDialog.
  - `ImageUrlField({ onChange }: { onChange(frames: CharacterFrames): void })` — debounced (300 ms) URL validation (image loads + CORS-proxied fetch ok) → CropDialog; inline error text on failure.
- **Testing note:** gif decode + canvas crop are exercised for wiring, not pixels (vitest-canvas-mock). `UploadArea.test.tsx`: uploading a File (via `userEvent.upload`) opens the crop dialog. `ImageUrlField.test.tsx`: typing an URL that MSW 404s shows `Invalid URL`; a valid one (MSW 200 image/png + mock `Image` onload) opens crop dialog — stub `Image` with `vi.stubGlobal` to auto-fire `onload`.

- [ ] **Step 1: Failing tests** for `isGifSource`, `ejection` of crop wiring, `UploadArea` and `ImageUrlField` behaviors described above.
- [ ] **Step 2: Implement libs, then components.** Keep each file under ~150 lines; CropDialog uses shadcn Dialog + `react-easy-crop`'s `Cropper` with `aspect={125 / 162}` (legacy character aspect), `onCropComplete` storing `croppedAreaPixels`.
- [ ] **Step 3: PASS + typecheck + commit** — `feat: character image inputs (upload, crop, URL, GIF decode)`.

---

### Task 11: Editor page assembly (layout modernization)

**Files:**
- Create: `src/components/Navbar.tsx`, `src/components/Footer.tsx`, `src/components/PlayerPreview.tsx`, `src/components/SoundToggle.tsx`, `src/components/LanguageToggle.tsx`, `src/components/EditorForm.tsx`, `src/components/HomePage.tsx`, `src/components/ErrorDialog.tsx`, `src/components/SupportEmailLink.tsx`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx` (wrap providers, GA script)
- Test: `src/components/HomePage.test.tsx`, `src/components/PlayerPreview.test.tsx`, `src/components/ErrorDialog.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 2–10.
- Produces: the assembled editor page. State lives in `HomePage` (client component): `ejectedText` (default `t("Red was not The Impostor")`), `impostorText` (default `t("1 Impostor remains")`), `characterFrames` (default `staticCharacterFrames(DEFAULT_CHARACTER_URL)`), `soundOn` (localStorage-persisted, default true).
  - `PlayerPreview({ props, soundOn })`: `@remotion/player` `<Player component={EjectorComposition} inputProps={props} durationInFrames={165} fps={30} compositionWidth={1920} compositionHeight={1080} loop autoPlay controls style={{width:"100%"}} initiallyMuted={!soundOn} />` — plus a `<audio loop src="/background.mp3">` for the ambient music, played/paused with `soundOn` after first user gesture.
  - `ErrorDialog({ message, onClose })` — shadcn Dialog shown when `message !== null` (global error pattern).
  - `SupportEmailLink` — client-only `contact@kassellabs.io` mailto assembled at runtime (spam protection, legacy parity).
  - Layout: sticky Navbar (logo + title left; SoundToggle, LanguageToggle right), centered column `max-w-5xl`: Player card on top, form card below on desktop-wide two-column (`lg:grid-cols-[1fr_380px]` — player left, form right), Footer with Kassel Labs links. Dark space theme (`#0b0e1a` bg, white text, crewmate-red `#d1211d` accents on primary buttons). Track `ejection_form_text_changed` once on first text edit.
- `layout.tsx` wraps `<I18nProvider><PaymentProvider>` around children and injects the GA script when `gaId` is set (`next/script`, `strategy="afterInteractive"`).

- [ ] **Step 1: Failing tests.** `HomePage.test.tsx`: renders both text inputs with default values; typing in "Ejection Text" updates the value and (mock `@remotion/player`'s `Player` via `vi.mock` to a stub div capturing `inputProps`) the player's `inputProps.ejectedText`. `PlayerPreview.test.tsx`: mounts the mocked Player with the right composition config. `ErrorDialog.test.tsx`: shows message, close button calls `onClose`.
- [ ] **Step 2: Implement components + page.** `src/app/page.tsx`:

```tsx
import { HomePage } from "@/components/HomePage";

export default function Page() {
  return <HomePage />;
}
```

- [ ] **Step 3: PASS + typecheck + `npm run build`.**
- [ ] **Step 4: MANUAL CHECKPOINT — report to the orchestrator that `npm run dev` should be human-verified in Chrome:** preview animates and loops with sound, color swatches recolor the crewmate, GIF/image upload works. (Orchestrator relays to user; do not block the pipeline.)
- [ ] **Step 5: Commit** — `feat: modern editor layout with live Remotion preview`.

---

### Task 12: Download section + payment dialog

**Files:**
- Create: `src/components/DownloadSection.tsx`, `src/components/TierPicker.tsx`, `src/components/PaymentDialog.tsx`, `src/hooks/useFileGeneration.ts`
- Modify: `src/components/HomePage.tsx` (mount DownloadSection)
- Test: `src/components/DownloadSection.test.tsx`, `src/components/PaymentDialog.test.tsx`, `src/hooks/useFileGeneration.test.tsx`

**Interfaces:**
- Consumes: render pipeline (Task 8), `usePayment` (Task 7), payment events + `tierForCents` (Task 6), `paymentPageUrl` + config (Task 5), `useT`, `trackEvent`, shadcn Button/Dialog/Progress.
- Produces:
  - `useFileGeneration()` hook: `{ generating: "gif" | "mp4" | null, progress: number, generate(kind, props: EjectorProps, tier: PaidTier | null): Promise<void>, error: string | null, clearError(): void }`. `generate` runs `checkRenderSupport()` first (unsupported → sets `error` to the browser-support message), plays `/task_Inprogress.mp3` on start and `/task_Complete.mp3` on finish, calls `renderEjectionGif`/`renderEjectionVideo`, then `downloadBlob(blob, ejectionFilename(ejectedText, kind))`. Tracks `download_button_initialize`/`download_button_finish` with `event_label` = kind.
  - `DownloadSection({ props }: { props: EjectorProps })`: "Download GIF" always enabled → `generate("gif", ...)`. "Download Video": if `usePayment().paid` → `generate("mp4", props, tier)`; else opens `PaymentDialog`. Progress bar while generating; buttons disabled during generation.
  - `TierPicker({ selected, onSelect }: { selected: PaidTier; onSelect(t: PaidTier): void })` — two cards ($3 HD watermark / $5 Full HD clean), `full-hd` preselected.
  - `PaymentDialog({ open, onClose, onPaid }: { open: boolean; onClose(): void; onPaid(tier: PaidTier): void })` — TierPicker + iframe `src={`${paymentPageUrl}?embed=true&app=ejector&code=${code}&amount=500`}` (`allow="payment"`, 700 px min-height, loading state behind it); tier change → `iframeRef.current.contentWindow.postMessage({action:"setAmount", payload: tier === "hd" ? 300 : 500}, "*")`; registers payment events on open, unregisters on close; on success payload → `markPaid(payload.finalAmount)`, `trackEvent("modal_payment_open")` on open and closes dialog calling `onPaid(tierForCents(payload.finalAmount))`. The 24 h note + `SupportEmailLink` shown under the iframe.
  - After payment success, `DownloadSection` auto-starts the MP4 generation with the unlocked tier.
- **Testing note:** mock `@/lib/render/renderVideo`, `@/lib/render/renderGif`, `@/lib/render/capability`, and `@/lib/render/download` with `vi.mock` in these component/hook tests. Payment success is simulated by dispatching a `MessageEvent` whose origin is `new URL(paymentPageUrl).origin` (with the default config that's `https://payment.kassellabs.io`) — jsdom allows constructing MessageEvent with any `origin` value. Audio elements: stub `HTMLMediaElement.prototype.play` with `vi.spyOn(...).mockResolvedValue(undefined)`.

- [ ] **Step 1: Failing tests:**
  - `useFileGeneration.test.tsx` (renderHook): gif path calls mocked `renderEjectionGif` then `downloadBlob` with `Red-was-ejected.gif`-style name; unsupported capability sets `error` and never calls render; progress updates state.
  - `PaymentDialog.test.tsx`: renders iframe with `app=ejector` and the client code; clicking the HD card posts `setAmount 300` to the iframe (`contentWindow.postMessage` spied); a success MessageEvent from the payment origin calls `onPaid("full-hd")` for `finalAmount: 500` and closes.
  - `DownloadSection.test.tsx`: unpaid → clicking "Download Video" opens dialog (iframe visible), GIF button triggers gif generation; paid (`markPaid` pre-seeded through a wrapper) → clicking "Download Video" calls `renderEjectionVideo` directly.
- [ ] **Step 2: FAIL, then implement.** Keep `useFileGeneration` free of JSX (plain `.ts` is fine if no TSX needed — name it `.ts`).
- [ ] **Step 3: PASS + typecheck + commit** — `feat: download flow with payment-gated MP4 and free GIF`.

---

### Task 13: Newsletter (subscribe + unsubscribe)

**Files:**
- Create: `src/lib/newsletter.ts`, `src/components/SubscribeForm.tsx`, `src/app/unsubscribe/page.tsx`, `src/components/UnsubscribePage.tsx`
- Modify: `src/components/HomePage.tsx` (mount SubscribeForm above Footer)
- Test: `src/lib/newsletter.test.ts`, `src/components/SubscribeForm.test.tsx`, `src/components/UnsubscribePage.test.tsx`

**Interfaces:**
- Consumes: `adminGraphqlUrl` (Task 5), `useT` (Task 4), `useLocale`, shadcn Input/Button.
- Produces:
  - `subscribeNewsletter(email: string, language: string): Promise<void>` — POST GraphQL `mutation ($input: SubscribeNewsletterInput!) { subscribeNewsletter(input: $input) { id } }` with `variables: { input: { email, source: "ejector", language } }`; throws on HTTP error or GraphQL `errors`.
  - `unsubscribeNewsletter(email: string): Promise<void>` — `mutation ($input: UnsubscribeNewsletterInput!) { unsubscribeNewsletter(input: $input) { id } }`.
  - `SubscribeForm` — email input + button; success swaps to thank-you copy (`t("Thanks! We'll notify you as soon as it is ready! 🚀")`); failure shows `t("Something went wrong. Please try again.")` inline.
  - `/unsubscribe?email=x` page — client component reading `useSearchParams`, email input prefilled, Unsubscribe button → success message.

- [ ] **Step 1: Failing tests** — MSW handler on `*/graphql` asserting the mutation string contains `subscribeNewsletter` and input email; error path (GraphQL errors array → rejects). Component tests: happy path swap to thank-you; failure shows error text; UnsubscribePage prefills from `?email=` (wrap in `Suspense` for `useSearchParams`; in the test, mock `next/navigation`'s `useSearchParams`).
- [ ] **Step 2: Implement:**

```ts
// src/lib/newsletter.ts
import { adminGraphqlUrl } from "@/lib/config";

async function graphqlRequest(
  query: string,
  variables: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(adminGraphqlUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
  const body = (await res.json()) as { errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors[0].message);
}

export async function subscribeNewsletter(
  email: string,
  language: string,
): Promise<void> {
  await graphqlRequest(
    `mutation ($input: SubscribeNewsletterInput!) {
      subscribeNewsletter(input: $input) { id }
    }`,
    { input: { email, source: "ejector", language } },
  );
}

export async function unsubscribeNewsletter(email: string): Promise<void> {
  await graphqlRequest(
    `mutation ($input: UnsubscribeNewsletterInput!) {
      unsubscribeNewsletter(input: $input) { id }
    }`,
    { input: { email } },
  );
}
```

- [ ] **Step 3: PASS + typecheck + commit** — `feat: newsletter subscribe/unsubscribe against admin.kassellabs.io`.

---

### Task 14: payment-backend — ejector app + paid-check endpoint

**Working directory: `/home/nihey/devel/payment-backend`** (its own git repo — commit there).

**Files:**
- Create: `src/apps/ejector.ts`, `src/paymentStatusApi.ts`
- Modify: `src/apps.ts` (register `ejector`), `index.ts` (mount router), `openapi.json` (new path), `README.md` (mention endpoint)
- Test: `test/paymentStatus.test.ts`, extend `test/api.test.ts`-style coverage inside the new test file

**Interfaces:**
- Consumes: existing `AppService`/`CreateContextInput`/`PaymentContext` types (`src/types.ts`), `sql` (`src/database.ts`), `rateLimit` pattern from `src/couponApi.ts`.
- Produces: `GET /payment/:app/:code/paid` → `200 {paid:false}` or `200 {paid:true, dollarValue:number, paidAt:string}`. Payments count when `created_at` within the last 24 h.

- [ ] **Step 1: Failing tests** `test/paymentStatus.test.ts`:

```ts
jest.mock('../src/database', () => ({
  __esModule: true,
  default: jest.fn(),
}));
// amqp/redis are also touched by index.ts bootstrapping in other suites —
// follow whatever module mocks test/api.test.ts applies (copy its jest.mock
// preamble verbatim so `import app from '../index'` loads cleanly).

import request from 'supertest';

import sql from '../src/database';
import app from '../index';

const mockedSql = sql as unknown as jest.Mock;

describe('GET /payment/:app/:code/paid', () => {
  beforeEach(() => mockedSql.mockReset());

  it('returns paid:true with dollarValue for a payment within 24h', async () => {
    const createdAt = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
    mockedSql.mockResolvedValueOnce([
      { dollar_value: '5', created_at: createdAt },
    ]);

    const res = await request(app).get('/payment/ejector/abc-123/paid');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      paid: true,
      dollarValue: 5,
      paidAt: createdAt.toISOString(),
    });
  });

  it('returns paid:false when the newest payment is older than 24h', async () => {
    mockedSql.mockResolvedValueOnce([
      { dollar_value: '5', created_at: new Date(Date.now() - 25 * 3600_000) },
    ]);
    const res = await request(app).get('/payment/ejector/abc-123/paid');
    expect(res.body).toEqual({ paid: false });
  });

  it('returns paid:false when no payment exists', async () => {
    mockedSql.mockResolvedValueOnce([]);
    const res = await request(app).get('/payment/ejector/nope/paid');
    expect(res.body).toEqual({ paid: false });
  });

  it('returns 500 on database failure', async () => {
    mockedSql.mockRejectedValueOnce(new Error('boom'));
    const res = await request(app).get('/payment/ejector/abc/paid');
    expect(res.status).toBe(500);
  });
});
```

Also test the app module directly:

```ts
import ejectorApp from '../src/apps/ejector';

describe('ejector app', () => {
  it('accepts >= $3 and rejects below', () => {
    expect(ejectorApp.isAmountValid({ amount: 300 })).toBe(true);
    expect(ejectorApp.isAmountValid({ amount: 299 })).toBe(false);
  });
  it('statement descriptor fits the 22-char limit with KL* prefix', () => {
    expect(`KL* ${ejectorApp.getStatementDescriptor()}`.length).toBeLessThanOrEqual(22);
  });
});
```

- [ ] **Step 2: Run** `npx jest test/paymentStatus.test.ts` — FAIL (module not found).
- [ ] **Step 3: Implement.**

`src/apps/ejector.ts`:

```ts
import { CreateContextInput, PaymentContext } from '../types';

// Ejector renders entirely in the user's browser — there is no server-side
// video to bump. The `payment` row inserted by the charge flow is itself the
// unlock record; the frontend polls GET /payment/ejector/:code/paid.
const ejectorApp = {
  createContext: ({
    app, amount, email, code,
  }: CreateContextInput): PaymentContext => ({
    app, amount, email, code,
  }),

  isAmountValid: ({ amount }: PaymentContext): boolean => amount >= 300,

  getStatementDescriptor: (): string => 'Ejector Video',

  getDescription: ({ email, amount }: PaymentContext): string => {
    const tier = amount >= 500
      ? 'Full HD 1920x1080, no watermark'
      : 'HD 1280x720';
    return `Payment for Ejector Video (${tier}). Unlimited downloads for 24 hours at https://ejector.kassellabs.io — receipt sent to: ${email}`;
  },

  bumpVideo: async ({ code, email, amount }: PaymentContext): Promise<void> => {
    console.log('Ejector payment unlock:', code, email, amount);
  },
};

export default ejectorApp;
```

`src/paymentStatusApi.ts`:

```ts
import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

import sql from './database';

const PAID_WINDOW_MS = 24 * 60 * 60 * 1000;

const statusRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false, xForwardedForHeader: false },
  message: { error: { message: 'Too many requests, please try again shortly.' } },
});

const router = express.Router();

router.get(
  '/payment/:app/:code/paid',
  statusRateLimiter,
  async (req: Request, res: Response) => {
    const { app, code } = req.params;
    try {
      const rows = await sql`
        SELECT dollar_value, created_at
        FROM payment
        WHERE app = ${app} AND code = ${code}
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const row = rows[0];
      if (!row) {
        res.send({ paid: false });
        return;
      }

      const paidAt = new Date(row.created_at as string | Date);
      if (Date.now() - paidAt.getTime() >= PAID_WINDOW_MS) {
        res.send({ paid: false });
        return;
      }

      res.send({
        paid: true,
        dollarValue: Number(row.dollar_value),
        paidAt: paidAt.toISOString(),
      });
    } catch (error) {
      console.error('payment status lookup failed', error);
      res.status(500).send({ error: { message: 'Internal error' } });
    }
  },
);

export default router;
```

`src/apps.ts`: `import ejectorApp from './apps/ejector';` + `ejector: ejectorApp,` in the `apps` record.
`index.ts`: `import paymentStatusApi from './src/paymentStatusApi';` (match the import style of `exchangeApi`) and `expressApp.use(paymentStatusApi);` after `expressApp.use(exchangeApi);`.

- [ ] **Step 4: Update `openapi.json`** — add path `/payment/{app}/{code}/paid` (GET, params app/code, 200 schema `{paid: boolean, dollarValue?: number, paidAt?: string}`, 500 error) and a line in `README.md`'s endpoint list.
- [ ] **Step 5: Full gate:** `npm test && npm run typecheck && npm run lint` — all PASS.
- [ ] **Step 6: Commit** (in payment-backend) — `feat: ejector app + GET /payment/:app/:code/paid unlock-status endpoint`.

---

### Task 15: payment-frontend — register ejector app

**Working directory: `/home/nihey/devel/payment-frontend`** (its own git repo — commit there).

**Files:**
- Modify: `lib/apps.ts`
- Test: `lib/apps.test.ts` (create if missing)

- [ ] **Step 1: Failing test** (`lib/apps.test.ts`, follow that repo's Jest conventions):

```ts
import { getApp } from './apps';

describe('ejector app config', () => {
  it('is registered with a $3 minimum', () => {
    const app = getApp('ejector');
    expect(app).toBeDefined();
    expect(app?.minimum).toBe(300);
    expect(app?.label).toContain('Ejector');
    expect(app?.getPaymentDescription('any-code')).toContain(
      'ejector.kassellabs.io',
    );
  });
});
```

- [ ] **Step 2: Implement** — add to the `apps` record in `lib/apps.ts`:

```ts
ejector: {
  label: 'Ejector Video Payment',
  minimum: 300,
  getPaymentDescription: () => {
    return 'Unlimited ejection video downloads for 24 hours at https://ejector.kassellabs.io';
  },
},
```

- [ ] **Step 3:** `npm test && npm run lint` PASS, update the app list in `README.md` if it enumerates apps, commit — `feat: register ejector app ($3 minimum)`.

---

### Task 16: E2E + CI

**Working directory: `/home/nihey/devel/ejector`.**

**Files:**
- Create: `e2e/editor.spec.ts`, `e2e/payment-gate.spec.ts`, `.github/workflows/ci.yml`, `.env.test`
- Modify: `playwright.config.ts` (copy `.env.test` → dev server env if needed, mirroring star-wars-intro-creator-new's approach)

**Interfaces:**
- Consumes: the running app; payment endpoints mocked with `page.route`.

- [ ] **Step 1: `.env.test`:**

```
NEXT_PUBLIC_PAYMENT_PAGE_URL=https://payment.kassellabs.io
NEXT_PUBLIC_PAYMENT_API_URL=https://payment-api.test
NEXT_PUBLIC_ADMIN_GRAPHQL_URL=https://admin.test/graphql
```

- [ ] **Step 2: Write E2E specs.**

`e2e/editor.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/payment/ejector/**", (route) =>
    route.fulfill({ json: { paid: false } }),
  );
});

test("editor renders preview and editable texts", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Ejection Text")).toHaveValue(
    "Red was not The Impostor",
  );
  await page.getByLabel("Ejection Text").fill("Blue was ejected");
  await expect(page.getByLabel("Ejection Text")).toHaveValue(
    "Blue was ejected",
  );
  // Remotion Player mounts
  await expect(page.locator(".__remotion-player")).toBeVisible();
});

test("character color swatches are present", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("#d1211d")).toBeVisible();
});
```

`e2e/payment-gate.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("unpaid user gets the payment dialog with the ejector iframe", async ({
  page,
}) => {
  await page.route("**/payment/ejector/**", (route) =>
    route.fulfill({ json: { paid: false } }),
  );
  await page.route("https://payment.kassellabs.io/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<html>pay</html>" }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Download Video" }).click();
  const iframe = page.locator("iframe[src*='app=ejector']");
  await expect(iframe).toBeVisible();
  await expect(iframe).toHaveAttribute("src", /amount=500/);
});

test("paid user skips the dialog and starts generating", async ({ page }) => {
  await page.route("**/payment/ejector/**", (route) =>
    route.fulfill({ json: { paid: true, dollarValue: 5 } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Download Video" }).click();
  await expect(page.locator("iframe[src*='app=ejector']")).toHaveCount(0);
  // Render pipeline kicks off (progress UI appears) or fails fast on missing
  // WebCodecs in the test browser — both prove the gate is open; assert the
  // dialog did NOT appear and either progress bar or error dialog is shown.
  await expect(
    page.getByRole("progressbar").or(page.getByText(/browser/i)),
  ).toBeVisible({ timeout: 15_000 });
});
```

- [ ] **Step 3: `.github/workflows/ci.yml`** — copy `/home/nihey/devel/star-wars-intro-creator-new/.github/workflows/ci.yml` and adapt job names/paths (same three jobs: lint+typecheck, test:coverage, e2e with `.env.test` copied to `.env.local`).
- [ ] **Step 4: Run** `npm run e2e` — PASS locally.
- [ ] **Step 5: Commit** — `feat: e2e specs and CI workflow`.

---

### Task 17: Cleanup, docs, coverage gate

**Working directory: `/home/nihey/devel/ejector`.**

**Files:**
- Modify: `README.md` (rewrite), Create: `CLAUDE.md`
- Verify: nothing legacy remains (`git grep -l "material-ui\|ffmpeg\|gif.js\|BACKEND_URL\|react-paypal"` returns nothing outside docs/)

- [ ] **Step 1: Rewrite `README.md`:** project intro (Among Us ejection GIF/video creator), sample.gif embed, prod URL, setup (`npm install`, `cp .env.example .env.local`, `npm run dev`), env var table, script list (dev/build/test/e2e), architecture summary (Remotion in-browser rendering, payment-frontend iframe + payment-backend paid-check, admin.kassellabs.io newsletter), browser-support note for exports.
- [ ] **Step 2: Write `CLAUDE.md`:**

```markdown
# Ejector — Project Instructions

## Stack notes (divergences from global defaults)

- **No Strapi backend, no monorepo, no Apollo.** Single Next.js 16 app.
  The only backends touched are payment-backend (paid-check + charges via
  the payment-frontend iframe) and admin.kassellabs.io GraphQL (newsletter).
- **Video pipeline: 100% in-browser Remotion.** `@remotion/player` preview,
  `@remotion/web-renderer` MP4 export, gifenc GIF export. There is no
  server renderer and there must never be one.
- **Payment is a soft gate.** A client UUID (`ejector-payment-code` in
  localStorage) keys payments; `GET /payment/ejector/:code/paid` on
  payment-backend restores the 24h unlimited-download window.
  GIF = free + watermark; MP4 = $3 (720p watermark) / $5 (1080p clean).
- **Animation timing constants** in `src/lib/animationConstants.ts` and the
  helpers in `src/remotion/EjectorComposition.tsx` replicate the legacy
  canvas animation (`git show legacy-canvas:src/util/drawAnimation.js`).
  Do not change them without visual comparison against the legacy output.
- **i18n**: en + pt-BR dictionaries in `src/locales/`, keys are English
  strings, `useT()` from `src/lib/i18n.tsx`.

## Testing & TDD

Same rules as star-wars-intro-creator-new: TDD (red/green/refactor), tests
beside source, `.dom.test.ts` for jsdom lib tests, MSW at the network layer
(never module-mock fetch), `page.route()` in E2E, 80%/80% coverage gate on
`src/lib/`. The one sanctioned module mock: `@remotion/web-renderer` in
render-pipeline unit tests (WebCodecs cannot run in jsdom); real encoding is
verified manually in Chrome.

- `npm test` / `npm run test:watch` / `npm run test:coverage`
- `npm run e2e` / `npm run e2e:ui`
- `npm run lint && npm run typecheck` must pass before every commit.
```

- [ ] **Step 3: Coverage + full gate:** `npm run test:coverage && npm run lint && npm run typecheck && npm run build && npm run e2e` — all PASS (add targeted lib tests if coverage on `src/lib/` is below 80/80).
- [ ] **Step 4: Legacy scan:** run the `git grep` above; remove any stragglers.
- [ ] **Step 5: Commit** — `docs: rewrite README and add project CLAUDE.md`.

---

## Self-review notes

- Spec coverage: rebuild/scaffold (T1), composition (T3), render pipeline (T8), layout (T11), payment libs/context/dialog (T6/T7/T12), backend endpoint + app (T14), frontend app registry (T15), newsletter (T13), i18n (T4), tracking (T5), testing/CI (all + T16), cleanup/docs (T17), character inputs (T9/T10). 24h window enforced server-side (T14) and restored client-side (T7).
- Type consistency: `CharacterFrames`/`EjectorProps`/`PaidTier`/`PaidStatus`/`PaymentSuccessPayload` defined once in `src/types.ts` (T2) and imported everywhere; composition constants exported from `src/lib/animationConstants.ts` and re-exported by the composition.
- Known judgment calls an implementer may refine: exact Tailwind classes/visual polish (T11), gifuct-js disposal compositing details (T10), shadcn init prompts (T1). These are intentionally implementation-latitude, not placeholders — acceptance criteria are in the task tests.
