import { invoke } from "@tauri-apps/api/core";
import type { InvokeArgs } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { z } from "zod";
import type { ZodType } from "zod";

import {
  downloadProgressSchema,
  downloadedUpdateSchema,
  markdownDocumentSchema,
  markdownFolderSchema,
  markdownOpenRequestSchema,
  markdownSavedFileSchema,
  recentFileSchema,
  resolvedLinkSchema,
  savedImageSchema,
  versionsSchema,
  updateInfoSchema,
  desktopCommands,
} from "@markdownview/desktop-contract";
import type {
  DesktopApi,
  ExportDocumentRequest,
  ResolveLinkRequest,
  SaveFileAsRequest,
  SaveFileRequest,
} from "@markdownview/desktop-contract";

const call = async <T>(
  command: string,
  schema: ZodType<T>,
  args?: InvokeArgs
): Promise<T> => {
  const result: unknown = await invoke(command, args);

  return schema.parse(result);
};

const tauriDesktop: DesktopApi = {
  versions: async () => await call(desktopCommands.versions, versionsSchema),

  openFile: async () =>
    await call(desktopCommands.openFile, markdownDocumentSchema.nullable()),

  takeOpenRequest: async () =>
    await call(
      desktopCommands.takeOpenRequest,
      markdownOpenRequestSchema.nullable()
    ),

  onOpenRequest: (listener) => {
    let active = true;
    let unlisten: (() => void) | null = null;

    void (async () => {
      const handler = await listen(
        desktopCommands.openRequestEvent,
        (event) => {
          listener(markdownOpenRequestSchema.parse(event.payload));
        }
      );

      if (active) {
        unlisten = handler;
      } else {
        handler();
      }
    })();

    return () => {
      active = false;
      unlisten?.();
    };
  },

  openFolder: async () =>
    await call(
      desktopCommands.openFolder,
      z.array(markdownFolderSchema).nullable()
    ),

  listFolders: async () =>
    await call(desktopCommands.listFolders, z.array(markdownFolderSchema)),

  closeFolder: async (path) => {
    await call(desktopCommands.closeFolder, z.null(), { path });
  },

  refreshFolder: async (path) =>
    await call(desktopCommands.refreshFolder, markdownFolderSchema, { path }),

  readFile: async (path) =>
    await call(desktopCommands.readFile, markdownDocumentSchema, { path }),

  revealFile: async (path) => {
    await call(desktopCommands.revealFile, z.null(), { path });
  },

  revealFolder: async (path) => {
    await call(desktopCommands.revealFolder, z.null(), { path });
  },

  resolveLink: async (request: ResolveLinkRequest) =>
    await call(
      desktopCommands.resolveLink,
      resolvedLinkSchema.nullable(),
      request
    ),

  saveFile: async (request: SaveFileRequest) =>
    await call(desktopCommands.saveFile, markdownSavedFileSchema, request),

  saveFileAs: async (request: SaveFileAsRequest) =>
    await call(
      desktopCommands.saveFileAs,
      markdownSavedFileSchema.nullable(),
      request
    ),

  recentFiles: async () =>
    await call(desktopCommands.recentFiles, z.array(recentFileSchema)),

  clearRecentFiles: async () => {
    await call(desktopCommands.clearRecentFiles, z.null());
  },

  saveImage: async (request) =>
    await call(desktopCommands.saveImage, savedImageSchema, {
      ...request,
      data: [...request.data],
    }),

  checkUpdate: async () =>
    await call(desktopCommands.checkUpdate, updateInfoSchema.nullable()),

  downloadUpdate: async (request, onProgress) => {
    const unlisten = onProgress
      ? await listen(desktopCommands.downloadProgressEvent, (event) => {
          onProgress(downloadProgressSchema.parse(event.payload));
        })
      : null;

    try {
      return await call(
        desktopCommands.downloadUpdate,
        downloadedUpdateSchema,
        {
          info: request,
        }
      );
    } finally {
      unlisten?.();
    }
  },

  installUpdate: async (path) => {
    await call(desktopCommands.installUpdate, z.null(), { path });
  },

  exportDocument: async (request: ExportDocumentRequest) =>
    await call(
      desktopCommands.exportDocument,
      markdownSavedFileSchema.nullable(),
      request
    ),
};

/** The desktop bridge, or null when the app runs in a browser tab. */
export const desktop = (): DesktopApi | null => {
  if (typeof window === "undefined") {
    return null;
  }

  // Tests install a complete contract fake on `window.desktop`.
  if (window.desktop !== undefined) {
    return window.desktop;
  }

  return "__TAURI_INTERNALS__" in window ? tauriDesktop : null;
};
