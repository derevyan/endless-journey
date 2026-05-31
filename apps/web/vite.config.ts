import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import type { PluginOption } from "vite";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
      proxy: {
        "/api": {
          target: "http://localhost:3001",
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 3000,
      host: "0.0.0.0",
    },
    plugins: [
      tailwindcss(),
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
      }),
      react(),
    ] as PluginOption[],
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode),
      global: "globalThis",
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@journey/schemas": path.resolve(__dirname, "../../packages/schemas/src"),
        "@journey/engine": path.resolve(__dirname, "../../packages/engine/src"),
        buffer: "buffer/",
      },
    },
    optimizeDeps: {
      include: ["buffer"],
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, "index.html"),
        },
        output: {
          manualChunks: {
            graph: ["@xyflow/react", "dagre"],
            icons: ["lucide-react"],
            tanstack: ["@tanstack/react-query", "@tanstack/react-router", "@tanstack/react-store", "@tanstack/react-form", "@tanstack/zod-form-adapter"],
            ui: ["@radix-ui/react-label", "@radix-ui/react-select", "@radix-ui/react-slot"],
          },
        },
      },
    },
  };
});
