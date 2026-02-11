import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src"),
      "@ui": path.resolve(dirname, "src/components/ui"),
    },
  },
  test: {
    name: "unit",
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.storybook/**",
      "**/*.stories.*",
    ],
    setupFiles: ["tests/vitest.setup.ts"],
  },
});
