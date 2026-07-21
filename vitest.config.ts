import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  test: {
    passWithNoTests: true,
    projects: [
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: [
            "node_modules/**",
            ".next/**",
            "src/**/*.dom.test.ts",
          ],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx", "src/**/*.dom.test.ts"],
          exclude: ["node_modules/**", ".next/**"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/**/*.test.ts",
        // WebCodecs-only leaf: OffscreenCanvas + VideoFrame have no jsdom
        // (or vitest-canvas-mock) implementation, so this can't run under
        // any test environment -- it's exercised manually in Chrome as
        // part of the render-pipeline checkpoint (see render/capability.ts
        // and render/renderVideo.ts, which mock this module's caller-side
        // contract instead of executing it).
        "src/lib/render/captureFrame.ts",
      ],
      thresholds: {
        lines: 80,
        branches: 80,
      },
    },
  },
});
