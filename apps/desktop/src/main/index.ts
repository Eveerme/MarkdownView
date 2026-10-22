import path from "node:path";

import { app, BrowserWindow, protocol } from "electron";

import { imageAssetScheme, rendererOrigin } from "@markdownview/electron";

import { defaultApiOrigin } from "#src/main/config.ts";
import { isMarkdownPath } from "#src/main/files.ts";
import { setupIpc } from "#src/main/ipc.ts";
import { findMarkdownPath } from "#src/main/launch.ts";
import {
  parseHttpOrigin,
  parseLoopbackOrigin,
} from "#src/main/renderer-route.ts";
import { serveRenderer } from "#src/main/renderer.ts";
import { createMainWindow } from "#src/main/window.ts";

const origin = (name: string, parse: (value: string) => string | null) => {
  const value = process.env[name];

  if (value === undefined || value === "") {
    return null;
  }

  const parsed = parse(value);

  if (parsed === null) {
    throw new Error(`${name} is not a valid origin: ${value}`);
  }

  return parsed;
};

const devOrigin = origin("ELECTRON_RENDERER_URL", parseLoopbackOrigin);

const apiOrigin =
  origin("API_ORIGIN", parseHttpOrigin) ?? parseHttpOrigin(defaultApiOrigin);

if (apiOrigin === null) {
  throw new Error(`defaultApiOrigin is not an origin: ${defaultApiOrigin}`);
}

const open = () =>
  createMainWindow({
    devOrigin,
    preload: path.join(import.meta.dirname, "../preload/index.cjs"),
    url: devOrigin ?? `${rendererOrigin}/`,
  });

// Note images need a real scheme: fetch, a host, and query parsing, before the app is ready.
protocol.registerSchemesAsPrivileged([
  {
    privileges: {
      corsEnabled: true,
      secure: true,
      standard: true,
      stream: true,
      supportFetchAPI: true,
    },
    scheme: imageAssetScheme,
  },
]);

let requestOpen: ((filePath: string) => void) | null = null;
const queuedOpenPaths: string[] = [];

/** A file path arrives from argv, a second instance, or macOS open-file. */
const openFromShell = (filePath: string) => {
  if (requestOpen === null) {
    queuedOpenPaths.push(filePath);

    return;
  }

  requestOpen(filePath);
};

const start = () => {
  const ipc = setupIpc(devOrigin);

  ({ requestOpen } = ipc);

  protocol.handle(imageAssetScheme, ipc.serveImage);

  if (devOrigin === null) {
    serveRenderer({
      apiOrigin,
      rendererRoot: path.join(import.meta.dirname, "../renderer"),
    });
  }

  open();

  for (const filePath of queuedOpenPaths.splice(0)) {
    ipc.requestOpen(filePath);
  }

  const launchedFile = findMarkdownPath(process.argv.slice(1), process.cwd());

  if (launchedFile !== null) {
    ipc.requestOpen(launchedFile);
  }
};

app.on("open-file", (event, filePath) => {
  event.preventDefault();

  if (isMarkdownPath(filePath)) {
    openFromShell(filePath);
  }
});

if (app.requestSingleInstanceLock()) {
  // No top-level `await`: Electron starts the app only after the main module finishes evaluating.
  app.on("ready", start);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      open();
    }
  });
  app.on("second-instance", (_event, argv, workingDirectory) => {
    const filePath = findMarkdownPath(argv.slice(1), workingDirectory);

    if (filePath !== null) {
      openFromShell(filePath);
    }

    const [win] = BrowserWindow.getAllWindows();

    if (win === undefined) {
      // `start` opens the window and drains the queued path once the app is ready.
      if (app.isReady()) {
        open();
      }
    } else {
      if (win.isMinimized()) {
        win.restore();
      }

      win.focus();
    }
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
} else {
  app.quit();
}
