import { defineConfig } from "vite";

export default defineConfig({
  // Makes `vite build` output work even when served from a sub-path (e.g. GitHub Pages).
  base: "./",
});

