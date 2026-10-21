import { contextBridge, ipcRenderer } from "electron";

import type { DesktopApi } from "@markdownview/electron";
import {
  desktopBridgeGlobal,
  desktopChannels,
  versionsSchema,
} from "@markdownview/electron";

const desktop: DesktopApi = {
  versions: async () =>
    versionsSchema.parse(await ipcRenderer.invoke(desktopChannels.versions)),
};

contextBridge.exposeInMainWorld(desktopBridgeGlobal, desktop);
