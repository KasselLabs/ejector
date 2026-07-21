# Ejector Rebuild — Canvas → Remotion, Modern Layout, Payment Integration

**Date:** 2026-07-21
**Status:** Approved

## Goal

Rebuild Ejector in place as a modern Next.js 16 application with a Remotion-based,
fully in-browser video pipeline (no render servers, ever), a layout modeled on
`star-wars-intro-creator-new`, and payments integrated with `payment-backend` /
`payment-frontend`. Payment exists only to gate the MP4 download.

## Decisions (agreed)

| Topic | Decision |
|---|---|
| Approach | Fresh rebuild in-place (replace `pages/`, `src/`, MUI v4, canvas/ffmpeg wholesale) |
| Free vs paid | GIF free; MP4 (with sound) paid |
| Pricing | $3 HD (1280×720, watermarked) / $5 Full HD (1920×1080, clean); minimum $3; 24h unlimited window after payment |
| Paid state | iframe `postMessage` success + backend revalidation keyed by client `code` |
| Render architecture | Pure DOM Remotion composition; `@remotion/web-renderer` for MP4; GIF transcoded from the rendered video |
| i18n | en + pt-BR (pt collapsed into pt-BR), browser detection + manual toggle, no URL prefixes |
| Testing | Same rigor as star-wars-intro-creator-new: Vitest + Playwright + MSW, 80% coverage on `src/lib/`, CI |
| Newsletter | Point at `https://admin.kassellabs.io` GraphQL (`subscribeNewsletter` / `unsubscribeNewsletter`); drop ProductHunt badge; keep GA tracking |

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui (no browser-native modals — shadcn Dialog)
- Remotion: `remotion`, `@remotion/player`, `@remotion/web-renderer`,
  `@remotion/media-parser` (or mediabunny) for decode; `gifenc` for GIF encode
- `react-easy-crop` (kept) for upload cropping
- Plain `fetch` for all HTTP (no Apollo — no Strapi backend of its own)
- Vitest + Testing Library + MSW; Playwright for E2E; ESLint flat config + Prettier

This project intentionally diverges from the global stack defaults (no Strapi,
no monorepo, no Apollo). A project `CLAUDE.md` will document this.

## Architecture

```
ejector/
├── src/
│   ├── app/                 # App Router: / (editor), /unsubscribe, layout, globals.css
│   ├── components/          # Navbar, EditorForm, CharacterGenerator, UploadArea,
│   │                        # CropDialog, ImageUrlField, PlayerPreview, DownloadSection,
│   │                        # PaymentDialog, TierPicker, SubscribeForm, ErrorDialog,
│   │                        # SoundToggle, LanguageToggle, Footer, ui/ (shadcn)
│   ├── remotion/            # EjectorComposition.tsx (+ tests)
│   ├── lib/                 # render/ (mp4, gif, capability check), payment/ (code,
│   │                        # events, validation), characterImages, i18n, tracking,
│   │                        # newsletter, config
│   └── locales/             # en.json, pt-BR.json (ported + merged from public/static)
├── e2e/                     # Playwright specs
├── public/                  # kept assets: background frames, character png, audio, icons
└── docs/superpowers/specs/  # this spec + implementation plan
```

## Remotion composition

`EjectorComposition` — 5.5 s @ 30 fps, 1920×1080 design size, pure DOM. Faithful
port of `drawAnimation.js`:

- **Background:** 155-frame PNG sequence (`/among-us-background-images/<n>.png`)
  selected by `Math.min(154, Math.round(t * 30))`; black "imperfection patch"
  `<div>` at (50 %, 65 %) sized 5 % × 9 %.
- **Character:** `<Img>` centered vertically, `x = width * 0.28 * t`, rotation
  `-1.3 rad/s`, height `= height / 4.46`, aspect preserved. Character source is a
  normalized `CharacterFrames` structure (list of `{ imageURL, start, end }` +
  total duration) so static images, color-generated crewmates, and animated GIFs
  all flow through one prop. GIF inputs are decomposed client-side at edit time
  (port of `getCharacterImages`).
