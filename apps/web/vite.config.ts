import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // itch.io serves the uploaded HTML build from a nested path.
  // Relative asset URLs keep the game working both in local preview and in itch's iframe.
  base: "./",
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
});
