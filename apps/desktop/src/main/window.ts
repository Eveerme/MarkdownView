import { BrowserWindow, dialog, nativeTheme, shell } from "electron";

import { isExternalUrl, isTrustedUrl } from "#src/main/renderer-route.ts";

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
  const win = new BrowserWindow({
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#1f1c19" : "#fbf7ef",
    height: 800,
    minHeight: 520,
    minWidth: 720,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload,
      sandbox: true,
      webviewTag: false,
    },
    width: 1280,
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
  win.webContents.on("will-navigate", (event, target) => {
    if (!isTrustedUrl(target, devOrigin)) {
      event.preventDefault();
      openOutside(target);
    }
  });

  void win.loadURL(url);

  return win;
};
