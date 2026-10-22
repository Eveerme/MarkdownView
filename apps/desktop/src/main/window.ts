import path from "node:path";

import {
  app,
  BrowserWindow,
  dialog,
  nativeTheme,
  screen,
  shell,
} from "electron";
import type { BrowserWindowConstructorOptions } from "electron";

import { isExternalUrl, isTrustedUrl } from "#src/main/renderer-route.ts";
import {
  minimumWindowSize,
  placeWindow,
  readWindowState,
  writeWindowState,
} from "#src/main/window-state.ts";

// The window shows the app and nothing else: other links open in the user's browser or mail client.
const openOutside = (target: string) => {
  if (isExternalUrl(target)) {
    void shell.openExternal(target);
  }
};

export const createMainWindow = ({
  devOrigin,
  preload,
  url,
}: {
  devOrigin: string | null;
  preload: string;
  url: string;
}) => {
  const statePath = path.join(app.getPath("userData"), "window-state.json");
  const saved = readWindowState(statePath);

  const display =
    saved?.x !== undefined && saved.y !== undefined
      ? screen.getDisplayNearestPoint({ x: saved.x, y: saved.y })
      : screen.getPrimaryDisplay();

  const placement = placeWindow(saved, display.workArea);

  const options: BrowserWindowConstructorOptions = {
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#1f1c19" : "#fbf7ef",
    height: placement.height,
    minHeight: minimumWindowSize.height,
    minWidth: minimumWindowSize.width,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload,
      sandbox: true,
      webviewTag: false,
    },
    width: placement.width,
  };

  if (placement.x !== undefined && placement.y !== undefined) {
    options.x = placement.x;
    options.y = placement.y;
  }

  const win = new BrowserWindow(options);

  if (placement.maximized) {
    win.maximize();
  }

  // Maximizing reports the screen bounds; the restored size is what to remember.
  win.on("close", () => {
    const maximized = win.isMaximized();

    writeWindowState(statePath, {
      ...(maximized ? win.getNormalBounds() : win.getBounds()),
      maximized,
    });
  });

  win.once("ready-to-show", () => {
    win.show();
  });

  // Chromium cannot show its own beforeunload prompt inside Electron; ask here instead.
  win.webContents.on("will-prevent-unload", (event) => {
    const choice = dialog.showMessageBoxSync(win, {
      buttons: ["放弃修改", "继续编辑"],
      cancelId: 1,
      defaultId: 1,
      detail: "关闭窗口会丢失当前文档里未保存的内容。",
      message: "文档还有未保存的修改。",
      title: "放弃修改？",
      type: "warning",
    });

    if (choice === 0) {
      event.preventDefault();
    }
  });

  win.webContents.setWindowOpenHandler((details) => {
    openOutside(details.url);

    return { action: "deny" };
  });

  // The native menu is gone, and its Ctrl+Shift+I with it; keep DevTools a key away in development.
  if (devOrigin !== null) {
    win.webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown" && input.key === "F12") {
        event.preventDefault();
        win.webContents.toggleDevTools();
      }
    });
  }

  win.webContents.on("will-navigate", (event, target) => {
    if (!isTrustedUrl(target, devOrigin)) {
      event.preventDefault();
      openOutside(target);
    }
  });

  void win.loadURL(url);

  return win;
};
