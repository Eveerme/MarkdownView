import { contextBridge, ipcRenderer } from "electron";
import type { ZodType } from "zod";

import type {
  DesktopApi,
  DesktopVersions,
  MarkdownDocument,
  MarkdownFolder,
  MarkdownSavedFile,
  SaveFileAsRequest,
  SaveFileRequest,
} from "@markdownview/electron";
import {
  desktopBridgeGlobal,
  desktopChannels,
  markdownDocumentSchema,
  markdownFolderSchema,
  markdownSavedFileSchema,
  versionsSchema,
} from "@markdownview/electron";

type InvokePayload = string | SaveFileRequest | SaveFileAsRequest;

const invoke = async <T>(
  channel: string,
  schema: ZodType<T>,
  payload?: InvokePayload
): Promise<T> => {
  const result: unknown = await ipcRenderer.invoke(channel, payload);

  return schema.parse(result);
};

const desktop = {
  versions: async (): Promise<DesktopVersions> => {
    const value = await invoke(desktopChannels.versions, versionsSchema);

    return value;
  },

  openFile: async (): Promise<MarkdownDocument | null> => {
    const document = await invoke(
      desktopChannels.openFile,
      markdownDocumentSchema.nullable()
    );

    return document;
  },

  openFolder: async (): Promise<MarkdownFolder | null> => {
    const folder = await invoke(
      desktopChannels.openFolder,
      markdownFolderSchema.nullable()
    );

    return folder;
  },

  refreshFolder: async (path: string): Promise<MarkdownFolder> => {
    const folder = await invoke(
      desktopChannels.refreshFolder,
      markdownFolderSchema,
      path
    );

    return folder;
  },

  readFile: async (path: string): Promise<MarkdownDocument> => {
    const document = await invoke(
      desktopChannels.readFile,
      markdownDocumentSchema,
      path
    );

    return document;
  },

  saveFile: async (request: SaveFileRequest): Promise<MarkdownSavedFile> => {
    const saved = await invoke(
      desktopChannels.saveFile,
      markdownSavedFileSchema,
      request
    );

    return saved;
  },

  saveFileAs: async (
    request: SaveFileAsRequest
  ): Promise<MarkdownSavedFile | null> => {
    const saved = await invoke(
      desktopChannels.saveFileAs,
      markdownSavedFileSchema.nullable(),
      request
    );

    return saved;
  },
} satisfies DesktopApi;

contextBridge.exposeInMainWorld(desktopBridgeGlobal, desktop);
