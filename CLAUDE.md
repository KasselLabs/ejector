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
- **Two sibling repos must deploy together with this app**: payment-backend
  (branch `feat/ejector-app`) and payment-frontend (branch `feat/ejector-app`).
  Neither has an ejector-specific branch on `main`.
- **Animation timing constants** in `src/lib/animationConstants.ts` and the
  helpers in `src/remotion/EjectorComposition.tsx` replicate the legacy
  canvas animation (`git show legacy-canvas:src/util/drawAnimation.js`).
  Do not change them without visual comparison against the legacy output.
  The `legacy-canvas` git tag is the ground truth for animation timing and
  pixel behavior — when in doubt about "what should this look like",
  check out that tag rather than guessing.
- **i18n**: en + pt-BR dictionaries in `src/locales/`, keys are English
  strings, `useT()` from `src/lib/i18n.tsx`.
- **SEO**: `src/app/robots.ts` (allows all crawlers, AI crawlers included)
  and `src/app/sitemap.ts` (homepage only — `/unsubscribe` is `noindex`).
  Favicons/apple-icon come from the App Router file conventions in
  `src/app/` — never re-add a manual `icons` entry to the metadata.
  JSON-LD (`WebApplication` + Kassel Labs `Organization`) is inlined as the
  first child of `<body>` in `src/app/layout.tsx`; its offer prices must stay
  in sync with the real tiers. `AboutSection.tsx` carries the indexable
  on-page copy. `next.config.ts` sets baseline security headers but
  **deliberately allows framing** (third parties iframe the creators).

## Local env: `.env.test` → `.env.local` seeding

Playwright's `webServer` (`playwright.config.ts`) runs `next dev`, which
reads `.env.local`, not `.env.test`. Locally (not in CI), the webServer
command runs `cp -n .env.test .env.local` before `npm run dev` — `-n`
("no-clobber") means it **only seeds `.env.local` if it doesn't already
exist**, so it never overwrites a developer's real local config.

The footgun: if `.env.test` changes (new stub var, new mock URL) after your
`.env.local` was first seeded, `cp -n` will **not** re-sync it — your local
`.env.local` silently drifts out of date. If `npm run e2e` behaves
unexpectedly locally (e.g. hitting a real backend instead of a mocked
stub, or a "missing env var" symptom that doesn't reproduce in CI), **delete
`.env.local` and let it reseed** before assuming the test itself is wrong.
CI has no such footgun: `ci.yml` unconditionally `cp`s `.env.test` over
`.env.local` every run.

## Testing & TDD

Same rules as star-wars-intro-creator-new: TDD (red/green/refactor), tests
beside source, `.dom.test.ts` for jsdom lib tests, MSW at the network layer
(never module-mock fetch), `page.route()` in E2E, 80%/80% coverage gate on
`src/lib/`.

Sanctioned module mocks (the only ones in this repo — everything
network-shaped stays MSW/`page.route()`):

- `@remotion/web-renderer` — WebCodecs-based MP4 rendering; WebCodecs isn't
  implemented in jsdom, so render-pipeline unit tests mock this module's
  API surface and verify real encoding manually in Chrome.
- `@remotion/player` — a browser-only video player component; component
  tests that render it mock it rather than exercising its internal canvas
  playback loop.
- `next/navigation`'s `useSearchParams` — mocked in component tests per the
  usual Next.js App Router testing pattern.

Canvas-leaf modules (`src/lib/render/captureFrame.ts`,
`src/lib/gifFrames.ts`, `src/lib/cropImage.ts`, `src/lib/characterColor.ts`)
are **not** module-mocked — jsdom + `vitest-canvas-mock` runs their real
control flow (loops, disposal-type branching, GIF frame timing math, pixel
substitution as a pure extracted helper) for real. The one thing that
genuinely cannot run anywhere but a real browser is `captureFrame.ts`'s use
of `OffscreenCanvas` + `VideoFrame` (WebCodecs types with no jsdom
implementation at all); it's excluded from the coverage gate in
`vitest.config.ts`, with a comment explaining why, rather than tested with a
mock that would just assert its own stub. `vitest-canvas-mock` always
returns zeroed `getImageData()` output, so pixel-accuracy in
`characterColor.ts`/`cropImage.ts`/`gifFrames.ts` is verified manually in
Chrome; the jsdom tests cover control flow and (for `characterColor.ts`'s
pixel-matching logic specifically) a pure function extracted so it can be
unit-tested against a plain `Uint8ClampedArray` without a canvas at all.

- `npm test` / `npm run test:watch` / `npm run test:coverage`
- `npm run e2e` / `npm run e2e:ui`
- `npm run lint && npm run typecheck` must pass before every commit.
