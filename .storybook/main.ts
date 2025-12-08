import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/nextjs-vite";
import { mergeConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@chromatic-com/storybook",
    "@storybook/addon-docs",
    "@storybook/addon-onboarding",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest",
  ],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  staticDirs: ["../public"],
  async viteFinal(config) {
    return mergeConfig(config, {
      resolve: {
        alias: {
          "@": path.resolve(__dirname, "../src"),
        },
      },
      server: {
        fs: {
          allow: [path.resolve(__dirname, "..")],
        },
      },
      optimizeDeps: {
        include: ["@storybook/addon-docs"],
      },
      plugins: [
        {
          name: "fix-file-url-imports",
          enforce: "pre",
          resolveId(id, importer) {
            if (id.startsWith("file://")) {
              // Convert file:// URL to regular path
              try {
                const url = new URL(id);
                let filePath = url.pathname;
                // Ensure the path is absolute
                if (!path.isAbsolute(filePath)) {
                  filePath = path.resolve(filePath);
                }
                // Check if file exists
                if (filePath && existsSync(filePath)) {
                  return filePath;
                }
              } catch (e) {
                // If URL parsing fails, try to extract path manually
                const match = id.match(/file:\/\/(.+)/);
                if (match && match[1]) {
                  const extractedPath = decodeURIComponent(match[1]);
                  if (existsSync(extractedPath)) {
                    return extractedPath;
                  }
                }
              }
            }
            return null;
          },
        },
      ],
    });
  },
};

export default config;
