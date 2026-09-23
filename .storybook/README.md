# Storybook — local component previews

Storybook renders the project's components in isolation using the real
`src/app/globals.css` (Tailwind v4 + the Flowbite layer), the Geist fonts and
the decorator defined in `preview.tsx`. Use it to inspect component states
without navigating the application.

## Requirements

- Node 24.14.0 (repo minimum is Node 20)
- pnpm 10.33.0 (`packageManager` in `package.json`)
- `pnpm install` completed in `dg-app-ui`
- Network access on first load: `next/font/google` in `preview.tsx` serves the
  Geist faces from `fonts.gstatic.com`. Offline, previews fall back to the
  system sans stack; layout is unaffected.

## Launch

```sh
cd dg-app-ui
pnpm exec storybook dev --port 6017 --ci --no-open
```

`--ci` skips the browser launch and the version prompt. `pnpm run storybook`
is the same thing on port 6006. Check the port is free first
(`lsof -nP -iTCP:6017 -sTCP:LISTEN`) so you do not displace a running server,
and stop the server when you are done.

Open <http://localhost:6017/>, or a single story's iframe directly:

```
http://localhost:6017/iframe.html?id=<story-id>&viewMode=story
```

Story ids are listed at <http://localhost:6017/index.json>.

A production bundle builds with:

```sh
pnpm exec storybook build --output-dir <dir>
```

## Smoke checklist

Run this after any change to `.storybook/`, `src/app/globals.css`,
`postcss.config.mjs`, Tailwind or `flowbite-react`.

1. **CSS compiles.** `curl -o /dev/null -w '%{http_code}\n'
   http://localhost:6017/src/app/globals.css` returns `200`, and the server log
   shows no `[postcss]` error. A `404` here means every story will render
   Storybook's "No Preview" placeholder.
2. **A pre-existing story renders.** Open
   `dataset-details-dataset-files-tree--default`. The tree, its icons and the
   selected-row highlight are visible.
3. **Onboarding states render.** Open
   `dataset-onboarding-processing-view--running`, `--complete-and-readable`,
   `--failed-with-not-run-stages` and
   `--complete-access-and-sharing-unknown`. Each shows its banner, stage list
   and actions.
4. **The full stylesheet is present.** Headings use Geist (not the system sans
   stack) and the project tokens apply — e.g. `text-gray-750` resolves to
   `rgb(49, 65, 88)`, not black. The Flowbite layer contributes `--gray-50`
   and friends; if it is missing, the `@import
   "flowbite-react/plugin/tailwindcss"` resolution in `main.ts` has regressed.
5. **Narrow width.** Resize to ~390px (or use the viewport toolbar). Content
   stacks; nothing overflows horizontally.
6. **Keyboard focus.** Tab into the preview iframe. Focus reaches every
   button and the focused control is identifiable.

## Notes

- No Storybook job runs in GitHub Actions. CI (`.github/workflows/ci.yml`)
  runs Biome, `tsc --noEmit`, tests and `pnpm audit`. Biome lints and formats
  `.storybook/*.ts(x)`, but `tsc --noEmit` does **not** type-check them:
  TypeScript's `**/*` include in `tsconfig.json` skips dot-directories, and no
  explicit entry adds this one, so a type error in `main.ts` would not be
  caught before merge. Nothing in CI builds or renders stories either. This
  checklist is manual.
- `main.ts` aliases `flowbite-react/plugin/tailwindcss` to the stylesheet named
  by that package's `style` export condition. Vite inlines CSS `@import` with
  postcss-import, whose resolver matches the `import` condition first and would
  otherwise load the package's JavaScript entry and fail. Next does not need
  the alias because `@tailwindcss/postcss` resolves the import itself.
