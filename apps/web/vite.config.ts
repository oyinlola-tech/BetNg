import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    // Bound to localhost by default; a dev container overrides it.
    host: process.env["HOST"] ?? "127.0.0.1",
    // Clear of 3000-3009, which the backend services occupy.
    port: 4200,
  },
});
