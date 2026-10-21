# markdownview

React · Electron, on [Vite+](https://viteplus.dev).

| Layer     | Choice                                                                                |
| --------- | ------------------------------------------------------------------------------------- |
| Frontend  | React 19, TanStack Router, TanStack Query, Tailwind CSS 4                             |
| UI        | shadcn/ui on Base UI, in `packages/ui`                                                |
| Desktop   | Electron (main, preload, and the web app as renderer), packaged with electron-builder |
| Toolchain | Vite+ (`vp`): dev, build, test, lint, format, type check                              |

## Getting started

```sh
vp install
vp run dev
```

Open http://localhost:5173.

`vp run dev` also opens the app in an Electron window. `vp run package:desktop` writes the installer to `apps/desktop/release`.

## Commands

```sh
vp check          # format, lint, type check
vp run knip       # unused files, exports, dependencies, and catalog entries
vp test           # unit tests (Vitest)
vp run test:e2e   # end-to-end tests (Playwright) in Chromium, against the dev server
vp run ready      # check + knip + test + test:e2e + production build
```

The end-to-end tests drive the installed Google Chrome (`channel: "chrome"`), so no Playwright browser download is needed.
