import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environmentMatchGlobs: [
      ["src/lib/grammar/**", "node"],
      ["src/lib/nlpResolver.test.ts", "node"],
      ["src/**/*.test.tsx", "jsdom"],
      ["src/lib/components/**", "jsdom"],
    ],
    environment: "node",
    setupFiles: ["src/test-setup.ts"],
    globals: true,
  },
});
