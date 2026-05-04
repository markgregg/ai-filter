import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Separate Vite config for Ladle — no library mode, no dts plugin.
export default defineConfig({
  plugins: [react()],
});
