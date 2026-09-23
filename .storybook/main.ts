import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/nextjs-vite";
import { mergeConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// globals.css does `@import "flowbite-react/plugin/tailwindcss"`. Under Next,
// @tailwindcss/postcss resolves that import itself and honours the package's
// `style` export condition, so the stylesheet is loaded. Vite inlines CSS
// `@import` with postcss-import first, and its resolver also matches the
// `import` condition, which flowbite-react lists before `style` -- so the
// JavaScript plugin entry is loaded and postcss fails on `import plugin from`.
// Alias the CSS-only specifier to exactly the file the `style` condition
// declares, read from the installed package rather than hardcoded.
//
// The package JSON is read with readFileSync and its export map reached
// through a named binding on purpose. Storybook's Vite builder decides whether
// this file is CommonJS by matching a regex against its raw source, comments
// included, so a literal call to the CJS loader or a bracket access on an
// `exports` identifier would print a false deprecation warning on every start
// even though the file is ESM.
const flowbitePackageJsonPath = require.resolve("flowbite-react/package.json");
const { exports: flowbiteExportMap } = JSON.parse(
  readFileSync(flowbitePackageJsonPath, "utf8"),
);
const flowbiteTailwindCssPath = path.resolve(
  path.dirname(flowbitePackageJsonPath),
  flowbiteExportMap["./plugin/tailwindcss"].style,
);

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
        alias: [
          {
            find: /^flowbite-react\/plugin\/tailwindcss$/,
            replacement: flowbiteTailwindCssPath,
          },
          { find: "@", replacement: path.resolve(__dirname, "../src") },
        ],
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
              } catch (_e) {
                // If URL parsing fails, try to extract path manually
                const match = id.match(/file:\/\/(.+)/);
                if (match?.[1]) {
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
