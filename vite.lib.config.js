import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
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
            entry: resolve(__dirname, "src/lib/index.ts"),
            name: "EasyFilter",
            fileName: "easy-filter",
        },
        rollupOptions: {
            external: ["react", "react-dom", "react/jsx-runtime"],
            output: {
                globals: {
                    react: "React",
                    "react-dom": "ReactDOM",
                    "react/jsx-runtime": "jsxRuntime",
                },
            },
        },
        cssCodeSplit: false,
    },
});
