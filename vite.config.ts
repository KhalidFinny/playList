import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {},
  lint: {
    ignorePatterns: ["client/dist", "server/node_modules", "client/node_modules", "node_modules"],
  },
});
