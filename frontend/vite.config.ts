import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: ".",
      filename: "sw.js",
      injectRegister: false, // registered manually in index.jsx so we control update UX
      devOptions: { enabled: true, type: "module" },
      injectManifest: {
        // App code changes far more often than these vendor deps during
        // dev; keeping the precache manifest to actual build output only.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
      },
      manifest: {
        name: "Listarr",
        short_name: "Listarr",
        description: "Fast, real-time shopping lists for anything, not just groceries",
        theme_color: "#f7faf2",
        background_color: "#f7faf2",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          {
            name: "View Lists",
            short_name: "Lists",
            url: "/lists",
            icons: [{ src: "pwa-192x192.png", sizes: "192x192" }],
          },
        ],
        share_target: {
          action: "/share-target",
          method: "GET",
          params: { title: "title", text: "text", url: "url" },
        },
      },
    }),
  ],
  build: {
    // Repo-root build/, a sibling of frontend/ and backend/ — backend/app/main.py serves
    // this directory directly (FRONTEND_BUILD_DIR), and the root Dockerfile's
    // frontend-builder stage copies from this exact path.
    outDir: "../build",
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
});