- **Ejected text:** typewriter from 1.7 s to 3.7 s (linear character count),
  full text after; centered both axes; font-size 6.7 % of height; white; Arial.
- **Impostor text:** starts 3.8 s; font-scale keyframes
  `[0, .33, .66, 1, 1.2] → [0.7, 1.2, 0.8, 1.1, 1]`, offset 8.04 % of height
  below center.
- **Watermark:** `EJECTOR.KASSELLABS.IO`, white 60 % opacity, bottom-right,
  8 % height font — controlled by `showWatermark` prop.
- **Audio:** `ejected.mp3` via `<Audio>`; included in MP4 export; Player preview
  respects the app-level sound toggle (mute background music + effects).

Props: `{ ejectedText, impostorText, characterFrames, showWatermark }`.

## Export pipeline (all client-side)

- **Capability check:** WebCodecs (`VideoEncoder`) presence gates both export
  buttons; unsupported browsers get a shadcn Dialog suggesting Chrome/Edge.
  Preview always works.
- **MP4 (paid):** `@remotion/web-renderer` renders the composition with audio at
  1280×720 + watermark ($3 tier) or 1920×1080 clean (≥ $5 tier). Progress UI +
  existing in-progress/complete audio cues preserved.
- **GIF (free):** same web-renderer path renders the watermarked composition
  (no audio), then frames are decoded via WebCodecs and encoded with `gifenc`
  at ~10 fps (today's GIF cadence, 1/3 of 30 fps). Output downloaded as
  `<ejected-text>.gif`.
- File naming: `ejectedText` with whitespace → `-`, same as today.

## Payments

### Flow

1. Ejector generates a persistent `code` (UUID) stored in localStorage —
   identifies this browser to the payment system.
2. "Download Video" (unpaid) opens a Dialog: two tier cards (postMessage
   `setAmount` 300 / 500) + embedded `payment-frontend` iframe
   `?embed=true&app=ejector&code=<uuid>&amount=500`.
3. On origin-checked success `postMessage` (`{type:'payment', action:'success'}`,
   ported `paymentEvents` pattern from star-wars-intro-creator-new), ejector
   marks the user paid and starts the MP4 render.
4. On page load (and periodically while a payment dialog is open), ejector calls
   the new paid-check endpoint to restore/confirm the 24 h window.
5. Tier enforcement: `dollarValue` from the paid-check response decides
   resolution/watermark ($3–4.99 → 720p watermarked; ≥ $5 → 1080p clean). The
   postMessage payload's `finalAmount` is used only for the immediate unlock.

### payment-backend changes

- `src/apps/ejector.ts`: `createContext` passthrough; `isAmountValid` ≥ 300
  cents (USD-equivalent); `getStatementDescriptor` → `EJECTOR` (becomes
  `KL* EJECTOR`, ≤ 22 chars); `getDescription` → tier name + support email note;
  `bumpVideo` → no-op (nothing renders server-side; the payment row itself is
  the unlock record).
- New endpoint `GET /payment/:app/:code/paid` (rate-limited): looks up the
  newest `payment` row for that app+code; responds
  `{ paid: boolean, dollarValue?: number, paidAt?: string }` with `paid: true`
  only when `created_at` is within the last 24 h. Update `openapi.json` in the
  same change (Documentation Policy).
- Tests per that repo's Jest conventions (external infra mocked).

### payment-frontend changes

- `lib/apps.ts`: register `ejector` — `label: 'Ejector Video'`, `minimum: 300`,
  `getPaymentDescription(code)` mentioning the ejection video.
- `ejector.kassellabs.io` already matches the parent-origin allowlist regex; no
  allowlist change needed for production. Local dev uses the same env-based
  `paymentPageUrl` override approach as star-wars-intro-creator-new.

## Layout & UI

Modeled on star-wars-intro-creator-new's structure, re-themed for Among Us
(dark space background, crewmate color accents), Tailwind + shadcn throughout:

- `/` — Navbar (logo, sound toggle, language toggle); large `@remotion/player`
  preview (loop, controls); editor card: ejection text, impostor text,
  CharacterGenerator (color-swap of the red crewmate sprite, ported to TS),
  UploadArea (file upload + crop dialog), ImageUrlField (CORS-proxied URL,
  GIF-aware); DownloadSection (free GIF button, video button + payment gate,
  render progress); SubscribeForm; Footer (Kassel Labs links, obfuscated
  support email).
- `/unsubscribe` — newsletter unsubscribe page.
- Error handling: all failures (render, payment validation, upload, network)
  surface through a shared shadcn `ErrorDialog`; no browser-native modals.

## Newsletter, i18n, tracking

- **Newsletter:** `subscribeNewsletter` / `unsubscribeNewsletter` GraphQL
  mutations on `https://admin.kassellabs.io/graphql` via `fetch`. ProductHunt
  badge and all legacy `BACKEND_URL` usages removed.
- **i18n:** en + pt-BR JSON dictionaries (existing files ported; `pt` merged
  into `pt-BR`), lightweight `t()` via React context, browser-language
  detection with a manual toggle persisted in localStorage.
- **Tracking:** GA `gtag` wrapper keeping current event names
  (`ejection_form_text_changed`, `modal_payment_open`, `paid`,
  `paypal_button_click` → replaced by payment-iframe events, etc.).

## Testing & CI

- TDD throughout. Unit/component tests beside source (Vitest + Testing
  Library); network mocked with MSW; `.dom.test.ts` suffix convention for
  jsdom-needing lib tests (same as star-wars-intro-creator-new).
- Remotion composition tested by rendering at fixed frames and asserting
  layer state (text slice, transforms, watermark presence).
- Playwright E2E: edit → preview, GIF download, payment gate (iframe +
  paid-check mocked via `page.route`) → MP4 unlock. Export pipeline itself is
  covered by unit tests around the renderer wrapper (web-renderer mocked) —
  real encoding is validated manually in Chrome.
- Coverage gate: 80 % lines/branches on `src/lib/`.
- GitHub Actions CI: lint+typecheck / unit tests+coverage / e2e (three jobs),
  mirroring star-wars-intro-creator-new's workflow.

## Cleanup

Delete: `pages/`, all canvas/ffmpeg/gif.js utils (`CanvasAnimator`,
`drawAnimation`, `getGIFURLFromAnimation`, `getMP4URLFromAnimation`,
`ffmpeg.js` worker, `gif.worker.js`, `isFFMPEGWorking`, `uploadFileToSpaces`,
`linode-storage/`), MUI v4, styled-jsx/sass setup, i18next-scanner config,
`react-paypal-button-v2`, legacy `src/contexts/Payment.js`, ProductHunt button,
`ffmpeg-worker-mp4.js` / `gif.worker.js` from `public/`.

Keep: `public/among-us-background-images/`, character sprite, audio files,
favicons/OG images.

Docs: rewrite `README.md` (setup, env vars, architecture); add project
`CLAUDE.md` (stack divergences, payment integration, render pipeline, test
conventions). Update payment-backend `openapi.json` + README app list;
payment-frontend README app list.

## Environment variables (ejector)

- `NEXT_PUBLIC_PAYMENT_PAGE_URL` — payment-frontend origin
  (prod `https://payment.kassellabs.io`)
- `NEXT_PUBLIC_PAYMENT_API_URL` — payment-backend origin (paid-check endpoint)
- `NEXT_PUBLIC_ADMIN_GRAPHQL_URL` — `https://admin.kassellabs.io/graphql`
- `NEXT_PUBLIC_GA_ID` — Google Analytics

## Risks / notes

- `@remotion/web-renderer` is the newest piece (WebCodecs-based, evolving API).
  Mitigation: isolate it behind `src/lib/render/` so the export implementation
  can change without touching UI; verify GIF-from-decoded-frames early
  (first implementation task after scaffolding).
- The paid gate is inherently soft (rendering happens client-side); accepted —
  payment gates the convenient path, not a hard DRM boundary.
- Firefox WebCodecs support is partial; export buttons degrade gracefully with
  an explanatory dialog.
