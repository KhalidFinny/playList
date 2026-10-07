import { defineConfig } from "vite-plus";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  fmt: {},
  lint: {
    plugins: ["oxc", "typescript", "unicorn", "react"],
    categories: {
      correctness: "warn",
    },
    env: {
      builtin: true,
    },
    ignorePatterns: ["dist"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "react/only-export-components": "off",
    },
  },
  plugins: [
    tanstackRouter({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
      // The generated tree should match the project's style. It is also listed
      // in .prettierignore because this plugin exposes no print-width option and
      // wraps differently from oxfmt — see that file.
      quoteStyle: "double",
      semicolons: true,
    }),
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["playlist.fiinnyy.my.id", "playlist.ryuko.my.id", "localhost"],
    proxy: {
      // The API and Socket.IO are served by the same Bun server in production.
      // Without these the dev server 404s on /api (the preview player hits it too).
      "/api": {
        target: "http://localhost:3001",
      },
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true,
      },
    },
  },
});
