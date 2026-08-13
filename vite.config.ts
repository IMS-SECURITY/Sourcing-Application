// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    build: {
      minify: "esbuild",
      cssCodeSplit: true,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("react") || id.includes("scheduler")) {
                return "vendor-react";
              }
              if (id.includes("firebase")) {
                return "vendor-firebase";
              }
              if (id.includes("recharts") || id.includes("d3")) {
                return "vendor-charts";
              }
              if (id.includes("@radix-ui") || id.includes("lucide-react")) {
                return "vendor-ui";
              }
              return "vendor-libs";
            }
          },
        },
      },
    },
  },
});
