/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src/sw",
      filename: "index.ts",
      injectRegister: "auto",
      injectManifest: {
        // Precache the app shell *and* the zxing wasm binary for offline use.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webp,woff2,wasm}"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      registerType: "autoUpdate",
      devOptions: { enabled: false, type: "module" },
      manifest: {
        name: "codes — Barcode & QR",
        short_name: "codes",
        description: "Barcodes und QR-Codes lesen und erzeugen — vollständig lokal, offline-fähig.",
        lang: "de",
        theme_color: "#0a0a0a",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  worker: {
    format: "es",
  },
  test: {
    environment: "jsdom",
    globals: true,
    passWithNoTests: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
