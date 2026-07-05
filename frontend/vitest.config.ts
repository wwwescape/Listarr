import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./test/setup.ts",
    // @material/material-color-utilities ships ESM with extensionless
    // relative imports (bundler-style resolution, e.g. './dynamic_color'
    // instead of './dynamic_color.js'). Vite's real browser bundling
    // resolves that fine, but Vitest's default externalized Node loader
    // enforces strict ESM and throws MODULE_NOT_FOUND — force it through
    // Vite's transform pipeline instead.
    server: {
      deps: {
        inline: ["@material/material-color-utilities"],
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: ["**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}", "test/**"],
    },
  },
});
