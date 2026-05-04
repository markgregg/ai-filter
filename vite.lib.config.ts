import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import pkg from "./package.json";

const peerDeps = Object.keys(pkg.peerDependencies ?? {});
const deps = Object.keys(pkg.dependencies ?? {});
const externalPackages = new Set([...peerDeps, ...deps]);

function externalGlobalName(id: string): string | undefined {
  if (id === "react") return "React";
  if (id === "react-dom") return "ReactDOM";
  if (id === "react/jsx-runtime") return "jsxRuntime";
  if (id === "use-context-selector") return "useContextSelector";
  if (id === "nearley") return "nearley";
  if (id === "moo") return "moo";
  if (id === "@base-ui/react" || id.startsWith("@base-ui/react/")) {
    return "BaseUIReact";
  }
  return undefined;
}

function isExternal(id: string): boolean {
  for (const name of externalPackages) {
    if (id === name || id.startsWith(`${name}/`)) return true;
  }
  return false;
}

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ["src/lib"],
      outDir: "dist/types",
      tsconfigPath: "./tsconfig.lib.json",
    }),
  ],
  build: {
    lib: {
      entry: {
        "ai-filter": resolve(__dirname, "src/lib/index.ts"),
        core: resolve(__dirname, "src/lib/core.ts"),
      },
      name: "AiFilter",
      fileName: (format, entryName) => `${entryName}.${format === "es" ? "js" : "umd.cjs"}`,
    },
    rollupOptions: {
      external: isExternal,
      treeshake: {
        moduleSideEffects: false,
      },
      output: {
        globals: (id: string) => externalGlobalName(id) ?? id,
      },
    },
    cssCodeSplit: false,
  },
});
