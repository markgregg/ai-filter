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
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      all: true,
      include: [
        "src/lib/agGridAdapter.ts",
        "src/lib/nlpResolver.ts",
        "src/lib/operators.ts",
        "src/lib/parser.ts",
        "src/lib/components/AiFilter/AiFilter.utils.ts",
        "src/lib/components/AiFilter/aiPrompt.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
      ],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
